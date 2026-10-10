import {SAMPLE_KIND} from './profile';
import {profileText} from './profile';
import {TY,TTL,marker,sourceUrl,queryUrl,nodeUrl,normalizeTree,selectSamples,pathToRoot,dedupe,fresh,type QueryResult,type TreePage,type AncientSample} from './model';
import {parseDetail} from './parser';
import {snps,checkSnp,snpUrl,mappingTarget,needsSnpQuery,rebaseSearch,searchableSnps} from './snps';
import {equivalentEvidence,applyEquivalent,disambiguate,pendingEquivalentCandidates,sameTreeFilter,type EquivalentEvidence} from './equivalent';
import {directProjections,subtreeProjection} from './projection';
import {knownDirectCount,downstreamCounts,type BadgeCount} from './counts';
import {loadMatch,confirmedMatch,matchKey} from './node-match';
import {resolveTarget} from './aliases';
export interface IO {get(key:string):Promise<any>;set(key:string,value:any):Promise<void>;remove?(key:string|string[]):Promise<void>;request(url:string,signal:AbortSignal):Promise<{status:number;url:string;body:string}>;now():number;id():string}
export class SyncRequired extends Error{}
export const jobKey=(id:string)=>profileText(`anc.job.${id}`);
export const cacheKey=(m:string,s:string)=>profileText(`anc.cache.fast4.${m}.${s}`);
/** Shared gate: sixteen total reads, at most two details, 500ms starts; trees stay exclusive. */
export class RequestGate {
  private tail:Promise<any>=Promise.resolve();private next=0;
  private active=new Map<Promise<any>,'snp'|'detail'|'tree'>();
  fetch(url:string,signal:AbortSignal){
    const work=this.tail.catch(()=>{}).then(async()=>{
      const u=new URL(url);const kind=u.origin===TY&&u.pathname==='/api/ysnp/theytree/'&&u.searchParams.has('snp')?'snp':u.origin===TY&&/^\/sample\/[a-zA-Z0-9_-]+\.html$/.test(u.pathname)?'detail':'tree';
      while(this.active.size&&(kind==='tree'||this.active.size>=16||[...this.active.values()].includes('tree')||kind==='detail'&&[...this.active.values()].filter(v=>v==='detail').length>=2)){await Promise.race([...this.active.keys()].map(p=>p.catch(()=>{})));if(signal.aborted)throw new DOMException('Cancelled','AbortError');}
      const wait=Math.max(0,this.next-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      this.next=Date.now()+500;
      const timeout=AbortSignal.timeout(25000);const control=new AbortController();
      const abort=()=>control.abort();signal.addEventListener('abort',abort,{once:true});timeout.addEventListener('abort',abort,{once:true});
      const responseTask=(async()=>{try{const response=await fetch(url,{credentials:'include',signal:control.signal,redirect:'follow',referrerPolicy:'no-referrer'});return {status:response.status,url:response.url,body:await response.text()};}
      finally{signal.removeEventListener('abort',abort);timeout.removeEventListener('abort',abort);}})();
      this.active.set(responseTask,kind);void responseTask.finally(()=>this.active.delete(responseTask)).catch(()=>{});
      return {responseTask};
    });this.tail=work;return work.then(v=>v.responseTask);
  }
}
export class AncientEngine {
  private active=new Map<string,AbortController>();
  constructor(private io:IO){}
  private remembered=new Map<string,string>();
  private badgeSynced=new Set<string>();
  private pendingKey(j:Pick<QueryResult,'marker'|'scope'>){return profileText(`anc.pending.fast4.${j.marker}.${j.scope}`);}
  private async rememberMatch(j:QueryResult){const value=confirmedMatch(j);if(!value||j.matchReused)return;const fingerprint=JSON.stringify([value.target,value.nodeSnps,value.snpChecks]);if(this.remembered.get(j.id)===fingerprint)return;await this.io.set(matchKey(j.marker),value);j.mappingVerifiedAt=value.verifiedAt;this.remembered.set(j.id,fingerprint);}
  async save(job:QueryResult,touch=true){
    const previous=job.scope==='downstream'?await this.io.get(jobKey(job.id)):null;
    if(touch)job.updatedAt=this.io.now();await this.rememberMatch(job);await this.io.set(jobKey(job.id),job);
    const pendingKey=this.pendingKey(job),pendingId=await this.io.get(pendingKey);
    if(!job.complete&&job.status!=='unmatched'){
      await this.io.set(pendingKey,job.id);
      if(pendingId&&pendingId!==job.id)await this.io.remove?.(jobKey(pendingId));
    }else if(pendingId===job.id)await this.io.remove?.(pendingKey);
    if(job.scope==='downstream'){
      const counts=downstreamCounts(job,this.io.now()),old=previous?downstreamCounts(previous,this.io.now()):new Map<string,BadgeCount>();let changed=false;
      for(const name of new Set([...counts.keys(),...old.keys()])){
        const key=profileText(`anc.badge-progress.v1.${name}`),saved=await this.io.get(key),count=counts.get(name);
        if(count){
          if(saved&&saved.updatedAt>job.updatedAt)continue;
          if(saved?.id===job.id&&saved.count===count.count)continue;
          await this.io.set(key,{...count,target:name,id:job.id,createdAt:job.createdAt});changed=true;
        }else if(saved?.id===job.id){await this.io.set(key,null);changed=true;}
      }
      if(changed)await this.io.set(profileText('anc.cacheRevision'),{at:job.updatedAt,id:job.id});
      this.badgeSynced.add(job.id);
    }
  }
  async get(id:string):Promise<QueryResult|null>{const j=await this.io.get(jobKey(id));if(j?.status==='running'&&!this.active.has(id)){j.status='paused';j.message='后台任务已暂停，可继续查询';await this.save(j);}if(j?.scope==='downstream'&&!this.badgeSynced.has(id))await this.save(j,false);return j||null;}
  private cacheTail:Promise<unknown>=Promise.resolve();
  private async putCache(j:QueryResult){
    const key=cacheKey(j.marker,j.scope);const old=await this.io.get(key);
    if(!old||old.updatedAt<=j.updatedAt)await this.io.set(key,j);
  }
  private async cacheResult(j:QueryResult){
    const work=this.cacheTail.catch(()=>{}).then(async()=>{
      if(!j.complete)return;
      if(j.scope==='downstream'&&j.projectedVersion!==1){
        let count=0;
        for(const child of directProjections(j)){
          await this.putCache(child);count++;
          if(child.target===j.target&&j.marker!==j.target)await this.putCache({...child,marker:j.marker,nodeSnps:j.nodeSnps,snpChecks:j.snpChecks,mapping:j.mapping,mappingVerifiedAt:j.mappingVerifiedAt??j.updatedAt});
        }
        j.cachedChildren=Math.max(0,count-1);j.projectedVersion=1;
      }
      await this.putCache(j);
      await this.io.set(profileText('anc.cacheRevision'),{at:j.updatedAt,id:j.id});
    });this.cacheTail=work;await work;
  }
  private async readCompatibleCache(name:string,scope:'direct'|'downstream'):Promise<QueryResult|null>{
    const current=await this.io.get(cacheKey(name,scope));if(current)return current;
    // v1.1.2 already required verified cross-site mapping. Keep its original
    // collection time; do not revive expired or unresolved earlier results.
    const old=await this.io.get(profileText(`anc.cache.snp3.${name}.${scope}`));
    if(!old||old.marker!==name||old.scope!==scope||!fresh(old,this.io.now())||!Array.isArray(old.samples)||!Array.isArray(old.branches)||
      (old.target!==name&&(!old.mappingReady||!old.nodeSnps?.length||!old.snpChecks?.length)))return null;
    await this.putCache(old);return old;
  }
  async getCached(name:string,scope:'direct'|'downstream'):Promise<QueryResult|null>{
    const now=this.io.now();let current:QueryResult|null=await this.readCompatibleCache(name,scope);
    const configured=resolveTarget(name);const fixed=configured.target!==name;
    const saved=await loadMatch(this.io,name);const known=saved&&(!fixed||saved.target===configured.target)?saved:null;
    if(fixed&&current?.target!==configured.target)current=null;
    // A confirmed identity can exist without any completed sample query under
    // the 23mofang name. Ancestor projections are keyed by the source name.
    if(known&&current&&current.target!==known.target)current=null;
    if(scope==='direct'){
      const whole=await this.readCompatibleCache(name,'downstream');
      if(whole&&(!fixed||whole.target===configured.target)&&(!known||whole.target===known.target)&&fresh(whole,now)&&(!current||whole.updatedAt>current.updatedAt||whole.projectedVersion!==1)){
        await this.cacheResult({...whole,projectedVersion:undefined});
        current=await this.readCompatibleCache(name,scope);
      }
    }
    const direct:QueryResult|null=scope==='direct'?current:await this.readCompatibleCache(name,'direct');
    const alias=known?{...known,mappingVerifiedAt:known.verifiedAt,matchReused:true,updatedAt:known.verifiedAt}:fixed?{...configured,nodeSnps:undefined,snpChecks:[],mappingVerifiedAt:0,matchReused:true,updatedAt:0}:direct&&direct.target!==name?direct:null;
    const mappingValid=!alias||alias.matchReused||now-(alias.mappingVerifiedAt??alias.updatedAt)<TTL;
    if(!mappingValid)return null;
    const target=alias?.target||name;
    const canonical:QueryResult|null=alias?await this.io.get(cacheKey(target,'direct'))||null:direct;
    let replacement:QueryResult|null=null;
    if(scope==='direct'&&alias&&canonical&&fresh(canonical,now)&&(!current||canonical.updatedAt>current.updatedAt))replacement=canonical;
    if(scope==='downstream'&&alias){
      const whole=await this.readCompatibleCache(target,'downstream');
      if(whole&&fresh(whole,now)&&(!current||whole.updatedAt>current.updatedAt))replacement=whole;
    }
    if(scope==='downstream'&&canonical?.cacheOrigin){
      const origin=canonical.cacheOrigin;const ancestor=await this.io.get(cacheKey(origin.marker,'downstream'));
      if(ancestor&&fresh(ancestor,now)&&ancestor.updatedAt===origin.at&&(!current||ancestor.updatedAt>current.updatedAt)&&(!replacement||ancestor.updatedAt>replacement.updatedAt))replacement=subtreeProjection(ancestor,target);
    }
    if(replacement){
      current={...replacement,marker:name,...(alias?{nodeSnps:alias.nodeSnps,snpChecks:alias.snpChecks,mapping:alias.mapping,mappingReady:true,matchReused:!!known,mappingVerifiedAt:alias.mappingVerifiedAt??alias.updatedAt}:{})};
      await this.putCache(current);
    }
    return current&&(!fixed||current.target===configured.target)&&(!known||current.target===known.target)&&fresh(current,now)?current:null;
  }
  async getBadge(name:string):Promise<BadgeCount|null>{
    const cached=await this.getCached(name,'direct');let result=cached?knownDirectCount(cached,this.io.now()):null;
    const configured=resolveTarget(name),known=await loadMatch(this.io,name);
    const target=configured.target!==name?configured.target:known?.target||name;
    const progress=await this.io.get(profileText(`anc.badge-progress.v1.${target}`));
    if(progress?.target===target&&progress.count>0&&this.io.now()-progress.updatedAt<TTL&&(!result||progress.createdAt>result.updatedAt))result={count:progress.count,complete:false,updatedAt:progress.updatedAt};
    for(const scope of ['direct','downstream']){
      const id=await this.io.get(profileText(`anc.pending.fast4.${name}.${scope}`));const job=id?await this.io.get(jobKey(id)):null;
      if(!job||job.marker!==name||job.complete)continue;
      const configured=resolveTarget(name);if(configured.target!==name&&job.target!==configured.target)continue;
      const partial=knownDirectCount(job,this.io.now());
      if(partial&&(!result||job.createdAt>result.updatedAt))result=partial;
    }
    return result;
  }
  async start(name:string,scope:'direct'|'downstream',refresh=false,values?:unknown):Promise<QueryResult>{
    const m=marker(name);if(!m)throw Error('无效支系标记');let nodeSnps=values===undefined?undefined:snps(values);if(nodeSnps&&!nodeSnps.length)throw Error('尚未读取到节点SNP列表，请等待树加载后重试');
    const configured=resolveTarget(m);const fixed=configured.target!==m;
    const stored=!refresh?await loadMatch(this.io,m):null;const known=stored&&(!fixed||stored.target===configured.target)&&(values===undefined||JSON.stringify(stored.nodeSnps)===JSON.stringify(nodeSnps))?stored:null;
    if(fixed)nodeSnps=undefined;
    if(known)nodeSnps=known.nodeSnps;
    if(!refresh){const cached=await this.getCached(m,scope);if(cached&&fresh(cached,this.io.now())&&(!known||cached.target===known.target)&&(values===undefined||JSON.stringify(cached.nodeSnps)===JSON.stringify(nodeSnps))){if(cached.scope==='downstream'&&cached.projectedVersion!==1)await this.cacheResult(cached);const copy={...cached,...(known?{matchReused:true,mappingVerifiedAt:known.verifiedAt,nodeSnps:known.nodeSnps,snpChecks:known.snpChecks,mapping:known.mapping}:{}),id:this.io.id(),cached:true};await this.io.set(jobKey(copy.id),copy);return copy;}}
    const resolved=known?{target:known.target,mapping:known.mapping}:resolveTarget(m);
    if(!refresh){
      const pendingId=await this.io.get(profileText(`anc.pending.fast4.${m}.${scope}`));const pending=pendingId?await this.io.get(jobKey(pendingId)):null;
      if(pending&&(!fixed||pending.target===configured.target&&pending.mappingReady)&&(!known||pending.mappingReady&&pending.target===known.target)&&!pending.complete&&pending.status!=='unmatched'&&(values===undefined||JSON.stringify(pending.nodeSnps)===JSON.stringify(nodeSnps))&&this.io.now()-pending.createdAt<TTL&&!this.active.has(pending.id)){
        // Give the reopened page its own task ID; a tab restored after browser
        // restart must not need the previous tab ID to find its checkpoint.
        const recovered:QueryResult={...pending,...(known?{matchReused:true,mappingVerifiedAt:known.verifiedAt}:{}),id:this.io.id(),status:'paused',syncToken:'',cached:false,message:'找到未完成的查询，点击“继续查询”恢复，或打开TheYtree同步'};await this.save(recovered);return recovered;
      }
    }
    const job:QueryResult={id:this.io.id(),marker:m,...resolved,nodeSnps,snpChecks:known?.snpChecks||[],mappingReady:!!known||!nodeSnps,matchReused:!!known,mappingVerifiedAt:known?.verifiedAt,scope,status:'running',createdAt:this.io.now(),updatedAt:this.io.now(),cached:false,forceRefresh:refresh,complete:false,samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],excluded:0,message:'正在读取TheYtree公开树'};
    await this.save(job);void this.run(job.id);return job;
  }
  async pause(id:string){this.active.get(id)?.abort();this.active.delete(id);const j=await this.io.get(jobKey(id));if(j&&j.status!=='complete'){j.status='paused';j.syncToken='';j.mappingToken='';j.message='查询已暂停，已取得的结果保留';await this.save(j);}return j;}
  async release(id:string){
    this.active.get(id)?.abort();this.active.delete(id);const j:QueryResult|null=await this.io.get(jobKey(id));if(!j)return;
    const pending=await this.io.get(this.pendingKey(j));
    if(pending!==id||j.complete||j.status==='unmatched')await this.io.remove?.(jobKey(id));
  }
  async backgroundSync(id:string){
    const j:QueryResult=await this.pause(id);if(!j)throw Error('任务不存在');
    const configured=resolveTarget(j.marker),saved=await loadMatch(this.io,j.marker);
    const known=saved&&(configured.target===j.marker||saved.target===configured.target)?saved:null;
    const target=known?.target||(configured.target!==j.marker?configured.target:null);
    if(target){
      if(j.target!==target||!j.mappingReady){j.branches=[];j.samples=[];j.unknown=[];j.checked=[];j.queue=[];j.details=[];j.excluded=0;j.complete=false;}
      j.target=target;j.mapping=known?.mapping||configured.mapping;j.mappingReady=true;j.nodeSnps=known?.nodeSnps;j.snpChecks=known?.snpChecks||[];j.matchReused=!!known;j.mappingVerifiedAt=known?.verifiedAt;
    }
    j.forceRefresh=false;j.syncToken='';j.mappingToken='';await this.save(j);return this.resume(id);
  }
  async resume(id:string){const j=await this.io.get(jobKey(id));if(!j)throw Error('任务不存在');if(this.active.has(id))return j;j.status='running';j.syncToken='';j.mappingToken='';j.failures=[];j.details=[...j.samples,...j.unknown].filter((s:AncientSample)=>!s.detail).map((s:AncientSample)=>s.au);j.queue=j.branches.filter((b:any)=>b.pending&&!j.checked.includes(b.id)).map((b:any)=>b.id);j.message='继续查询';await this.save(j);void this.run(id);return j;}
  private integrate(j:QueryResult,page:TreePage,requested?:string){
    const map=new Map(j.branches.map(b=>[b.id,b]));for(const b of page.branches)map.set(b.id,b);
    if(requested&&map.has(requested)&&page.branches.length+page.samples.length+page.unclassified.length+page.excluded>0)map.set(requested,{...map.get(requested)!,pending:false});
    const allBranches=[...map.values()];
    const root=allBranches.find(b=>!b.tentative&&b.marker===j.target);
    if(!root){j.status='unmatched';j.message='TheYtree返回的树中未找到同名节点，未使用上游节点替代';return;}
    const combined:TreePage={...page,branches:allBranches,samples:dedupe([...j.samples,...page.samples]),unclassified:dedupe([...j.unknown,...page.unclassified])};
    const selected=selectSamples(combined,root,j.scope);
    const conflicts=selected.samples.filter(s=>s.tentative||s.issue.includes('多个挂载'));
    j.samples=selected.samples.filter(s=>!conflicts.includes(s));j.unknown=dedupe([...selected.unknown,...conflicts]);
    const relevant=allBranches.filter(b=>{const p=pathToRoot(b.id,root.id,allBranches);return p&&(j.scope==='downstream'||b.id===root.id||p.length===2&&b.tentative);});
    // Persist only the connected query scope; broad source pages may contain a
    // much larger surrounding tree that is irrelevant to this result.
    j.branches=relevant;const relevantIds=new Set(relevant.map(b=>b.id));
    j.checked=[...new Set([...j.checked.filter(id=>relevantIds.has(id)),...relevant.filter(b=>!b.pending).map(b=>b.id)])];
    j.queue=relevant.filter(b=>b.pending&&!j.checked.includes(b.id)).map(b=>b.id);
    j.details=[...j.samples,...j.unknown].filter(s=>!s.detail).map(s=>s.au);
    j.excluded=Math.max(j.excluded,page.excluded);
  }
  private resolveMapping(j:QueryResult){
    const checks=disambiguate(j.snpChecks||[],j.marker);j.snpChecks=checks;const target=mappingTarget(checks);
    if(!target||checks.some(v=>v.issue)){
      j.status=pendingEquivalentCandidates(checks).length?'sync':checks.some(v=>v.target||v.issue)?'partial':'unmatched';j.complete=false;
      j.message=checks.some(v=>v.target||v.issue)?'SNP对应存在分歧或缺少交叉依据，未自动合并样本':'节点全部SNP均未找到可核实对应';
      if(j.status==='sync')j.message='需登录TheYtree核对候选节点的等价SNP列表；打开源站同步后继续';
      j.mapping='完整SNP核对尚未建立唯一对应';return false;
    }
    j.target=target;j.mappingReady=true;
    j.mapping=`${j.marker} → ${target} · ${checks.some(v=>v.evidence)?'两站SNP列表交叉对应':'节点SNP交叉对应'}，挂载关系以TheYtree为准`;
    if(checks.some(v=>v.note?.startsWith('两站树粒度不同')))j.mapping+='；源站有进一步细分，本节点仅查直接挂载样本';
    return true;
  }
  async beginSource(id:string){
    await this.pause(id);const j:QueryResult=await this.io.get(jobKey(id));if(!j)throw Error('任务不存在');
    j.mappingToken=this.io.id();j.syncToken='';j.status='sync';j.complete=false;j.message='正在通过正常网页同步';await this.save(j);return j;
  }
  async sourceUnmatched(id:string,token:string){
    const j:QueryResult=await this.io.get(jobKey(id));
    if(!j||j.status==='paused'||!token||j.mappingToken!==token||j.nodeSnps)throw Error('同名查询已过期');
    j.status='unmatched';j.complete=false;j.message='源站没有同名节点，回到23魔方后自动核对SNP';j.mappingToken='';await this.save(j);return j;
  }
  async sourceProblem(id:string,message:string,token:string){
    const j:QueryResult=await this.io.get(jobKey(id));if(!j||!token||j.mappingToken!==token||j.status==='paused')throw Error('同步已过期');
    j.status='sync';j.complete=false;j.message=message.slice(0,500);await this.save(j);return j;
  }
  async sourceEquivalent(id:string,candidateId:string,groups:unknown,method:EquivalentEvidence['method'],token:string){
    const j:QueryResult=await this.io.get(jobKey(id));
    if(!j||j.status==='paused'||!token||token!==j.mappingToken)throw Error('等价SNP同步已暂停或过期');
    const c=j.snpChecks?.find(v=>v.candidate?.id===candidateId)?.candidate;
    if(!c||!j.nodeSnps||j.mappingReady)throw Error('不是当前任务的待核对节点');
    const evidence=equivalentEvidence(c,groups,j.nodeSnps,this.io.now(),method);
    j.snpChecks=applyEquivalent(j.snpChecks||[],evidence);
    if(searchableSnps(j.nodeSnps,j.marker).every(s=>j.snpChecks!.some(v=>v.snp===s)))this.resolveMapping(j);
    await this.io.set(profileText(`anc.equivalent3.${c.id}.${c.marker}`),evidence);await this.save(j);return j;
  }
  async sourceSnp(id:string,value:string,page:TreePage){
    const j:QueryResult=await this.io.get(jobKey(id));
    if(!j||j.status==='paused'||!j.nodeSnps?.includes(value)||j.mappingReady)throw Error('SNP同步任务已过期');
    const check=checkSnp(page,value,j.nodeSnps,j.marker);
    if((!check.issue||check.candidate)&&JSON.stringify(check).length<100000)await this.io.set(`mofang.snp-search.v1.${value}`,{at:this.io.now(),check:rebaseSearch(check,[])});
    j.snpChecks=[...(j.snpChecks||[]).filter(v=>v.snp!==value),check];
    if(searchableSnps(j.nodeSnps,j.marker).every(s=>j.snpChecks!.some(v=>v.snp===s))){j.snpChecks=sameTreeFilter(j.snpChecks!,j.marker);this.resolveMapping(j);}
    j.message=j.mappingReady?profileText('SNP对应已确认，正在读取古DNA'):j.message;
    await this.save(j);return j;
  }
  async adopt(id:string,page:TreePage){
    await this.pause(id);const j=await this.io.get(jobKey(id));if(!j)throw Error('任务不存在');
    if(j.nodeSnps&&!j.mappingReady)throw Error('节点SNP尚未建立唯一对应');
    // DOM and API node IDs must not be mixed. A normal page sync is a new tree
    // snapshot, while already fetched ancient detail fields remain cacheable.
    j.branches=[];j.checked=[];j.samples=[];j.unknown=[];j.failures=[];j.syncToken=this.io.id();
    this.integrate(j,page);if(j.status!=='unmatched'){j.status='sync';j.message=profileText('已读取正常网页，正在补全古DNA详情');}
    await this.save(j);return j;
  }
  async sourceExpand(id:string,page:TreePage,node:string){const j=await this.io.get(jobKey(id));if(!j||j.status==='paused')return j;if(!j.queue.includes(node))throw Error('不是当前任务的待查节点');this.integrate(j,page,node);await this.save(j);return j;}
  async sourceDetail(id:string,au:string,detail:ReturnType<typeof parseDetail>){
    const j:QueryResult=await this.io.get(jobKey(id));if(!j||j.status==='paused')return j;
    const s=[...j.samples,...j.unknown].find(s=>s.au===au);if(!s)throw Error('样本不在当前查询范围');
    if(detail.type==='modern'){j.samples=j.samples.filter(s=>s.au!==au);j.unknown=j.unknown.filter(s=>s.au!==au);j.excluded++;}
    else if(detail.type===SAMPLE_KIND&&detail.sample?.au===au){
      const mismatch=detail.sample.marker&&detail.sample.marker!==s.marker.replace(/\?$/,'');const oldPeriod=s.period;
      Object.assign(s,detail.sample,{path:s.path,parentId:s.parentId,tentative:s.tentative||!!mismatch});
      if(mismatch)s.issue='详情页与树挂载支系不一致，待核对';else if(oldPeriod&&s.period!==oldPeriod)s.issue=`树中年代原文：${oldPeriod}；详情页显示不同，保留对照`;
      if(s.tentative){j.samples=j.samples.filter(s=>s.au!==au);j.unknown=dedupe([...j.unknown,s]);}else {j.unknown=j.unknown.filter(s=>s.au!==au);j.samples=dedupe([...j.samples,s]);}
      await this.io.set(profileText(`anc.detail.${au}`),{at:this.io.now(),url:s.url,value:detail});
    }else j.failures.push({key:au,message:'源站详情未能确认样本类别或编号'});
    j.details=j.details.filter(s=>s!==au);j.message=`网页同步：剩余 ${j.details.length} 条详情`;await this.save(j);return j;
  }
  async finishSource(id:string,error=''){
    const j:QueryResult=await this.io.get(jobKey(id));if(!j||j.status==='paused')return j;
    if(error)j.failures.push({key:'web-sync',message:error});
    j.complete=!j.queue.length&&!j.details.length&&!j.failures.length&&!j.unknown.length;
    j.status=j.complete?'complete':'partial';j.message=j.complete?'网页同步完成（按源站可加载范围）':'已读取网页，结果尚不完整；可展开源站树后重新同步';j.updatedAt=this.io.now();if(j.complete)await this.cacheResult(j);await this.save(j,false);return j;
  }
  private async request(url:string,c:AbortController){const r=await this.io.request(url,c.signal);if(c.signal.aborted)throw new DOMException('Cancelled','AbortError');if([401,403,429].includes(r.status)||r.url.includes('/user/login'))throw new SyncRequired('源站访问受限，请打开TheYtree正常网页同步');if(r.status!==200)throw Error(`源站返回 HTTP ${r.status}`);if(new URL(r.url).origin!==TY)throw Error('源站跳转到了未授权域名');return r.body;}
  async run(id:string){
    if(this.active.has(id))return;const c=new AbortController();this.active.set(id,c);
    let j:QueryResult=await this.io.get(jobKey(id));if(!j){this.active.delete(id);return;}
    try{
      j.status='running';
      if(j.nodeSnps&&!j.mappingReady){
        const values=searchableSnps(j.nodeSnps,j.marker).filter(value=>needsSnpQuery(j.snpChecks,value));
        let reused=0,checkpointAt=0;
        for(let offset=0;offset<values.length;offset+=16){
          if(c.signal.aborted)return;
          const batch=await Promise.allSettled(values.slice(offset,offset+16).map(async value=>{
            const key=`mofang.snp-search.v1.${value}`;
            const cached=!j.forceRefresh?await this.io.get(key):null;
            if(cached&&cached.check?.snp===value&&this.io.now()-cached.at<TTL){reused++;return rebaseSearch(cached.check,j.nodeSnps!);}
            const page=normalizeTree(JSON.parse(await this.request(snpUrl(value),c)));
            if(!page.valid)throw new SyncRequired(page.reason);
            const check=checkSnp(page,value,j.nodeSnps!,j.marker);
            if(!c.signal.aborted&&(!check.issue||check.candidate)&&JSON.stringify(check).length<100000)await this.io.set(key,{at:this.io.now(),check:rebaseSearch(check,[])});
            return check;
          }));
          if(c.signal.aborted)return;
          let failure:PromiseRejectedResult|undefined;
          for(const result of batch){if(result.status==='fulfilled')j.snpChecks=[...(j.snpChecks||[]).filter(v=>v.snp!==result.value.snp),result.value];else failure??=result;}
          j.message=`正在核对节点SNP：${j.snpChecks?.length||0} / ${j.nodeSnps.length} · 本轮复用 ${reused} 条 · 最多16个请求`;
          if(failure||offset+4>=values.length||this.io.now()-checkpointAt>=300){await this.save(j);checkpointAt=this.io.now();}
          if(failure)throw failure.reason;
          // Yield even on an all-cache batch so a large block cannot monopolize the worker.
          await new Promise(r=>setTimeout(r,0));
        }
        j.snpChecks=sameTreeFilter(j.snpChecks||[],j.marker);
        for(const c of pendingEquivalentCandidates(j.snpChecks||[])){
          const e=await this.io.get(profileText(`anc.equivalent3.${c.id}.${c.marker}`));
          if(!j.forceRefresh&&e&&this.io.now()-e.capturedAt<TTL){
            try{j.snpChecks=applyEquivalent(j.snpChecks||[],equivalentEvidence(c,e.groups,j.nodeSnps!,e.capturedAt,e.method));}catch{/* stale count/format: normal page must refresh */}
          }
        }
        if(!this.resolveMapping(j)){await this.save(j);return;}
      }
      if(!j.branches.length){
        const body=await this.request(queryUrl(j.target),c);let raw:any;try{raw=JSON.parse(body);}catch{throw new SyncRequired('公开树需要正常网页加载，请打开TheYtree同步');}
        const page=normalizeTree(raw);if(!page.valid)throw new SyncRequired(page.reason);this.integrate(j,page);if(c.signal.aborted)return;await this.save(j);if((j as QueryResult).status==='unmatched')return;
      }
      const attempted=new Set<string>();
      while(j.queue.length){
        if(c.signal.aborted)return;const key=j.queue[0];
        if(!/^\d+(?:LOW)?$/.test(key)){j.failures.push({key,message:'动态树节点需要在源站展开后再次同步'});j.queue.shift();continue;}
        if(attempted.has(key)){j.failures.push({key,message:'源站未能确认子树加载完整'});j.queue.shift();continue;}attempted.add(key);
        try{const page=normalizeTree(JSON.parse(await this.request(nodeUrl(key),c)));if(!page.valid)throw new SyncRequired(page.reason);this.integrate(j,page,key);}
        catch(e){if(e instanceof SyncRequired||c.signal.aborted)throw e;j.failures.push({key,message:String(e)});j.queue.shift();}
        j.message=profileText(`已检查 ${j.checked.length} 个节点，发现 ${j.samples.length} 条古样本`);if(c.signal.aborted)return;await this.save(j);
      }
      const pending=[...j.details];let detailCheckpoint=0;
      for(let offset=0;offset<pending.length;offset+=2){
        if(c.signal.aborted)return;
        const ids=pending.slice(offset,offset+2);
        const batch=await Promise.allSettled(ids.map(async au=>{
          const s=[...j.samples,...j.unknown].find(s=>s.au===au);if(!s?.url)return null;
          const key=profileText(`anc.detail.${au}`),cached=await this.io.get(key);
          const fromCache=!j.forceRefresh&&cached&&this.io.now()-cached.at<TTL&&cached.url===s.url;
          const detail=fromCache?cached.value:parseDetail(await this.request(s.url,c),s.url);
          return {key,detail,fromCache:!!fromCache};
        }));
        if(c.signal.aborted)return;
        let restricted:SyncRequired|undefined;
        for(let i=0;i<ids.length;i++){
        const au=ids[i];
        if(c.signal.aborted)return;const s=[...j.samples,...j.unknown].find(s=>s.au===au);if(!s)continue;
        if(!s.url){s.issue=s.issue||'缺少真实详情链接，请在TheYtree打开样本详情后同步';j.failures.push({key:au,message:s.issue});j.details=j.details.filter(a=>a!==au);continue;}
        try{
          const loaded=batch[i];if(loaded.status==='rejected')throw loaded.reason;if(!loaded.value)continue;
          const {key,detail,fromCache}=loaded.value;
          if(detail.type==='modern') {j.samples=j.samples.filter(x=>x.au!==au);j.unknown=j.unknown.filter(x=>x.au!==au);j.excluded++;}
          else if(detail.type!==SAMPLE_KIND||!detail.sample||detail.sample.au!==au){s.issue='详情页类型或编号尚未确认';j.failures.push({key:au,message:s.issue});}
          else{
            const reported=detail.sample.marker;const mismatch=reported&&reported!==s.marker.replace(/\?$/,'');
            const oldPeriod=s.period;Object.assign(s,detail.sample,{parentId:s.parentId,path:s.path,tentative:s.tentative||!!mismatch});
            if(mismatch)s.issue='详情页与树挂载支系不一致，待核对';
            else if(oldPeriod&&s.period&&oldPeriod!==s.period)s.issue=`树中年代原文：${oldPeriod}；详情页显示不同，保留对照`;
            if(s.tentative){j.samples=j.samples.filter(x=>x.au!==au);j.unknown=dedupe([...j.unknown,s]);}
            else if(s.type===SAMPLE_KIND&&j.unknown.some(x=>x.au===au)){j.unknown=j.unknown.filter(x=>x.au!==au);j.samples=dedupe([...j.samples,s]);}
            if(!fromCache)await this.io.set(key,{at:this.io.now(),url:s.url,value:detail});
          }
        }catch(e){if(c.signal.aborted)throw e;if(e instanceof SyncRequired){restricted??=e;continue;}s.issue=String(e);j.failures.push({key:au,message:s.issue});}
        j.details=j.details.filter(x=>x!==au);
        }
        j.message=profileText(`已确认 ${j.samples.length} 条古样本，剩余 ${j.details.length} 条详情 · 最多2条并行`);
        if(c.signal.aborted)return;
        if(restricted||offset+2>=pending.length||this.io.now()-detailCheckpoint>=300){await this.save(j);detailCheckpoint=this.io.now();}
        if(restricted)throw restricted;
        await new Promise(r=>setTimeout(r,0));
      }
      j.complete=!j.queue.length&&!j.details.length&&!j.failures.length&&!j.unknown.length;
      j.status=j.complete?'complete':'partial';j.message=j.complete?'查询完成（按源站可加载范围）':`已发现 ${j.samples.length} 条，结果尚不完整或有待核对记录`;
      j.updatedAt=this.io.now();if(j.complete)await this.cacheResult(j);if(c.signal.aborted)return;await this.save(j,false);
    }catch(e){if(c.signal.aborted)return;j.complete=false;j.status=e instanceof SyncRequired?'sync':'error';j.message=e instanceof Error?e.message:String(e);await this.save(j);}
    finally{if(this.active.get(id)===c)this.active.delete(id);}
  }
}
