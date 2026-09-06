import {A_CHANNEL,TY,sourceMarker,queryUrl,nodeUrl,normalizeTree,sourceUrl,type TreePage,type QueryResult} from './model';
import {parseDetail,parseTreeDOM} from './parser';
async function send(message:any){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw Error(r?.error||'扩展通信失败');return r.value;}
let rendered:TreePage|null=null;let running=false;let text:HTMLElement|null=null;
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.channel===A_CHANNEL&&event.data?.type==='source-tree'&&event.data.marker===sourceMarker(location.pathname))rendered=event.data.page;});
let nextRequest=0;
async function fetchPage(url:string){
  const u=new URL(url);if(u.origin!==TY||!(sourceUrl(url)||u.pathname==='/api/ysnp/theytree/'||u.pathname==='/api/ysnp/theytree/node/'))throw Error('无效源站地址');
  const wait=Math.max(0,nextRequest-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));nextRequest=Date.now()+500;
  const r=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(25000)});
  if(!r.ok||new URL(r.url).origin!==TY||r.url.includes('/user/login'))throw Error(`源站需要正常访问（HTTP ${r.status}），请在网页处理后再次同步`);
  return r.text();
}
async function synchronize(force=false){
  if(running)return;running=true;
  let syncToken='';
  try{
    let job:QueryResult=await send({type:'anc.sourceContext'});if(!job)return;
    if(job.status==='paused'&&!force){text!.textContent='查询已暂停；可点击“重新同步当前树”继续';return;}
    text!.textContent='正在读取当前TheYtree树…';
    window.postMessage({channel:A_CHANNEL,type:'read-source'},location.origin);
    await new Promise(r=>setTimeout(r,350));
    let page=rendered;
    if(!page?.valid){try{page=normalizeTree(JSON.parse(await fetchPage(queryUrl(job.target))));}catch{page=parseTreeDOM(document);}}
    if(!page?.valid)throw Error('树尚未加载，请稍后点击同步');
    job=await send({type:'anc.source',page});
    syncToken=job.syncToken||'';
    const tried=new Set<string>();
    while(job.queue.length){
      const n=job.queue[0];if(!/^\d+(?:LOW)?$/.test(n)||tried.has(n))break;tried.add(n);
      const state=await send({type:'anc.sourceContext'});if(state?.status==='paused'){text!.textContent='查询已在23魔方暂停';return;}
      const p=normalizeTree(JSON.parse(await fetchPage(nodeUrl(n))));if(!p.valid)throw Error(p.reason);
      job=await send({type:'anc.sourceExpand',page:p,node:n,syncToken});
    }
    for(const s of [...job.samples,...job.unknown].filter(s=>!s.detail&&s.url)){
      const state=await send({type:'anc.sourceContext'});if(state?.status==='paused'){text!.textContent='查询已在23魔方暂停';return;}
      const detail=parseDetail(await fetchPage(s.url),s.url);
      job=await send({type:'anc.sourceDetail',au:s.au,detail,syncToken});
      text!.textContent=`正在同步 ${job.target}：已确认 ${job.samples.length} 条，剩余 ${job.details.length} 条详情`;
    }
    job=await send({type:'anc.sourceFinish',syncToken});text!.textContent=`${job.message}。请回到23魔方查看。`;
  }catch(e){if(text)text.textContent=e instanceof Error?e.message:String(e);try{await send({type:'anc.sourceFinish',error:String(e),syncToken});}catch{}}
  finally{running=false;}
}
let tries=0;
const timer=setInterval(async()=>{
  if(!sourceMarker(location.pathname)||++tries>16){clearInterval(timer);return;}
  try{const job=await send({type:'anc.sourceContext'});if(!job)return;clearInterval(timer);
    const host=document.createElement('div');host.id='mofang-ancient-sync';const shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML='<style>:host{display:block;position:sticky;top:0;z-index:100000}section{background:#f6f1e8;border-bottom:1px solid #cfbd9f;padding:12px 20px;display:flex;align-items:center;gap:14px;font:14px/1.5 sans-serif;color:#634b2b}button{padding:7px 14px;border:1px solid #b69660;border-radius:6px;background:white;color:#634b2b;cursor:pointer}</style><section><b>23魔方 · 古DNA同步</b><span>等待树加载</span><button>重新同步当前树</button></section>';
    document.body.prepend(host);text=shadow.querySelector('span');shadow.querySelector('button')!.onclick=()=>void synchronize(true);void synchronize();
  }catch{/* The owner may not have finished binding this newly opened tab yet. */}
},500);
