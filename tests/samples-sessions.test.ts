import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SampleSessions} from '../src/samples/sessions';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
function fixture(){const values=new Map<string,any>();let id=0;const storage={get:async(k:string)=>values.get(k),set:async(k:string,v:any)=>{values.set(k,v);},remove:async(k:string)=>{values.delete(k);}};return {values,worker:()=>new SampleSessions(storage,()=>`token-${++id}`)};}
test('existing page can query nearest and continue after worker suspension',async()=>{
  const f=fixture();let worker=f.worker();const {token}=await worker.begin(1,'document1');const old=await worker.acquire(1,'document1',token);old.release();
  worker=f.worker();const resumed=await worker.acquire(1,'document1',token);assert.equal(resumed.signal.aborted,false);resumed.release();
  const continued=await worker.acquire(1,'document1',token);assert.equal(continued.signal.aborted,false);continued.release();
});
test('cancelled, replaced, removed and wrong-document tokens cannot revive across restart',async()=>{
  const f=fixture();let worker=f.worker();let {token}=await worker.begin(1,'doc1');
  const request=await worker.acquire(1,'doc1',token);await worker.cancel(1,'doc1',token);assert.equal(request.signal.aborted,true);
  worker=f.worker();await assert.rejects(worker.acquire(1,'doc1',token),/切换或取消/);
  ({token}=await worker.begin(1,'doc1'));const next=await worker.begin(1,'doc2');worker=f.worker();
  await assert.rejects(worker.acquire(1,'doc1',token));await assert.rejects(worker.acquire(1,'doc1',next.token));await assert.rejects(worker.acquire(2,'doc2',next.token));
  await assert.rejects(worker.cancel(1,'doc1',token));const current=await worker.acquire(1,'doc2',next.token);assert.equal(current.signal.aborted,false);current.release();
  await worker.remove(1);worker=f.worker();await assert.rejects(worker.acquire(1,'doc2',next.token));
});
test('concurrent session mutations serialize and old cancellation does not remove a new task',async()=>{
  const f=fixture(),worker=f.worker();const a=await worker.begin(1,'doc');const first=await worker.acquire(1,'doc',a.token);
  const [b,cancel]=await Promise.allSettled([worker.begin(1,'doc'),worker.cancel(1,'doc',a.token)]);
  assert.equal(first.signal.aborted,true);assert.equal(b.status,'fulfilled');assert.equal(cancel.status,'rejected');
  if(b.status==='fulfilled'){const request=await worker.acquire(1,'doc',b.value.token);assert.equal(request.signal.aborted,false);request.release();}
});
test('concurrency cap and cancellation work on a restored session',async()=>{
  const f=fixture();const {token}=await f.worker().begin(1,'doc');const worker=f.worker();
  const requests=await Promise.all([1,2,3].map(()=>worker.acquire(1,'doc',token)));await assert.rejects(worker.acquire(1,'doc',token),/尚未完成/);
  requests[0].release();const extra=await worker.acquire(1,'doc',token);await worker.cancel(1,'doc',token);assert.equal(extra.signal.aborted,true);assert.equal(requests[1].signal.aborted,true);
});
test('built background worker accepts nearest after restart and rejects cancelled tokens after a second restart',async()=>{
  const bundle=(await build({entryPoints:['src/samples/background.ts'],write:false,bundle:true,format:'iife'})).outputFiles[0].text;
  const session:Record<string,unknown>={};
  function boot(){
    let listener:any;
    const storage={get:async(key:string)=>({[key]:session[key]}),set:async(values:Record<string,unknown>)=>{Object.assign(session,values);},remove:async(key:string)=>{delete session[key];}};
    const chrome={storage:{session:storage,local:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},runtime:{onMessage:{addListener:(fn:any)=>{listener=fn;}}},tabs:{onRemoved:{addListener:()=>{}}}};
    runInNewContext(bundle,{atob,chrome,crypto:{randomUUID},AbortController,URL,TextEncoder,console,setTimeout,clearTimeout});
    return (message:any)=>new Promise<any>(resolve=>listener(message,{url:'https://www.23mofang.com/ancestry/ytree/O-ACT2839',documentId:'same-page',tab:{id:5}},resolve));
  }
  let send=boot();const begun=await send({type:'samples.begin'});assert.equal(begun.ok,true);const token=begun.value.token;
  send=boot();const resumed=await send({type:'samples.nearest',token,provider:'yfull',marker:'O-ACT2839',ancestors:[]});
  assert.equal(resumed.ok,true);assert.match(resumed.value.message,/未提供.*上游链/);
  assert.equal((await send({type:'samples.cancel',token})).ok,true);
  send=boot();const cancelled=await send({type:'samples.nearest',token,provider:'yfull',marker:'O-ACT2839',ancestors:[]});
  assert.equal(cancelled.ok,false);assert.match(cancelled.error,/切换或取消/);
});
