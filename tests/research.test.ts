import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext,createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
import {normalizeTree as ancientTree} from '../src/ancient/model';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const compiled=await build({stdin:{contents:"export * from './src/ancient/model';export * from './src/ancient/parser';export * from './src/ancient/engine';export * from './src/ancient/age';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',packages:'external',format:'cjs',define:{__RESEARCH__:'true'}});
const module={exports:{} as any};runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,require,URL,Date,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout});const R=module.exports;
const fixture=JSON.parse(readFileSync('tests/fixtures/research/O-Y5702.json','utf8'));
const html=readFileSync('tests/fixtures/research/AU38407.html','utf8'),sample=fixture.samples[0],branch=fixture.branches[0];
const raw={code:1,data:{ytree:[{hid:branch.id,parent:0,name:branch.marker}, {sid:38407,parent:branch.id,name:sample.name,stype:1,haplogroup:sample.marker,sid_encrypted:sample.url.split('/').at(-1).replace('.html','')},{sid:2,parent:branch.id,stype:2,name:'ANCIENT_EXCLUDED'},{sid:3,parent:branch.id,stype:0,name:'PERSONAL_EXCLUDED'}]}};
test('research profile accepts only stype=1 and keeps ancient cache/type behavior unchanged',()=>{
 const p=R.normalizeTree(raw);assert.equal(p.samples.length,1);assert.equal(p.samples[0].type,'scientific');assert.equal(p.samples[0].au,'AU38407');assert.equal(JSON.stringify(p).includes('EXCLUDED'),false);
 assert.equal(ancientTree(raw).samples[0].au,'AU2');assert.equal(R.cacheKey('O-F8','direct'),'res.cache.fast4.O-F8.direct');assert.equal(R.A_CHANNEL,'mofang-research/v1');
});
test('real scientific detail is verified; ancient and personal detail types are excluded',()=>{
 const p=R.parseDetail(html,sample.url);assert.equal(p.type,'scientific');assert.equal(p.sample.au,'AU38407');assert.equal(p.sample.marker,'O-Y5702');assert.equal(p.sample.paper,'');assert.equal(p.sample.paperUrl,'');
 const ancient=readFileSync('tests/fixtures/ancient/AU104785.html','utf8');assert.equal(R.parseDetail(ancient,'https://www.theytree.com/sample/4f2811532a34ffad20f045dbbcc73495.html').sample,null);
 assert.equal(R.parseDetail(html.replace(/科研(?=\s*<\/div>)/,'个人'),sample.url).sample,null);
});
test('research DOM fallback reads scientific classes, not ancient or personal rows',()=>{
 const doc=parseHTML('<ul><li id="tree_1" treenode><a treenode_a><span class="chrom">O-F8</span></a><ul><li id="tree_2" treenode><a treenode_a><span class="user_sid">AU1</span><span class="user_sci_csv">RESEARCH</span></a></li><li id="tree_3" treenode><a treenode_a><span class="user_sid">AU2</span><span class="user_anc">ANCIENT_EXCLUDED</span></a></li><li id="tree_4" treenode><a treenode_a><span class="user_sid">AU3</span><span class="user_simple">PERSONAL_EXCLUDED</span></a></li></ul></li></ul>').document;
 const p=R.parseTreeDOM(doc);assert.equal(p.samples.length,1);assert.equal(p.samples[0].type,'scientific');assert.equal(JSON.stringify(p).includes('EXCLUDED'),false);
});
test('research query caches confirmed detail and projected child results in an isolated namespace',async()=>{
 const store=new Map<string,any>(),calls:string[]=[];let n=0;
 const source={code:1,data:{ytree:[{hid:28,parent:0,name:'O-F8'},...raw.data.ytree.filter((r:any)=>r.stype!==2).map((r:any)=>r.sid?r:{...r,parent:28})]}};
 const engine=new R.AncientEngine({get:async(k:string)=>structuredClone(store.get(k)),set:async(k:string,v:any)=>{store.set(k,structuredClone(v));},id:()=>`research-${++n}`,now:()=>Date.now(),request:async(url:string)=>{calls.push(url);return {url,status:200,body:url.includes('/sample/')?html:JSON.stringify(source)};}});
 store.set('anc.cache.fast4.O-F8.downstream',{complete:true,updatedAt:Date.now(),samples:[{au:'WRONG_CATEGORY'}]});
 const start=await engine.start('O-F8','downstream');let job:any;
 for(let i=0;i<100;i++){job=await engine.get(start.id);if(job.status!=='running')break;await new Promise(r=>setTimeout(r,5));}
 assert.equal(job.complete,true);assert.equal(job.samples.length,1);assert.equal(job.samples[0].type,'scientific');assert.ok(store.has('res.detail.AU38407'));assert.ok(!store.has('anc.detail.AU38407'));
 const before=calls.length,child=await engine.start('O-Y5702','direct');assert.equal(child.cached,true);assert.equal(child.samples[0].au,'AU38407');assert.equal(calls.length,before);
 assert.equal(store.get('anc.cache.fast4.O-F8.downstream').samples[0].au,'WRONG_CATEGORY');
});
test('research entry is available on recent branches',()=>{assert.equal(R.showAncientEntry(410),true);});
test('research normal-page synchronization verifies detail and returns the research task',async()=>{
 const code=(await build({entryPoints:['src/ancient/source.ts'],bundle:true,write:false,format:'iife',define:{__RESEARCH__:'true'}})).outputFiles[0].text;
 const store=new Map();let seq=0;const engine=new R.AncientEngine({get:async(k:string)=>structuredClone(store.get(k)),set:async(k:string,v:any)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>`sync-${++seq}`,request:async()=>{throw Error('Not a background request');}});
 await engine.save({id:'research-sync',marker:'O-Y5702',target:'O-Y5702',scope:'direct',status:'sync',mappingReady:true,mapping:'同名',complete:false,createdAt:Date.now(),updatedAt:Date.now(),samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],excluded:0,message:''});
 const dom=new JSDOM('<body></body>',{url:'https://www.theytree.com/tree/O-Y5702',runScripts:'outside-only'});const w=dom.window as any;w.AbortSignal=AbortSignal;
 w.fetch=async(url:string,options:any)=>{assert.equal(options.credentials,'same-origin');return {ok:true,status:200,url,text:async()=>url.includes('/sample/')?html:JSON.stringify(raw)};};
 w.chrome={runtime:{sendMessage:async(m:any)=>{try{let value;switch(m.type){case 'res.sourceContext':value=await engine.get('research-sync');break;case 'res.sourceBegin':value=await engine.beginSource('research-sync');break;case 'res.source':value=await engine.adopt('research-sync',m.page);break;case 'res.sourceDetail':value=await engine.sourceDetail('research-sync',m.au,m.detail);break;case 'res.sourceFinish':value=await engine.finishSource('research-sync',m.error);break;default:throw Error(m.type);}return {ok:true,value};}catch(e){return {ok:false,error:String(e)};}}}};
 try{w.eval(code);let j:any;for(let i=0;i<150;i++){j=await engine.get('research-sync');if(j.complete)break;await new Promise(r=>setTimeout(r,20));}assert.equal(j.complete,true);assert.equal(j.samples.length,1);assert.equal(j.samples[0].type,'scientific');assert.ok(w.document.getElementById('mofang-research-sync'));}finally{dom.window.close();}
});
test('both worker handlers share one gate but keep task owners, results and messages separate',async()=>{
 const bundles=await Promise.all([false,true].map(async research=>(await build({entryPoints:['src/ancient/background.ts'],bundle:true,write:false,format:'iife',define:{__RESEARCH__:String(research)}})).outputFiles[0].text));
 const listeners:any[]=[],store:Record<string,any>={};let sequence=0;const starts:number[]=[];
 const chrome={runtime:{onMessage:{addListener:(f:any)=>listeners.push(f)}},storage:{local:{get:async(k:string)=>({[k]:structuredClone(store[k])}),set:async(v:any)=>Object.assign(store,structuredClone(v))}},tabs:{create:async()=>({id:99})}};
 const context=createContext({chrome,URL,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,atob,btoa,crypto:{randomUUID:()=>`worker-${++sequence}`},fetch:async(url:string)=>{starts.push(Date.now());return {status:200,url,text:async()=>url.includes('/sample/')?html:JSON.stringify({code:1,data:{ytree:raw.data.ytree.filter((r:any)=>r.stype!==2)}})};}});
 for(const b of bundles)runInContext(b,context);
 const ask=(type:string,id?:string)=>new Promise<any>(resolve=>{for(const f of listeners)f({type,marker:'O-Y5702',scope:'direct',id},{url:'https://www.23mofang.com/ancestry/ytree/O-Y5702',tab:{id:1}},resolve);});
 const sci=await ask('res.start'),anc=await ask('anc.start');let a:any,s:any;
 for(let i=0;i<150;i++){s=await ask('res.get',sci.value.id);a=await ask('anc.get',anc.value.id);if(s.value.complete&&a.value.complete)break;await new Promise(r=>setTimeout(r,15));}
 assert.equal(s.value.samples.length,1);assert.equal(a.value.samples.length,0);assert.equal((await ask('anc.get',sci.value.id)).ok,false);
 assert.equal(store['res.owner.1'],sci.value.id);assert.equal(store['anc.owner.1'],anc.value.id);
 for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=490);
});
test('both UIs coexist with separate buttons, messages and panels; research has no age cutoff',async()=>{
 const bundles=await Promise.all([false,true].map(async research=>(await build({entryPoints:['src/ancient/ui.ts'],bundle:true,write:false,format:'iife',define:{__RESEARCH__:String(research)}})).outputFiles[0].text));
 const dom=new JSDOM('<div class="tree-wrapper"><svg><g class="node"><text class="label">O-F8</text><text class="time">形成时间距今6910年</text></g><g class="node"><text class="label">O-Y5702</text><text class="time">形成时间距今410年</text></g></svg></div>',{url:'https://www.23mofang.com/ancestry/ytree/O-F8',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window as any,calls:any[]=[];w.SVGElement.prototype.getScreenCTM=()=>({a:1,e:0});
 w.chrome={runtime:{sendMessage:async(m:any)=>{calls.push(m);if(m.type.endsWith('.counts'))return {ok:true,value:{}};return {ok:true,value:{id:'demo',marker:m.marker,target:m.marker,scope:'direct',status:'paused',complete:false,mapping:'同名',samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],updatedAt:Date.now(),message:'模拟暂停'}};}}};
 try{
  for(const b of bundles)w.eval(b);
  assert.equal(w.document.querySelectorAll('[data-mofang-ancient]').length,1);assert.equal(w.document.querySelectorAll('[data-mofang-research]').length,2);
  w.document.querySelector('[data-mofang-ancient]').onclick(new w.Event('click'));await new Promise(r=>setTimeout(r,10));
  w.document.querySelector('[data-mofang-research]').onclick(new w.Event('click'));await new Promise(r=>setTimeout(r,10));
  assert.ok(calls.some(c=>c.type==='res.start'));assert.ok(calls.some(c=>c.type==='anc.start'));
  assert.equal(w.document.querySelector('#mofang-ancient-panel').shadowRoot.querySelector('.panel').hidden,true);
  const panel=w.document.querySelector('#mofang-research-panel').shadowRoot;assert.equal(panel.querySelector('.panel').hidden,false);assert.match(panel.querySelector('.title').textContent,/科研/);assert.equal(panel.querySelector('[aria-label="年代排序"]').hidden,true);
 }finally{dom.window.close();}
});
