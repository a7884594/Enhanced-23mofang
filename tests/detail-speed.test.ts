import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AncientEngine,RequestGate,jobKey,type IO} from '../src/ancient/engine';
import type {QueryResult} from '../src/ancient/model';
const page=JSON.parse(readFileSync('tests/fixtures/ancient/O-F8.json','utf8'));
const html=new Map([['AU334',readFileSync('tests/fixtures/ancient/AU334.html','utf8')],['AU104785',readFileSync('tests/fixtures/ancient/AU104785.html','utf8')]]);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function harness(serial=false,restricted=false){
  const store=new Map<string,any>(),calls:string[]=[],writes:string[]=[];let active=0,max=0,tail=Promise.resolve();
  const io:IO={get:async k=>structuredClone(store.get(k)),set:async(k,v)=>{writes.push(k);store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>'',request:(url,signal)=>{
    const work=async()=>{calls.push(url);active++;max=Math.max(max,active);await sleep(160);active--;if(signal.aborted)throw Error('aborted');const s=page.samples.find((s:any)=>s.url===url);return {url,status:restricted&&s.au==='AU334'?403:200,body:html.get(s.au)!};};
    if(!serial)return work();const next=tail.then(work);tail=next.then(()=>{});return next;
  }};
  const job={id:'speed',marker:'O-F8',target:'O-F8',scope:'downstream',status:'running',mappingReady:true,mapping:'同名',createdAt:Date.now(),updatedAt:Date.now(),complete:false,cached:false,samples:page.samples.filter((s:any)=>html.has(s.au)).map((s:any)=>({...s,detail:false,path:['O-F8',s.marker]})),unknown:[],branches:page.branches,checked:[],queue:[],details:[...html.keys()],failures:[],excluded:0,message:''} as QueryResult;
  const engine=new AncientEngine(io);return {store,calls,writes,io,job,engine,max:()=>max};
}
test('real detail parsers run in bounded parallel, preserve placement, and reuse cached details without rewriting timestamps',async()=>{
  const h=harness();await h.engine.save(h.job);await h.engine.run(h.job.id);const done=await h.engine.get(h.job.id);
  assert.equal(h.max(),2);assert.equal(done?.complete,true);assert.equal(done?.samples.length,2);assert.equal(done?.samples.find(s=>s.au==='AU104785')?.marker,'O-YP4864');
  const key='anc.detail.AU334',at=h.store.get(key).at,writes=h.writes.filter(k=>k.startsWith('anc.detail.')).length;
  await h.engine.save({...h.job,id:'cached'});await h.engine.run('cached');assert.equal(h.calls.length,2);assert.equal(h.store.get(key).at,at);assert.equal(h.writes.filter(k=>k.startsWith('anc.detail.')).length,writes);
});
test('latency benchmark confirms overlap rather than merely queueing two serial requests',async()=>{
  const sequential=harness(true);await sequential.engine.save(sequential.job);let started=performance.now();await sequential.engine.run('speed');const serialMs=performance.now()-started;
  const parallel=harness();await parallel.engine.save(parallel.job);started=performance.now();await parallel.engine.run('speed');const parallelMs=performance.now()-started;
  assert.equal(sequential.max(),1);assert.equal(parallel.max(),2);assert.ok(parallelMs<serialMs*.85,`${parallelMs} vs ${serialMs}`);
  console.log(`模拟160ms详情延迟：串行${Math.round(serialMs)}ms，并行${Math.round(parallelMs)}ms`);
});
test('restriction retains pending details and preserves the other successful result; cancellation blocks late writes',async()=>{
  const h=harness(false,true);h.job.details.push('AU999');await h.engine.save(h.job);await h.engine.run('speed');const done=await h.engine.get('speed');
  assert.equal(done?.status,'sync');assert.ok(done?.details.includes('AU334'));assert.ok(done?.details.includes('AU999'));assert.ok(!done?.details.includes('AU104785'));assert.equal(h.calls.length,2);
  const c=harness();await c.engine.save(c.job);const run=c.engine.run('speed');await sleep(20);await c.engine.pause('speed');await run;
  assert.equal((await c.engine.get('speed'))?.status,'paused');assert.equal(c.store.has('anc.detail.AU334'),false);
});
test('shared gate allows two detail reads while preserving 500ms spacing and exclusive tree requests',async()=>{
  const original=globalThis.fetch;let active=0,max=0,treeActive=-1;const starts:number[]=[];
  globalThis.fetch=async(url:any)=>{if(String(url).includes('/api/'))treeActive=active;starts.push(Date.now());active++;max=Math.max(max,active);await sleep(1600);active--;return new Response('{}');};
  try{const gate=new RequestGate(),signal=new AbortController().signal;await Promise.all(['https://www.theytree.com/sample/aaaaaaaaaaaaaaaa.html','https://www.theytree.com/sample/bbbbbbbbbbbbbbbb.html','https://www.theytree.com/sample/cccccccccccccccc.html','https://www.theytree.com/api/ysnp/theytree/?haplogroup=O-F8'].map(url=>gate.fetch(url,signal)));assert.equal(max,2);assert.equal(treeActive,0);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=490);}
  finally{globalThis.fetch=original;}
});
