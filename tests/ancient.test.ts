import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeTree,selectSamples,pathToRoot,dated,sourceUrl,marker,fresh,TTL,type TreePage,type QueryResult} from '../src/ancient/model.ts';
import {parseDetail,parseTreeDOM} from '../src/ancient/parser.ts';
import {resolveTarget} from '../src/ancient/aliases.ts';
import {AncientEngine,RequestGate,jobKey,cacheKey,type IO} from '../src/ancient/engine.ts';
import {directProjections} from '../src/ancient/projection';
import {formalNodes} from '../src/ancient/ui.ts';
import {parseHTML} from 'linkedom';
const page:TreePage=JSON.parse(readFileSync('tests/fixtures/ancient/O-F8.json','utf8'));
const html334=readFileSync('tests/fixtures/ancient/AU334.html','utf8');const html785=readFileSync('tests/fixtures/ancient/AU104785.html','utf8');
const s334=page.samples.find(s=>s.au==='AU334')!,s785=page.samples.find(s=>s.au==='AU104785')!;
const root=page.branches.find(b=>b.marker==='O-F8')!;
test('live snapshot contains 42 direct and 291 descendant ancient samples, not all AU rows',()=>{
  assert.equal(selectSamples(page,root,'direct').samples.length,42);assert.equal(selectSamples(page,root,'downstream').samples.length,291);
  assert.equal(selectSamples(page,root,'direct').samples.some(s=>s.au==='AU104785'),false);
  const s=selectSamples(page,root,'downstream').samples.find(s=>s.au==='AU104785')!;assert.deepEqual(s.path,['O-F8','O-Z44059','O-YP4864']);
  assert.equal(JSON.stringify(page).includes('AU41928'),false);
});
test('explicit type is required and modern research fields never survive normalization',()=>{
  const p=normalizeTree({code:1,data:{ytree:[{hid:1,name:'O-F8',parent:0},{sid:1,parent:1,stype:1,name:'PRIVATE_MODERN',nativeplace:'PRIVATE_PLACE'},{sid:2,parent:1,stype:2,name:'ancient'},{sid:3,parent:1,name:'UNKNOWN_PRIVATE'}]}});
  assert.equal(p.samples.length,1);assert.equal(p.unclassified.length,1);assert.equal(p.unclassified[0].name,'');assert.equal(JSON.stringify(p).includes('PRIVATE'),false);
});
test('real detail fields parse Chinese Ancient type and retain quality, culture, period and source',()=>{
  const d=parseDetail(html785,s785.url);assert.equal(d.type,'ancient');assert.equal(d.sample!.au,'AU104785');assert.equal(d.sample!.marker,'O-YP4864');assert.equal(d.sample!.culture,'齐家文化');assert.equal(d.sample!.period,'距今3500年');assert.equal(d.sample!.coverage,.0127);assert.equal(d.sample!.depth,1);assert.ok(d.sample!.paper!.includes('Genomics'));
});
test('modern or unrecognized detail is never promoted to ancient by its title',()=>{
  assert.equal(parseDetail(html785.replace(/古人(?=\s*<\/div>)/,'科研'),s785.url).type,'modern');
  assert.equal(parseDetail('<h1>古墓遗址 AU123</h1>',s785.url).type,'unknown');
});
test('question-mark placement is pending, not a confirmed direct sample',()=>{
  const p=normalizeTree({code:1,data:{ytree:[{hid:1,name:'O-F8',parent:0},{hid:'1LOW',name:'O-F8?',parent:1},{sid:1,parent:'1LOW',stype:2,haplogroup:'O-F8?',name:'Ancient'}]}});
  const r=selectSamples(p,p.branches[0],'direct');assert.equal(r.samples.length,0);assert.equal(r.unknown.length,1);assert.equal(r.unknown[0].tentative,true);
});
test('orphan and cyclic ancestry never establish membership',()=>{
  assert.equal(pathToRoot('2','1',[{id:'2',parent:'3',marker:'O-X',pending:false,tentative:false},{id:'3',parent:'2',marker:'O-Y',pending:false,tentative:false}]),null);
  assert.equal(pathToRoot('missing',root.id,page.branches),null);
});
test('dates retain incompatible bases; dynasties and unspecified ago dates stay unsorted',()=>{
  assert.deepEqual(dated('3,982–3,780 cal BP'),{basis:'cal BP',midpoint:3881});assert.deepEqual(dated('3550 BP'),{basis:'BP',midpoint:3550});assert.equal(dated('距今3500年'),null);assert.equal(dated('汉代'),null);
});
test('matching is exact except for explicitly verified alias records',()=>{
  assert.equal(marker(' O-F8 '),'O-F8');assert.equal(marker('O-F8?'),null);assert.equal(sourceUrl('https://evil.test/sample/aaaaaaaaaaaaaaaa.html'),'');
  assert.equal(resolveTarget('O-MF999').target,'O-MF999');assert.equal(resolveTarget('O-OLD',{'O-OLD':{target:'O-F8',evidenceUrl:'https://example.org/evidence',verified:true}}).target,'O-F8');
});
function apiRows(){return {code:1,data:{ytree:[{hid:28,parent:26,name:'O-F8',isParent:1},{hid:34,parent:28,name:'O-Z44059',isParent:1},{hid:22002,parent:34,name:'O-YP4864',isParent:1},...[s334,s785].map(s=>({hid:s.au,sid:Number(s.au.slice(2)),parent:Number(s.parentId),name:s.name,haplogroup:s.marker,stype:2,sid_encrypted:new URL(s.url).pathname.split('/').at(-1)!.replace('.html',''),period:s.period}))]}};}
function harness(mode:'ok'|'blocked'|'slow'='ok'){
  const store=new Map<string,any>();let sequence=0;const requests:string[]=[];let behavior=mode;
  const io:IO={get:async key=>structuredClone(store.get(key)),set:async(k,v)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>`job-${++sequence}`,request:async(url,signal)=>{
    requests.push(url);if(behavior==='blocked')return {status:403,url,body:'Denied'};
    if(behavior==='slow'){await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}
    return {status:200,url,body:url.includes('/api/')?JSON.stringify(apiRows()):url===s334.url?html334:html785};
  }};
  return {engine:new AncientEngine(io),io,store,requests,setMode:(v:typeof mode)=>{behavior=v;}};
}
async function settle(h:ReturnType<typeof harness>,id:string){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,5));const j=await h.engine.get(id);if(j&&j.status!=='running')return j;}throw Error('Task did not settle');}
test('direct query finishes, caches, and does not fetch descendant sample details',async()=>{
  const h=harness();const start=await h.engine.start('O-F8','direct');const j=await settle(h,start.id);assert.equal(j.status,'complete');assert.equal(j.samples.length,1);assert.equal(h.requests.includes(s785.url),false);
  const n=h.requests.length;const cached=await h.engine.start('O-F8','direct');assert.equal(cached.cached,true);assert.equal(h.requests.length,n);assert.equal(fresh({...j,updatedAt:Date.now()-TTL-1}),false);
});
test('descendant query preserves the actual placement and does not double count',async()=>{
  const h=harness();const start=await h.engine.start('O-F8','downstream');const j=await settle(h,start.id);assert.equal(j.samples.length,2);assert.equal(j.samples.find(s=>s.au==='AU104785')!.path.at(-1),'O-YP4864');assert.equal(j.complete,true);
});
test('completed ancestor query populates direct child caches and reuses subtree data without requests',async()=>{
  const h=harness();const parent=await settle(h,(await h.engine.start('O-F8','downstream')).id);
  const leaf=h.store.get(cacheKey('O-YP4864','direct'));assert.equal(leaf.samples.length,1);assert.deepEqual(leaf.samples[0].path,['O-YP4864']);assert.equal(leaf.branches.length,1);
  assert.equal(h.store.get(cacheKey('O-F8','direct')).samples.length,1);assert.equal(h.store.get(cacheKey('O-Z44059','direct')).samples.length,0);assert.equal(parent.cachedChildren,2);
  const n=h.requests.length;const direct=await h.engine.start('O-YP4864','direct');assert.equal(direct.cached,true);assert.equal(direct.samples[0].au,'AU104785');
  const downstream=await h.engine.start('O-Z44059','downstream');assert.equal(downstream.cached,true);assert.deepEqual(downstream.samples[0].path,['O-Z44059','O-YP4864']);assert.equal(h.requests.length,n);
});
test('direct-only or partial ancestor queries do not claim complete child caches',async()=>{
  const h=harness();await settle(h,(await h.engine.start('O-F8','direct')).id);assert.equal(await h.engine.getCached('O-YP4864','direct'),null);
  const request=h.io.request;h.io.request=async(url,signal)=>url===s785.url?{status:503,url,body:''}:request(url,signal);
  const partial=await settle(h,(await h.engine.start('O-F8','downstream',true)).id);assert.equal(partial.complete,false);assert.equal(await h.engine.getCached('O-YP4864','direct'),null);
});
test('normal webpage completed ancestor sync also populates descendant caches',async()=>{
  const h=harness('blocked');const job=await settle(h,(await h.engine.start('O-F8','downstream')).id);await h.engine.adopt(job.id,normalizeTree(apiRows()));
  await h.engine.sourceDetail(job.id,'AU334',parseDetail(html334,s334.url));await h.engine.sourceDetail(job.id,'AU104785',parseDetail(html785,s785.url));
  const finished=await h.engine.finishSource(job.id);assert.equal(finished.cachedChildren,2);assert.equal((await h.engine.getCached('O-YP4864','direct'))?.samples.length,1);
});
test('existing verified renamed child cache refreshes from canonical data without guessing new aliases',async()=>{
  const h=harness();const j=await settle(h,(await h.engine.start('O-F8','downstream')).id);const known=h.store.get(cacheKey('O-YP4864','direct'));
  h.store.set(cacheKey('O-RENAMED123','direct'),{...known,marker:'O-RENAMED123',nodeSnps:['YP4864'],mapping:'已核实SNP对应',updatedAt:j.updatedAt-1000,samples:[]});
  const found=await h.engine.getCached('O-RENAMED123','direct');assert.equal(found?.samples.length,1);assert.equal(found?.target,'O-YP4864');assert.equal(found?.mappingVerifiedAt,j.updatedAt-1000);
  assert.equal(await h.engine.getCached('O-UNVERIFIED123','direct'),null);
});
test('reuse of an old complete ancestor cache fills missing projections without extending collection time',async()=>{
  const h=harness();const j=await settle(h,(await h.engine.start('O-F8','downstream')).id);
  h.store.delete(cacheKey('O-YP4864','direct'));h.store.set(cacheKey('O-F8','downstream'),{...j,projectedVersion:undefined});const count=h.requests.length;
  const cached=await h.engine.start('O-F8','downstream');assert.equal(cached.cached,true);assert.equal(h.requests.length,count);assert.equal(h.store.get(cacheKey('O-YP4864','direct')).updatedAt,j.updatedAt);
});
test('tentative, duplicate-name and unrelated branches do not acquire direct projected caches',async()=>{
  const h=harness();const j=await settle(h,(await h.engine.start('O-F8','downstream')).id);
  const extra=[{id:'999',parent:'28',marker:'O-YP4864',pending:false,tentative:false},{id:'998',parent:'28',marker:'O-X1?',pending:false,tentative:true},{id:'997',parent:'998',marker:'O-X2',pending:false,tentative:false},{id:'996',parent:'10000',marker:'O-X3',pending:false,tentative:false}];
  const names=[...directProjections({...j,branches:[...j.branches,...extra],checked:[...j.checked,...extra.map(b=>b.id)]})].map(j=>j.marker);
  assert.deepEqual(names,['O-F8','O-Z44059']);
});
test('manual refresh bypasses both query and sample-detail caches',async()=>{
  const h=harness();await settle(h,(await h.engine.start('O-F8','direct')).id);const n=h.requests.length;
  await settle(h,(await h.engine.start('O-F8','direct',true)).id);assert.equal(h.requests.length,n+2);
});
test('403 produces a sync state, never a complete zero result',async()=>{
  const h=harness('blocked');const j=await settle(h,(await h.engine.start('O-F8','direct')).id);assert.equal(j.status,'sync');assert.equal(j.complete,false);
});
test('cancel checkpoints safely and resume performs the remaining query',async()=>{
  const h=harness('slow');const start=await h.engine.start('O-F8','direct');await new Promise(r=>setTimeout(r,10));await h.engine.pause(start.id);assert.equal((await h.engine.get(start.id))!.status,'paused');h.setMode('ok');await h.engine.resume(start.id);const j=await settle(h,start.id);assert.equal(j.complete,true);
});
test('normal webpage sync can supply confirmed details without a background fetch',async()=>{
  const h=harness('blocked');const start=await h.engine.start('O-F8','direct');await settle(h,start.id);const p=normalizeTree(apiRows());await h.engine.adopt(start.id,p);
  await h.engine.sourceDetail(start.id,'AU334',parseDetail(html334,s334.url));const j=await h.engine.finishSource(start.id);assert.equal(j.complete,true);assert.equal(j.samples.length,1);
});
test('a worker restart marks a stored running task resumable',async()=>{
  const h=harness();const saved:QueryResult={id:'restart',status:'running'} as QueryResult;await h.io.set(jobKey('restart'),saved);assert.equal((await h.engine.get('restart'))!.status,'paused');
});
test('a reopened page recovers its checkpoint without knowing the previous tab or task ID',async()=>{
  const h=harness('blocked');const initial=await h.engine.start('O-F8','direct');await settle(h,initial.id);
  const restarted=new AncientEngine(h.io);const recovered=await restarted.start('O-F8','direct');assert.equal(recovered.status,'paused');assert.notEqual(recovered.id,initial.id);assert.equal(h.requests.length,1);
});
test('rendered tree fallback uses category classes and direct DOM parents',()=>{
  const doc=parseHTML('<ul><li id="tree_1" treenode><a treenode_a><span class="chrom">O-F8</span></a><ul><li id="tree_2" treenode><a treenode_a><span class="user_sid">AU1</span><span class="user_anc_csv">Ancient</span></a></li><li id="tree_3" treenode><a treenode_a><span class="user_sid">AU2</span><span class="user_sci_csv">DO_NOT_COPY</span></a></li></ul></li></ul>').document;
  const p=parseTreeDOM(doc as unknown as Document);assert.equal(p.samples.length,1);assert.equal(p.samples[0].parentId,'tree_1');assert.equal(JSON.stringify(p).includes('DO_NOT_COPY'),false);
});
test('missing exact node is unmatched rather than silently replaced by a parent',async()=>{
  const h=harness();const j=await settle(h,(await h.engine.start('O-MF999','direct')).id);assert.equal(j.status,'unmatched');assert.equal(j.complete,false);assert.equal(j.samples.length,0);
});
test('partial detail failures can be retried without repeating completed details',async()=>{
  const h=harness();const normal=h.io.request;h.io.request=async(url,signal)=>url===s334.url?{status:503,url,body:''}:normal(url,signal);
  const start=await h.engine.start('O-F8','direct');const partial=await settle(h,start.id);assert.equal(partial.status,'partial');assert.equal(partial.complete,false);assert.equal(partial.failures.length,1);
  h.io.request=normal;await h.engine.resume(start.id);const done=await settle(h,start.id);assert.equal(done.complete,true);
});
test('formal tree adapter excludes personal rows even if they contain a haplogroup label',()=>{
  const doc=parseHTML('<div class="tree-wrapper"><svg><g class="node"><text class="label">O-F8</text></g><g class="node"><g class="person-container"></g><text class="label">O-MF999</text></g><g class="node"><text class="label"></text></g></svg></div>').document;
  assert.deepEqual(formalNodes(doc as unknown as Document).map(n=>n.name),['O-F8']);
});
test('background request gate enforces one active request and 500ms spacing',async()=>{
  const original=globalThis.fetch;const starts:number[]=[];let active=0,max=0;
  globalThis.fetch=async()=>{starts.push(Date.now());active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,20));active--;return new Response('{}',{status:200});};
  try{const gate=new RequestGate();const c=new AbortController();await Promise.all([gate.fetch('https://www.theytree.com/a',c.signal),gate.fetch('https://www.theytree.com/b',c.signal)]);assert.equal(max,1);assert.ok(starts[1]-starts[0]>=490);}finally{globalThis.fetch=original;}
});
