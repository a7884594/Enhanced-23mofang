import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {AncientEngine,cacheKey,type IO} from '../src/ancient/engine';
import {matchKey} from '../src/ancient/node-match';
import {TTL,type QueryResult} from '../src/ancient/model';
import {equivalentEvidence} from '../src/ancient/equivalent';
const name='O-MF190013',target='O-FT130664',ancestor='O-MF109594';
const f=JSON.parse(readFileSync('tests/fixtures/ancient/FT130664-equivalent.json','utf8'));
const local=['MF190013','Y86790'];
const evidence=equivalentEvidence(f.candidate,f.groups,local,1000,'visible-dialog');
const known={marker:name,target,mapping:'已核实对应',verifiedAt:1000,nodeSnps:local,snpChecks:local.map(snp=>({snp,target,issue:'',url:evidence.url,candidate:f.candidate,evidence}))};
function harness(){
  const data=new Map<string,any>();let now=TTL*10;
  const io:IO={get:async k=>structuredClone(data.get(k)),set:async(k,v)=>{data.set(k,structuredClone(v));},now:()=>now,id:()=>`job-${now++}`,request:async()=>{throw Error('Badge/cache reads must not access the network');}};
  const publicPage=JSON.parse(readFileSync('tests/fixtures/ancient/MF190013-searches.json','utf8')).searches[0].page;
  const samples=publicPage.samples.filter((s:any)=>['AU82800','AU82840'].includes(s.au)).map((s:any)=>({...s,detail:true,tentative:false,parentId:'child',path:['O-Y176322',target]}));
  assert.equal(samples.length,2);
  const whole:QueryResult={id:'upstream',marker:ancestor,target:'O-Y176322',mapping:'源站对应',mappingReady:true,scope:'downstream',status:'complete',complete:true,cached:false,createdAt:now-1000,updatedAt:now-1000,samples,unknown:[],branches:[{id:'root',parent:'0',marker:'O-Y176322',pending:false,tentative:false},{id:'child',parent:'root',marker:target,pending:false,tentative:false}],checked:['root','child'],queue:[],details:[],failures:[],excluded:0,message:'查询完成'};
  data.set(cacheKey(ancestor,'downstream'),whole);
  return {data,io,whole,engine:new AncientEngine(io),advance:()=>{now+=TTL+1;}};
}
test('upstream projections update a verified renamed child without its own completed query',async()=>{
  const h=harness();h.data.set(matchKey(name),known);
  await h.engine.getCached(ancestor,'direct'); // projects completed ancestor data
  assert.ok(h.data.has(cacheKey(target,'direct')));assert.ok(!h.data.has(cacheKey(name,'direct')));
  const badge=await h.engine.getBadge(name);assert.equal(badge?.count,2);assert.equal(badge?.complete,true);
  const cached=await h.engine.getCached(name,'direct');assert.equal(cached?.target,target);assert.equal(cached?.matchReused,true);
  assert.deepEqual(cached?.samples.map(s=>s.au),['AU82800','AU82840']);assert.ok(cached?.samples.every(s=>s.path.join()===target));
  const subtree=await h.engine.getCached(name,'downstream');assert.equal(subtree?.samples.length,2);assert.equal(subtree?.branches.length,1);
  const start=await h.engine.start(name,'direct');assert.equal(start.cached,true);assert.equal(start.matchReused,true);
});
test('unknown mapping stays unknown; late shared mapping immediately exposes existing projections',async()=>{
  const h=harness();await h.engine.getCached(ancestor,'direct');assert.equal(await h.engine.getBadge(name),null);
  h.data.set(matchKey(name),known);assert.equal((await h.engine.getBadge(name))?.count,2);
  const newer={...h.data.get(cacheKey(target,'direct')),samples:[],updatedAt:h.io.now()};h.data.set(cacheKey(target,'direct'),newer);
  assert.deepEqual(await h.engine.getBadge(name),{count:0,complete:true,updatedAt:newer.updatedAt});
  h.advance();assert.equal(await h.engine.getBadge(name),null);
});
test('research shares identity but never reads ancient sample projections',async()=>{
  const h=harness();h.data.set(matchKey(name),known);await h.engine.getCached(ancestor,'direct');
  const code=(await build({entryPoints:['src/ancient/engine.ts'],bundle:true,write:false,platform:'node',packages:'external',format:'cjs',define:{__RESEARCH__:'true'}})).outputFiles[0].text;
  const module={exports:{} as any};runInNewContext(code,{module,exports:module.exports,require:createRequire(import.meta.url),URL,Date,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout});
  const research=new module.exports.AncientEngine(h.io);assert.equal(await research.getBadge(name),null);
  h.data.set(`res.cache.fast4.${ancestor}.downstream`,{...h.whole,samples:h.whole.samples.map(s=>({...s,type:'scientific'}))});
  await research.getCached(ancestor,'direct');assert.equal((await research.getBadge(name))?.count,2);
});
