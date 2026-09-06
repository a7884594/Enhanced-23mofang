import {profileText} from './profile';
import {A_CHANNEL,TY,sourceMarker,queryUrl,nodeUrl,normalizeTree,sourceUrl,type TreePage,type QueryResult} from './model';
import {equivalentUrl,equivalentEvidence,dialogGroups,pendingEquivalentCandidates} from './equivalent';
import {snpUrl,needsSnpQuery,searchableSnps} from './snps';
import {parseDetail,parseTreeDOM} from './parser';
async function send(message:any){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw Error(r?.error||'扩展通信失败');return r.value;}
let rendered:TreePage|null=null;let running=false;let text:HTMLElement|null=null;
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.channel===A_CHANNEL&&event.data?.type==='source-tree'&&event.data.marker===sourceMarker(location.pathname))rendered=event.data.page;});
let nextRequest=0;
async function fetchPage(url:string){
  const u=new URL(url);if(u.origin!==TY||!(sourceUrl(url)||u.pathname==='/api/ysnp/theytree/'||u.pathname==='/api/ysnp/theytree/node/'||u.pathname==='/api/ysnp/theytree/getEquivalentMutationsDetail'))throw Error('无效源站地址');
  const wait=Math.max(0,nextRequest-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));nextRequest=Date.now()+500;
  const r=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(25000)});
  if(!r.ok||new URL(r.url).origin!==TY||r.url.includes('/user/login'))throw Error(`源站需要正常访问（HTTP ${r.status}），请在网页处理后再次同步`);
  return r.text();
}
async function synchronize(force=false){
  if(running)return;running=true;
  let syncToken='';let mappingToken='';
  try{
    let job:QueryResult=await send({type:profileText('anc.sourceContext')});if(!job)return;
    if(job.status==='paused'&&!force){text!.textContent='查询已暂停；可点击“重新同步当前树”继续';return;}
    job=await send({type:profileText('anc.sourceBegin')});mappingToken=job.mappingToken||'';
    text!.textContent='正在读取当前TheYtree树…';
    window.postMessage({channel:A_CHANNEL,type:'read-source'},location.origin);
    await new Promise(r=>setTimeout(r,350));
    if(job.nodeSnps&&!job.mappingReady){
      for(const value of searchableSnps(job.nodeSnps,job.marker)){
        if(!needsSnpQuery(job.snpChecks,value))continue;
        const state=await send({type:profileText('anc.sourceContext')});if(state?.status==='paused')return;
        const p=normalizeTree(JSON.parse(await fetchPage(snpUrl(value))));if(!p.valid)throw Error(p.reason);
        job=await send({type:profileText('anc.sourceSnp'),snp:value,page:p,mappingToken});
        text!.textContent=`SNP核对 ${job.snpChecks?.length} / ${job.nodeSnps!.length}`;
      }
      const candidates=pendingEquivalentCandidates(job.snpChecks||[]);
      for(const c of candidates){
        const state=await send({type:profileText('anc.sourceContext')});if(state?.mappingToken!==mappingToken||state.status==='paused')return;
        if(state.mappingReady){job=state;break;}
        text!.textContent=`正在读取 ${c.marker} 的等价SNP列表（使用本页正常登录状态）…`;
        let groups:unknown;let method:'authenticated-page'|'visible-dialog'='authenticated-page';
        try{
          const response=JSON.parse(await fetchPage(equivalentUrl(c)));
          if(response.code!==1||!Array.isArray(response.data?.equivalent_snps))throw Error('请先在TheYtree正常登录，再点击“重新同步当前树”。也可打开节点的 +N SNPs 弹窗后同步。');
          groups=response.data.equivalent_snps;
        }catch(error){
          const modal=document.querySelector<HTMLElement>('#equivalentMutationsModal');
          const visible=modal&&modal.getBoundingClientRect().height>0;
          groups=visible?dialogGroups(document,c):null;if(!groups)throw error;method='visible-dialog';
        }
        equivalentEvidence(c,groups,job.nodeSnps!,Date.now(),method);
        job=await send({type:profileText('anc.sourceEquivalent'),candidateId:c.id,groups,method,mappingToken});
      }
      if(!job.mappingReady)throw Error(job.message);
    }
    let page=sourceMarker(location.pathname)===job.target?rendered:null;
    if(!page?.valid){try{page=normalizeTree(JSON.parse(await fetchPage(queryUrl(job.target))));}catch{page=parseTreeDOM(document);}}
    if(!page?.valid)throw Error('树尚未加载，请稍后点击同步');
    if(!job.nodeSnps&&job.target===job.marker&&!page.branches.some(b=>!b.tentative&&b.marker===job.marker)){
      job=await send({type:profileText('anc.sourceUnmatched'),page,mappingToken});text!.textContent=job.message;return;
    }
    job=await send({type:profileText('anc.source'),page});
    syncToken=job.syncToken||'';
    const tried=new Set<string>();
    while(job.queue.length){
      const n=job.queue[0];if(!/^\d+(?:LOW)?$/.test(n)||tried.has(n))break;tried.add(n);
      const state=await send({type:profileText('anc.sourceContext')});if(state?.status==='paused'){text!.textContent='查询已在23魔方暂停';return;}
      const p=normalizeTree(JSON.parse(await fetchPage(nodeUrl(n))));if(!p.valid)throw Error(p.reason);
      job=await send({type:profileText('anc.sourceExpand'),page:p,node:n,syncToken});
    }
    for(const s of [...job.samples,...job.unknown].filter(s=>!s.detail&&s.url)){
      const state=await send({type:profileText('anc.sourceContext')});if(state?.status==='paused'){text!.textContent='查询已在23魔方暂停';return;}
      const detail=parseDetail(await fetchPage(s.url),s.url);
      job=await send({type:profileText('anc.sourceDetail'),au:s.au,detail,syncToken});
      text!.textContent=`正在同步 ${job.target}：已确认 ${job.samples.length} 条，剩余 ${job.details.length} 条详情`;
    }
    job=await send({type:profileText('anc.sourceFinish'),syncToken});text!.textContent=`${job.message}。请回到23魔方查看。`;
  }catch(e){if(text)text.textContent=e instanceof Error?e.message:String(e);try{await send(syncToken?{type:profileText('anc.sourceFinish'),error:String(e),syncToken}:{type:profileText('anc.sourceProblem'),error:String(e),mappingToken});}catch{}}
  finally{running=false;}
}
let tries=0;
const timer=setInterval(async()=>{
  if(!sourceMarker(location.pathname)||++tries>16){clearInterval(timer);return;}
  try{const job=await send({type:profileText('anc.sourceContext')});if(!job)return;clearInterval(timer);
    const host=document.createElement('div');host.id=profileText('mofang-ancient-sync');const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=profileText('<style>:host{display:block;position:sticky;top:0;z-index:100000}section{background:#f6f1e8;border-bottom:1px solid #cfbd9f;padding:12px 20px;display:flex;align-items:center;gap:14px;font:14px/1.5 sans-serif;color:#634b2b}button{padding:7px 14px;border:1px solid #b69660;border-radius:6px;background:white;color:#634b2b;cursor:pointer}</style><section><b>23魔方 · 古DNA同步</b><span>等待树加载</span><button>重新同步当前树</button></section>');
    document.body.prepend(host);text=shadow.querySelector('span');shadow.querySelector('button')!.onclick=()=>void synchronize(true);void synchronize();
  }catch{/* The owner may not have finished binding this newly opened tab yet. */}
},500);
