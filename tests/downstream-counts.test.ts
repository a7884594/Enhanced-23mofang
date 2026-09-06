import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AncientEngine,cacheKey,type IO} from '../src/ancient/engine';
import {downstreamCounts} from '../src/ancient/counts';
import {TTL,type QueryResult} from '../src/ancient/model';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
function fixture(){
  let now=10000;const data=new Map<string,any>();
  const io:IO={get:async k=>structuredClone(data.get(k)),set:async(k,v)=>{data.set(k,structuredClone(v));},now:()=>now,id:()=>'',request:async()=>{throw Error('No badge network requests');}};
  const sample=(au:string)=>({au,type:'ancient',parentId:'child',marker:'S-SK1806',path:['S','S-B255','S-SK1806'],tentative:false,detail:true});
  const job={id:'partial',marker:'S',target:'S',scope:'downstream',mappingReady:true,status:'partial',complete:false,createdAt:9000,updatedAt:10000,branches:[{id:'root',parent:'0',marker:'S',tentative:false},{id:'mid',parent:'root',marker:'S-B255',tentative:false},{id:'child',parent:'mid',marker:'S-SK1806',tentative:false}],samples:[sample('AU1'),sample('AU2')],unknown:[{...sample('AU3'),type:'unknown'}],queue:[],details:[],failures:[],checked:[]} as unknown as QueryResult;
  return {data,io,job,engine:new AncientEngine(io),advance:()=>{now+=TTL+1;}};
}
test('partial downstream samples update direct child badges across worker restart without creating completed caches',async()=>{
  const h=fixture();await h.engine.save(h.job);const restarted=new AncientEngine(h.io);
  assert.deepEqual(await restarted.getBadge('S-SK1806'),{count:2,complete:false,updatedAt:10000});
  assert.equal(await restarted.getBadge('S-B255'),null);assert.equal(h.data.has(cacheKey('S-SK1806','direct')),false);
  assert.ok(h.data.has('anc.cacheRevision'));
  h.advance();assert.equal(await restarted.getBadge('S-SK1806'),null);
});
test('opening a pre-upgrade partial job backfills child badges without refreshing its timestamp',async()=>{
  const h=fixture();h.job.updatedAt=9500;h.data.set('anc.job.partial',structuredClone(h.job));
  assert.equal(await h.engine.getBadge('S-SK1806'),null);
  const job=await h.engine.get('partial');assert.equal(job?.updatedAt,9500);
  assert.deepEqual(await h.engine.getBadge('S-SK1806'),{count:2,complete:false,updatedAt:9500});
});
test('tentative, disconnected, duplicate-name and wrong-kind samples do not inflate child counts',()=>{
  const {job}=fixture();job.samples.push({...job.samples[0]});assert.equal(downstreamCounts(job,10000).get('S-SK1806')?.count,2);
  job.samples[1].tentative=true;assert.equal(downstreamCounts(job,10000).get('S-SK1806')?.count,1);
  job.branches[1].tentative=true;assert.equal(downstreamCounts(job,10000).size,0);
  job.branches[1].tentative=false;job.branches[2].parent='disconnected';assert.equal(downstreamCounts(job,10000).size,0);
  job.branches[2].parent='mid';job.branches.push({...job.branches[2],id:'other'});assert.equal(downstreamCounts(job,10000).size,0);
});
test('retracted confirmed rows clear partial badges; newer complete counts take precedence',async()=>{
  const h=fixture();await h.engine.save(h.job);h.job.samples=[];await h.engine.save(h.job);assert.equal(await h.engine.getBadge('S-SK1806'),null);
  const next=fixture();await next.engine.save(next.job);
  next.data.set(cacheKey('S-SK1806','direct'),{...next.job,marker:'S-SK1806',target:'S-SK1806',scope:'direct',status:'complete',complete:true,samples:[],updatedAt:10001});
  assert.deepEqual(await next.engine.getBadge('S-SK1806'),{count:0,complete:true,updatedAt:10001});
});
test('scientific downstream progress uses research storage and does not bleed into ancient counts',async()=>{
  const h=fixture();h.job.samples.forEach(s=>s.type='scientific');
  const code=(await build({entryPoints:['src/ancient/engine.ts'],bundle:true,write:false,platform:'node',packages:'external',format:'cjs',define:{__RESEARCH__:'true'}})).outputFiles[0].text;
  const module={exports:{} as any};runInNewContext(code,{module,exports:module.exports,require:createRequire(import.meta.url),URL,Date,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout});
  const research=new module.exports.AncientEngine(h.io);await research.save(h.job);
  assert.equal((await research.getBadge('S-SK1806'))?.count,2);assert.equal((await research.getBadge('S-SK1806'))?.complete,false);
  assert.equal(await h.engine.getBadge('S-SK1806'),null);assert.ok(h.data.has('res.cacheRevision'));
});
test('research UI refreshes child count badges while the downstream query is still partial',async()=>{
  const {JSDOM}=createRequire(import.meta.url)('jsdom');
  const code=(await build({entryPoints:['src/ancient/ui.ts'],bundle:true,write:false,format:'iife',define:{__RESEARCH__:'true'}})).outputFiles[0].text;
  const dom=new JSDOM('<body><div class="tree-wrapper"><svg><g class="node"><text class="label">S</text><text class="time">形成时间距今44970年</text></g><g class="node"><text class="label">S-SK1806</text><text class="time">形成时间距今280年</text></g></svg></div></body>',{url:'https://www.23mofang.com/ancestry/ytree/S',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window as any;let downstream=false;
  const {job}=fixture();job.samples.forEach(s=>s.type='scientific');
  w.SVGElement.prototype.getScreenCTM=()=>({a:1,d:1,e:0,f:0});
  w.chrome={storage:{onChanged:{addListener:()=>{}}},runtime:{sendMessage:async(m:any)=>{
    if(m.type==='res.counts')return {ok:true,value:downstream?{'S-SK1806':{count:2,complete:false,updatedAt:Date.now()}}:{}};
    if(m.type==='res.start')downstream=m.scope==='downstream';
    return {ok:true,value:{...job,scope:downstream?'downstream':'direct',samples:downstream?job.samples:[],unknown:[],updatedAt:Date.now()}};
  }}};
  try{
    w.eval(code);const button=w.document.querySelector('[data-mofang-research][data-marker="S"]');
    button.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,30));
    const shadow=w.document.getElementById('mofang-research-panel').shadowRoot;
    shadow.querySelector('[data-scope="downstream"]').click();await new Promise(r=>setTimeout(r,850));
    assert.equal(w.document.querySelector('[data-mofang-research][data-marker="S-SK1806"] text').textContent,'科研 · 2+');
  }finally{dom.window.close();}
});
