import {TY,TTL,marker,sourceUrl,queryUrl,nodeUrl,normalizeTree,selectSamples,pathToRoot,dedupe,fresh,type QueryResult,type TreePage,type AncientSample} from './model';
import {parseDetail} from './parser';
import {snps,checkSnp,snpUrl,mappingTarget} from './snps';
import {equivalentEvidence,applyEquivalent,disambiguate,type EquivalentEvidence} from './equivalent';
import {resolveTarget} from './aliases';
export interface IO {get(key:string):Promise<any>;set(key:string,value:any):Promise<void>;request(url:string,signal:AbortSignal):Promise<{status:number;url:string;body:string}>;now():number;id():string}
export class SyncRequired extends Error{}
export const jobKey=(id:string)=>`anc.job.${id}`;
export const cacheKey=(m:string,s:string)=>`anc.cache.fast4.${m}.${s}`;
/** Per-worker global request queue: single concurrency and >=500ms between starts. */
export class RequestGate {
  private tail:Promise<any>=Promise.resolve();private next=0;
  fetch(url:string,signal:AbortSignal){
    const work=this.tail.catch(()=>{}).then(async()=>{
      const wait=Math.max(0,this.next-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
      if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      this.next=Date.now()+500;
      const timeout=AbortSignal.timeout(25000);const control=new AbortController();
      const abort=()=>control.abort();signal.addEventListener('abort',abort,{once:true});timeout.addEventListener('abort',abort,{once:true});
      try{const response=await fetch(url,{credentials:'omit',signal:control.signal,redirect:'follow',referrerPolicy:'no-referrer'});return {status:response.status,url:response.url,body:await response.text()};}
      finally{signal.removeEventListener('abort',abort);timeout.removeEventListener('abort',abort);}
    });this.tail=work;return work;
  }
}
export class AncientEngine {
  private active=new Map<string,AbortController>();
  constructor(private io:IO){}
  async save(job:QueryResult){job.updatedAt=this.io.now();await this.io.set(jobKey(job.id),job);if(!job.complete&&job.status!=='unmatched')await this.io.set(`anc.pending.fast4.${job.marker}.${job.scope}`,job.id);}
  async get(id:string):Promise<QueryResult|null>{const j=await this.io.get(jobKey(id));if(j?.status==='running'&&!this.active.has(id)){j.status='paused';j.message='后台任务已暂停，可继续查询';await this.save(j);}return j||null;}
  async start(name:string,scope:'direct'|'downstream',refresh=false,values?:unknown):Promise<QueryResult>{
    const m=marker(name);if(!m)throw Error('无效支系标记');const nodeSnps=values===undefined?undefined:snps(values);if(nodeSnps&&!nodeSnps.length)throw Error('尚未读取到节点SNP列表，请等待树加载后重试');
    if(!refresh){const cached=await this.io.get(cacheKey(m,scope));if(cached&&fresh(cached,this.io.now())&&(values===undefined||JSON.stringify(cached.nodeSnps)===JSON.stringify(nodeSnps))){const copy={...cached,id:this.io.id(),cached:true};await this.io.set(jobKey(copy.id),copy);return copy;}}
    const resolved=resolveTarget(m);
    if(!refresh){
      const pendingId=await this.io.get(`anc.pending.fast4.${m}.${scope}`);const pending=pendingId?await this.io.get(jobKey(pendingId)):null;
      if(pending&&!pending.complete&&pending.status!=='unmatched'&&(values===undefined||JSON.stringify(pending.nodeSnps)===JSON.stringify(nodeSnps))&&this.io.now()-pending.createdAt<TTL&&!this.active.has(pending.id)){
        // Give the reopened page its own task ID; a tab restored after browser
        // restart must not need the previous tab ID to find its checkpoint.
        const recovered:QueryResult={...pending,id:this.io.id(),status:'paused',syncToken:'',cached:false,message:'找到未完成的查询，点击“继续查询”恢复，或打开TheYtree同步'};await this.save(recovered);return recovered;
      }
    }
    const job:QueryResult={id:this.io.id(),marker:m,...resolved,nodeSnps,snpChecks:[],mappingReady:!nodeSnps,scope,status:'running',createdAt:this.io.now(),updatedAt:this.io.now(),cached:false,forceRefresh:refresh,complete:false,samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],excluded:0,message:'正在读取TheYtree公开树'};
    await this.save(job);void this.run(job.id);return job;
  }
  async pause(id:string){this.active.get(id)?.abort();this.active.delete(id);const j=await this.io.get(jobKey(id));if(j&&j.status!=='complete'){j.status='paused';j.syncToken='';j.mappingToken='';j.message='查询已暂停，已取得的结果保留';await this.save(j);}return j;}
  async resume(id:string){const j=await this.io.get(jobKey(id));if(!j)throw Error('任务不存在');if(this.active.has(id))return j;j.status='running';j.syncToken='';j.mappingToken='';j.failures=[];j.details=[...j.samples,...j.unknown].filter((s:AncientSample)=>!s.detail).map((s:AncientSample)=>s.au);j.queue=j.branches.filter((b:any)=>b.pending&&!j.checked.includes(b.id)).map((b:any)=>b.id);j.message='继续查询';await this.save(j);void this.run(id);return j;}
  private integrate(j:QueryResult,page:TreePage,requested?:string){
    const map=new Map(j.branches.map(b=>[b.id,b]));for(const b of page.branches)map.set(b.id,b);
    if(requested&&map.has(requested)&&page.branches.length+page.samples.length+page.unclassified.length+page.excluded>0)map.set(requested,{...map.get(requested)!,pending:false});
    j.branches=[...map.values()];
    const root=j.branches.find(b=>!b.tentative&&b.marker===j.target);
    if(!root){j.status='unmatched';j.message='TheYtree返回的树中未找到同名节点，未使用上游节点替代';return;}
    const combined:TreePage={...page,branches:j.branches,samples:dedupe([...j.samples,...page.samples]),unclassified:dedupe([...j.unknown,...page.unclassified])};
    const selected=selectSamples(combined,root,j.scope);
    const conflicts=selected.samples.filter(s=>s.tentative||s.issue.includes('多个挂载'));
    j.samples=selected.samples.filter(s=>!conflicts.includes(s));j.unknown=dedupe([...selected.unknown,...conflicts]);
    const relevant=j.branches.filter(b=>{const p=pathToRoot(b.id,root.id,j.branches);return p&&(j.scope==='downstream'||b.id===root.id||p.length===2&&b.tentative);});
    j.checked=[...new Set([...j.checked,...relevant.filter(b=>!b.pending).map(b=>b.id)])];
    j.queue=relevant.filter(b=>b.pending&&!j.checked.includes(b.id)).map(b=>b.id);
    j.details=[...j.samples,...j.unknown].filter(s=>!s.detail).map(s=>s.au);
    j.excluded=Math.max(j.excluded,page.excluded);
  }
  private resolveMapping(j:QueryResult){
    const checks=disambiguate(j.snpChecks||[],j.marker);j.snpChecks=checks;const target=mappingTarget(checks);
    if(!target||checks.some(v=>v.issue)){
      j.status=checks.some(v=>v.issue&&v.candidate&&!v.evidence)?'sync':checks.some(v=>v.target||v.issue)?'partial':'unmatched';j.complete=false;
      j.message=checks.some(v=>v.target||v.issue)?'SNP对应存在分歧或缺少交叉依据，未自动合并样本':'节点全部SNP均未找到可核实对应';
      if(j.status==='sync')j.message='需登录TheYtree核对候选节点的等价SNP列表；打开源站同步后继续';
      j.mapping='完整SNP核对尚未建立唯一对应';return false;
    }
    j.target=target;j.mappingReady=true;
    j.mapping=`${j.marker} → ${target} · ${checks.some(v=>v.evidence)?'两站SNP列表交叉对应':'节点SNP交叉对应'}，挂载关系以TheYtree为准`;
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
    if(j.nodeSnps.every(s=>j.snpChecks!.some(v=>v.snp===s)))this.resolveMapping(j);
    await this.io.set(`anc.equivalent3.${c.id}.${c.marker}`,evidence);await this.save(j);return j;
  }
  async sourceSnp(id:string,value:string,page:TreePage){
    const j:QueryResult=await this.io.get(jobKey(id));
    if(!j||j.status==='paused'||!j.nodeSnps?.includes(value)||j.mappingReady)throw Error('SNP同步任务已过期');
    j.snpChecks=[...(j.snpChecks||[]).filter(v=>v.snp!==value),checkSnp(page,value,j.nodeSnps)];
    if(j.nodeSnps.every(s=>j.snpChecks!.some(v=>v.snp===s)))this.resolveMapping(j);
    j.message=j.mappingReady?'SNP对应已确认，正在读取古DNA':j.message;
    await this.save(j);return j;
  }
  async adopt(id:string,page:TreePage){
    await this.pause(id);const j=await this.io.get(jobKey(id));if(!j)throw Error('任务不存在');
    if(j.nodeSnps&&!j.mappingReady)throw Error('节点SNP尚未建立唯一对应');
    // DOM and API node IDs must not be mixed. A normal page sync is a new tree
    // snapshot, while already fetched ancient detail fields remain cacheable.
    j.branches=[];j.checked=[];j.samples=[];j.unknown=[];j.failures=[];j.syncToken=this.io.id();
    this.integrate(j,page);if(j.status!=='unmatched'){j.status='sync';j.message='已读取正常网页，正在补全古DNA详情';}
    await this.save(j);return j;
  }
  async sourceExpand(id:string,page:TreePage,node:string){const j=await this.io.get(jobKey(id));if(!j||j.status==='paused')return j;if(!j.queue.includes(node))throw Error('不是当前任务的待查节点');this.integrate(j,page,node);await this.save(j);return j;}
  async sourceDetail(id:string,au:string,detail:ReturnType<typeof parseDetail>){
    const j:QueryResult=await this.io.get(jobKey(id));if(!j||j.status==='paused')return j;
    const s=[...j.samples,...j.unknown].find(s=>s.au===au);if(!s)throw Error('样本不在当前查询范围');
    if(detail.type==='modern'){j.samples=j.samples.filter(s=>s.au!==au);j.unknown=j.unknown.filter(s=>s.au!==au);j.excluded++;}
    else if(detail.type==='ancient'&&detail.sample?.au===au){
      const mismatch=detail.sample.marker&&detail.sample.marker!==s.marker.replace(/\?$/,'');const oldPeriod=s.period;
      Object.assign(s,detail.sample,{path:s.path,parentId:s.parentId,tentative:s.tentative||!!mismatch});
      if(mismatch)s.issue='详情页与树挂载支系不一致，待核对';else if(oldPeriod&&s.period!==oldPeriod)s.issue=`树中年代原文：${oldPeriod}；详情页显示不同，保留对照`;
      if(s.tentative){j.samples=j.samples.filter(s=>s.au!==au);j.unknown=dedupe([...j.unknown,s]);}else {j.unknown=j.unknown.filter(s=>s.au!==au);j.samples=dedupe([...j.samples,s]);}
      await this.io.set(`anc.detail.${au}`,{at:this.io.now(),url:s.url,value:detail});
    }else j.failures.push({key:au,message:'源站详情未能确认样本类别或编号'});
    j.details=j.details.filter(s=>s!==au);j.message=`网页同步：剩余 ${j.details.length} 条详情`;await this.save(j);return j;
  }
  async finishSource(id:string,error=''){
    const j:QueryResult=await this.io.get(jobKey(id));if(!j||j.status==='paused')return j;
    if(error)j.failures.push({key:'web-sync',message:error});
    j.complete=!j.queue.length&&!j.details.length&&!j.failures.length&&!j.unknown.length;
    j.status=j.complete?'complete':'partial';j.message=j.complete?'网页同步完成（按源站可加载范围）':'已读取网页，结果尚不完整；可展开源站树后重新同步';await this.save(j);if(j.complete)await this.io.set(cacheKey(j.marker,j.scope),j);return j;
  }
  private async request(url:string,c:AbortController){const r=await this.io.request(url,c.signal);if(c.signal.aborted)throw new DOMException('Cancelled','AbortError');if([401,403,429].includes(r.status)||r.url.includes('/user/login'))throw new SyncRequired('源站访问受限，请打开TheYtree正常网页同步');if(r.status!==200)throw Error(`源站返回 HTTP ${r.status}`);if(new URL(r.url).origin!==TY)throw Error('源站跳转到了未授权域名');return r.body;}
  async run(id:string){
    if(this.active.has(id))return;const c=new AbortController();this.active.set(id,c);
    let j:QueryResult=await this.io.get(jobKey(id));if(!j){this.active.delete(id);return;}
    try{
      j.status='running';
      if(j.nodeSnps&&!j.mappingReady){
        for(const value of j.nodeSnps){
          if(j.snpChecks?.some(v=>v.snp===value))continue;
          const key=`anc.snp3.${j.nodeSnps.join(',')}.${value}`;
          const cached=await this.io.get(key);
          let check;
          if(!j.forceRefresh&&cached&&this.io.now()-cached.at<TTL)check=cached.check;
          else {
            const page=normalizeTree(JSON.parse(await this.request(snpUrl(value),c)));
            if(!page.valid)throw new SyncRequired(page.reason);
            check=checkSnp(page,value,j.nodeSnps);
            if(!check.issue)await this.io.set(key,{at:this.io.now(),check});
          }
          if(c.signal.aborted)return;
          (j.snpChecks??=[]).push(check);
          j.message=`正在核对节点SNP：${j.snpChecks.length} / ${j.nodeSnps.length}`;
          if(c.signal.aborted)return;await this.save(j);
        }
        for(const check of j.snpChecks||[]){
          if(!check.issue||!check.candidate)continue;
          const c=check.candidate;const e=await this.io.get(`anc.equivalent3.${c.id}.${c.marker}`);
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
        j.message=`已检查 ${j.checked.length} 个节点，发现 ${j.samples.length} 条古样本`;if(c.signal.aborted)return;await this.save(j);
      }
      const pending=[...j.details];
      for(const au of pending){
        if(c.signal.aborted)return;const s=[...j.samples,...j.unknown].find(s=>s.au===au);if(!s)continue;
        if(!s.url){s.issue=s.issue||'缺少真实详情链接，请在TheYtree打开样本详情后同步';j.failures.push({key:au,message:s.issue});j.details=j.details.filter(a=>a!==au);continue;}
        try{
          const key=`anc.detail.${au}`;const cached=await this.io.get(key);
          const detail=!j.forceRefresh&&cached&&this.io.now()-cached.at<TTL&&cached.url===s.url?cached.value:parseDetail(await this.request(s.url,c),s.url);
          if(detail.type==='modern') {j.samples=j.samples.filter(x=>x.au!==au);j.unknown=j.unknown.filter(x=>x.au!==au);j.excluded++;}
          else if(detail.type!=='ancient'||!detail.sample||detail.sample.au!==au){s.issue='详情页类型或编号尚未确认';j.failures.push({key:au,message:s.issue});}
          else{
            const reported=detail.sample.marker;const mismatch=reported&&reported!==s.marker.replace(/\?$/,'');
            const oldPeriod=s.period;Object.assign(s,detail.sample,{parentId:s.parentId,path:s.path,tentative:s.tentative||!!mismatch});
            if(mismatch)s.issue='详情页与树挂载支系不一致，待核对';
            else if(oldPeriod&&s.period&&oldPeriod!==s.period)s.issue=`树中年代原文：${oldPeriod}；详情页显示不同，保留对照`;
            if(s.tentative){j.samples=j.samples.filter(x=>x.au!==au);j.unknown=dedupe([...j.unknown,s]);}
            else if(s.type==='ancient'&&j.unknown.some(x=>x.au===au)){j.unknown=j.unknown.filter(x=>x.au!==au);j.samples=dedupe([...j.samples,s]);}
            await this.io.set(key,{at:this.io.now(),url:s.url,value:detail});
          }
        }catch(e){if(e instanceof SyncRequired||c.signal.aborted)throw e;s.issue=String(e);j.failures.push({key:au,message:s.issue});}
        j.details=j.details.filter(x=>x!==au);j.message=`已确认 ${j.samples.length} 条古样本，剩余 ${j.details.length} 条详情`;if(c.signal.aborted)return;await this.save(j);
      }
      j.complete=!j.queue.length&&!j.details.length&&!j.failures.length&&!j.unknown.length;
      j.status=j.complete?'complete':'partial';j.message=j.complete?'查询完成（按源站可加载范围）':`已发现 ${j.samples.length} 条，结果尚不完整或有待核对记录`;
      await this.save(j);
      if(j.complete)await this.io.set(cacheKey(j.marker,j.scope),j);
    }catch(e){if(c.signal.aborted)return;j.complete=false;j.status=e instanceof SyncRequired?'sync':'error';j.message=e instanceof Error?e.message:String(e);await this.save(j);}
    finally{if(this.active.get(id)===c)this.active.delete(id);}
  }
}
