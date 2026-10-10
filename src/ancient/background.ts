import {SAMPLE_KIND,STYPE} from './profile';
import {profileText} from './profile';
import {fetchSnpResult} from './snp-result';
import {AncientEngine,RequestGate,jobKey,cacheKey} from './engine';
import {TY,marker,sourceMarker,treeUrl,sourceUrl,normalizeTree,fresh,summary,safeText,paperUrl,type TreePage,type AncientSample} from './model';
import {managedLocalStore,runtimeStore} from '../storage';
const gate:RequestGate=((globalThis as any).__mofangSharedGate??=new RequestGate());
const local=managedLocalStore(),runtime=runtimeStore();
const engine=new AncientEngine({get:key=>local.get(key),set:(key,value)=>local.set(key,value),remove:key=>local.remove(key),request:(url,signal)=>gate.fetch(url,signal),now:()=>Date.now(),id:()=>crypto.randomUUID()});
const ownerKey=(tab:number)=>profileText(`anc.owner.${tab}`);
async function get(key:string):Promise<any>{return runtime.get(key);}
async function maintainStorage(){const values=await runtime.all();await local.maintain(Object.entries(values).filter(([key])=>/^(?:anc|res)\.owner\./.test(key)).map(([,id])=>id).filter((id):id is string=>typeof id==='string'));}
void maintainStorage().catch(error=>console.error('缓存自检失败',error));
const starts=new Map<number,Promise<any>>();
async function startForTab(tab:number,message:any){
  const previous=starts.get(tab)||Promise.resolve();
  const work=previous.catch(()=>{}).then(async()=>{const old=await get(ownerKey(tab));if(old)await engine.pause(old);const j=await engine.start(message.marker,message.scope==='downstream'?'downstream':'direct',!!message.refresh,message.snps);await runtime.set(ownerKey(tab),j.id);await runtime.set(profileText(`anc.parentTab.${j.id}`),tab);if(old&&old!==j.id){await runtime.remove(profileText(`anc.parentTab.${old}`));await engine.release(old);}void maintainStorage().catch(()=>{});return j;});
  starts.set(tab,work);try{return await work;}finally{if(starts.get(tab)===work)starts.delete(tab);}
}
async function owned(id:unknown,sender:chrome.runtime.MessageSender){if(typeof id!=='string'||!sender.tab?.id||await get(ownerKey(sender.tab.id))!==id)throw Error('此页面没有该查询任务');return id;}
function cleanPage(p:TreePage):TreePage {
  if(!p||!Array.isArray(p.branches)||!Array.isArray(p.samples))throw Error('网页同步数据格式错误');
  // Normalize again at the privileged boundary; never persist arbitrary page fields.
  const rows:any[]=p.branches.slice(0,150000).map(b=>({hid:b.id,parent:b.parent,name:b.marker,isParent:b.pending?1:0,equivalent_mutations:{equivalent_count:b.equivalentCount}}));
  for(const s of [...p.samples,...(p.unclassified||[])].slice(0,30000)){
    if(!/^AU\d+$/.test(s.au))continue;
    rows.push({sid:s.au.slice(2),parent:s.parentId,name:s.name,haplogroup:s.marker,stype:s.type===SAMPLE_KIND?STYPE:undefined,sid_encrypted:sourceUrl(s.url)?new URL(s.url).pathname.split('/').at(-1)!.replace('.html',''):'',period:s.period,country:s.country,coverage:s.coverage,average_depth:s.depth});
  }
  // Rendered DOM identifiers are accepted only as local paths; they cannot become
  // network endpoints. Tree fallback results remain partial without detail links.
  const normalized=normalizeTree({code:1,data:{ytree:rows}});
  if(!normalized.branches.length&&p.branches.every(b=>/^tree_\d+$/.test(b.id))){normalized.branches=p.branches.map(b=>({id:b.id,parent:/^tree_\d+$/.test(b.parent)?b.parent:'',marker:safeText(b.marker,100),pending:!!b.pending,tentative:!!b.tentative}));}
  return normalized;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!message?.type?.startsWith(profileText('anc.')))return;
  (async()=>{
    const origin=sender.url?new URL(sender.url).origin:'';const tab=sender.tab?.id;
    if(origin==='https://www.23mofang.com'&&tab!=null){
      if(message.type===profileText('anc.snpLookup'))return fetchSnpResult(message.snp);
      if(message.type===profileText('anc.start')){
        return startForTab(tab,message);
      }
      if(message.type===profileText('anc.counts')){const result:any={};for(const value of (Array.isArray(message.markers)?message.markers:[]).slice(0,600)){const m=marker(value);if(!m)continue;const c=await engine.getBadge(m);if(c)result[m]=c;}return result;}
      const id=await owned(message.id,sender);
      if(message.type===profileText('anc.get'))return engine.get(id);
      if(message.type===profileText('anc.cancel'))return engine.pause(id);
      if(message.type===profileText('anc.release')){await engine.release(id);await runtime.remove([ownerKey(tab),profileText(`anc.parentTab.${id}`)]);void maintainStorage().catch(()=>{});return true;}
      if(message.type===profileText('anc.resume'))return engine.resume(id);
      if(message.type===profileText('anc.backgroundSync')){
        await runtime.remove(profileText(`anc.syncTab.${id}`));
        return engine.backgroundSync(id);
      }
      if(message.type===profileText('anc.sync')){
        const j=await engine.get(id);if(!j)throw Error('任务不存在');
        await engine.pause(id);const waiting=await engine.get(id);if(!waiting)throw Error('任务不存在');waiting.status='sync';waiting.complete=false;waiting.message='等待正常源站网页同步';await engine.save(waiting);
        // Explicit button action opens a normal, visible source page. No bypass,
        // hidden authentication or background tab farming.
        // Old candidate diagnostics must never override a resolved node. Read
        // the paused snapshot so the URL and the task binding use one state.
        const target=waiting.mappingReady?waiting.target:waiting.snpChecks?.find(v=>v.issue&&v.candidate)?.candidate?.marker||waiting.target;
        await runtime.set(profileText(`anc.syncTarget.${id}`),target);
        const opened=await chrome.tabs.create({url:treeUrl(target),active:true});
        if(opened.id==null)throw Error('无法打开源站页面');
        await runtime.set(profileText(`anc.sync.${opened.id}`),id);await runtime.set(profileText(`anc.syncTab.${id}`),opened.id);return {opened:true};
      }
    }
    if(origin===TY&&tab!=null){
      const id=await get(profileText(`anc.sync.${tab}`));
      const parent=id?await get(profileText(`anc.parentTab.${id}`)):null;
      const bound=id&&await get(profileText(`anc.syncTab.${id}`))===tab&&parent!=null&&await get(ownerKey(parent))===id;
      if(message.type===profileText('anc.sourceContext'))return bound?engine.get(id):null;
      if(!bound)throw Error('这个源站页面的同步任务已失效');
      const j=await engine.get(id);if(!j||sourceMarker(new URL(sender.url!).pathname)!==(await get(profileText(`anc.syncTarget.${id}`))||j.target))throw Error('源站支系与查询不一致');
      if(message.type===profileText('anc.sourceBegin'))return engine.beginSource(id);
      if(message.type===profileText('anc.sourceUnmatched')){
        const p=cleanPage(message.page);if(!p.valid||p.branches.some(b=>!b.tentative&&b.marker===j.marker))throw Error('尚不能确认同名节点缺失');
        return engine.sourceUnmatched(id,safeText(message.mappingToken,100));
      }
      if(message.type===profileText('anc.sourceProblem'))return engine.sourceProblem(id,safeText(message.error,500),safeText(message.mappingToken,100));
      if([profileText('anc.sourceSnp'),profileText('anc.sourceEquivalent')].includes(message.type)&&(!j.mappingToken||j.mappingToken!==message.mappingToken))throw Error('SNP核对已暂停或过期');
      if(message.type===profileText('anc.sourceEquivalent'))return engine.sourceEquivalent(id,safeText(message.candidateId,100),message.groups,message.method==='visible-dialog'?'visible-dialog':'authenticated-page',message.mappingToken);
      if(message.type===profileText('anc.sourceSnp'))return engine.sourceSnp(id,safeText(message.snp,100),cleanPage(message.page));
      if(message.type===profileText('anc.source')){
        if(j.nodeSnps&&!j.mappingReady)throw Error('请先完成节点全部SNP核对');
        const p=cleanPage(message.page);if(!p.valid||!p.branches.some(b=>b.marker===j.target))throw Error('尚未读取到对应树节点');
        return engine.adopt(id,p);
      }
      if(!j.syncToken||message.syncToken!==j.syncToken)throw Error('该网页同步已暂停或过期，请重新同步');
      if(message.type===profileText('anc.sourceExpand'))return engine.sourceExpand(id,cleanPage(message.page),safeText(message.node,100));
      if(message.type===profileText('anc.sourceFinish'))return engine.finishSource(id,safeText(message.error,300));
      if(message.type===profileText('anc.sourceDetail')){
        const d=message.detail;let sample:Partial<AncientSample>|null=null;
        if(d?.type===SAMPLE_KIND&&d.sample){
          const input=d.sample;sample={};
          for(const k of ['au','name','marker','country','place','culture','period','paper','typeEvidence'] as const)sample[k]=safeText(input[k]);
          sample.url=sourceUrl(input.url);sample.paperUrl=paperUrl(input.paperUrl);sample.type=SAMPLE_KIND;sample.detail=true;sample.issue='';
          sample.coverage=typeof input.coverage==='number'&&input.coverage>=0&&input.coverage<=1?input.coverage:null;
          sample.depth=typeof input.depth==='number'&&input.depth>=0?input.depth:null;
          const expected=[...j.samples,...j.unknown].find(s=>s.au===message.au);
          if(!expected||expected.url!==sample.url)throw Error('样本来源链接不匹配');
        }
        return engine.sourceDetail(id,safeText(message.au,40),{type:d?.type===SAMPLE_KIND?SAMPLE_KIND:d?.type==='modern'?'modern':'unknown',sample});
      }
    }
    throw Error(profileText('不允许的古DNA消息'));
  })().then(value=>reply({ok:true,value}),error=>reply({ok:false,error:error instanceof Error?error.message:String(error)}));
  return true;
});
chrome.tabs.onRemoved?.addListener(tab=>{void (async()=>{
  const sourceId=await get(profileText(`anc.sync.${tab}`));if(sourceId){await runtime.remove([profileText(`anc.sync.${tab}`),profileText(`anc.syncTab.${sourceId}`)]);}
  const id=await get(ownerKey(tab));if(!id)return;const sourceTab=await get(profileText(`anc.syncTab.${id}`));await engine.release(id);await runtime.remove([ownerKey(tab),profileText(`anc.parentTab.${id}`),profileText(`anc.syncTarget.${id}`),profileText(`anc.syncTab.${id}`),...(Number.isInteger(sourceTab)?[profileText(`anc.sync.${sourceTab}`)]:[])]);
})().catch(error=>console.error(profileText('清理古DNA会话失败'),error));});
