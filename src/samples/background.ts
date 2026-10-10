import {RequestGate,type IO} from '../ancient/engine';
import {query} from './service';
import {nearest} from './nearest';
import {SampleSessions} from './sessions';
import {managedLocalStore} from '../storage';
const gate:RequestGate=((globalThis as any).__mofangSharedGate??=new RequestGate());
const local=managedLocalStore();
const io:IO={get:key=>local.get(key),set:(key,value)=>local.set(key,value),remove:key=>local.remove(key),request:(url,signal)=>gate.fetch(url,signal),now:()=>Date.now(),id:()=>crypto.randomUUID()};
const sessions=new SampleSessions({get:async key=>(await chrome.storage.session.get(key))[key],set:(key,value)=>chrome.storage.session.set({[key]:value}),remove:key=>chrome.storage.session.remove(key)});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(!m?.type?.startsWith('samples.'))return;
  (async()=>{
    if(!sender.url||new URL(sender.url).origin!=='https://www.23mofang.com'||sender.tab?.id==null)throw Error('仅23魔方页面可发起查询');
    const tab=sender.tab.id,owner=sender.documentId||sender.url;
    if(m.type==='samples.begin')return sessions.begin(tab,owner);
    if(m.type==='samples.cancel')return sessions.cancel(tab,owner,m.token);
    if(!['samples.query','samples.nearest'].includes(m.type))throw Error('未知请求');
    const task=await sessions.acquire(tab,owner,m.token);
    try{return m.type==='samples.nearest'?await nearest(io,m.provider,m.marker,m.ancestors,task.signal):await query(io,m.provider,m.marker,!!m.refresh,task.signal,!!m.more);}finally{task.release();}
  })().then(value=>reply({ok:true,value}),error=>reply({ok:false,error:String(error)}));return true;
});
chrome.tabs.onRemoved.addListener(tab=>{void sessions.remove(tab).catch(error=>console.error('清理样本会话失败',error));});
