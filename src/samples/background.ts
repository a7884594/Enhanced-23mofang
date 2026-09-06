import {RequestGate,type IO} from '../ancient/engine';
import {query} from './service';
const gate:RequestGate=((globalThis as any).__mofangSharedGate??=new RequestGate());
let writes:Promise<unknown>=Promise.resolve();
async function save(key:string,value:any){
  if(!key.startsWith('samples.v2.')){await chrome.storage.local.set({[key]:value});return;}
  const work=writes.catch(()=>{}).then(async()=>{
    const bytes=new TextEncoder().encode(JSON.stringify(value)).length;if(bytes>4_000_000)throw Error('样本结果过大，请查询更小支系');
    const stored=(await chrome.storage.local.get('samples.cacheIndex'))['samples.cacheIndex'];
    let index: {key:string;bytes:number;at:number}[]=Array.isArray(stored)?stored.filter(x=>typeof x?.key==='string'&&Number.isFinite(x.bytes)&&Number.isFinite(x.at)):[];
    index=index.filter(x=>x.key!==key&&/^samples\.v[12]\./.test(x.key)).sort((a,b)=>a.at-b.at);const removed:string[]=[];
    while(index.length>=20||index.reduce((sum,x)=>sum+x.bytes,0)+bytes>4_000_000){const old=index.shift();if(!old)break;removed.push(old.key);}
    if(removed.length)await chrome.storage.local.remove(removed);index.push({key,bytes,at:Date.now()});await chrome.storage.local.set({[key]:value,'samples.cacheIndex':index});
  });writes=work;await work;
}
const io:IO={get:async key=>(await chrome.storage.local.get(key))[key],set:save,request:(url,signal)=>gate.fetch(url,signal),now:()=>Date.now(),id:()=>crypto.randomUUID()};
const active=new Map<number,{token:string;controls:Set<AbortController>}>();
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(!m?.type?.startsWith('samples.'))return;
  (async()=>{
    if(!sender.url||new URL(sender.url).origin!=='https://www.23mofang.com'||sender.tab?.id==null)throw Error('仅23魔方页面可发起查询');
    const tab=sender.tab.id;
    if(m.type==='samples.begin'){for(const c of active.get(tab)?.controls||[])c.abort();const token=crypto.randomUUID();active.set(tab,{token,controls:new Set()});return {token};}
    const task=active.get(tab);if(!task||m.token!==task.token)throw Error('查询已切换或取消');
    if(m.type==='samples.cancel'){for(const c of task.controls)c.abort();active.delete(tab);return true;}
    if(m.type!=='samples.query')throw Error('未知请求');
    if(task.controls.size>=3)throw Error('当前请求尚未完成');const c=new AbortController();task.controls.add(c);
    try{return await query(io,m.provider,m.marker,!!m.refresh,c.signal,!!m.more);}finally{task.controls.delete(c);}
  })().then(value=>reply({ok:true,value}),error=>reply({ok:false,error:String(error)}));return true;
});
chrome.tabs.onRemoved.addListener(tab=>{for(const c of active.get(tab)?.controls||[])c.abort();active.delete(tab);});
