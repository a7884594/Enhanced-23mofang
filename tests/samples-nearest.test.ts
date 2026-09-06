import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';
import {localAncestors} from '../src/samples/ancestry-bridge';import {nearest} from '../src/samples/nearest';import {query} from '../src/samples/service';
function harness(){const store=new Map<string,any>(),urls:string[]=[];let status=200;return {urls,store,setStatus:(v:number)=>status=v,io:{get:async(k:string)=>store.get(k),set:async(k:string,v:any)=>{store.set(k,v);},now:()=>1000,id:()=>'',request:async(url:string)=>{urls.push(url);const name=decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1)!);return {url,status:name==='R-MISSING'||name==='N-M231'?404:status,body:name==='N'?readFileSync('tests/fixtures/samples/yfull-N-root.html','utf8'):`<ul id="tree"><li id="l${name}"><a>${name}</a></li></ul>`};}}};}
test('YFull N-M231 resolves to N only with YFull root SNP evidence and reuses cache',async()=>{
 const h=harness();const r=await query(h.io,'yfull','N-M231',false,new AbortController().signal);assert.equal(r.status,'ready');assert.equal(r.target,'N');assert.match(r.mapping,/M231/);assert.equal(h.urls.length,2);await query(h.io,'yfull','N-M231',false,new AbortController().signal);assert.equal(h.urls.length,2);
 const bad=harness();bad.io.request=async(url:string)=>({url,status:url.endsWith('/N-M231/')?404:200,body:'<ul id="tree"><li id="lN"><a>N</a><span class="yf-snpforhg">OTHER123</span></li></ul>'});assert.equal((await query(bad.io,'yfull','N-M231',false,new AbortController().signal)).status,'unmatched');
});
test('nearest lookup follows ordered ancestors and returns navigation only',async()=>{
 const h=harness();const hint=await nearest(h.io,'yfull','R-CHILD',['R-MISSING','R-PARENT','R-ROOT'],new AbortController().signal);assert.equal(hint.found,true);assert.equal(hint.target,'R-PARENT');assert.equal(hint.distance,2);assert.equal(h.urls.length,2);assert.ok(!('nodes' in hint));assert.ok(!('samples' in hint));assert.ok(![...h.store.keys()].some(k=>k.includes('R-CHILD')));
});
test('unavailable nearer ancestor, absent path, and malformed chains cannot imply a nearest parent',async()=>{
 const h=harness();h.setStatus(403);const hint=await nearest(h.io,'yfull','R-CHILD',['R-PARENT','R-ROOT'],new AbortController().signal);assert.equal(hint.found,false);assert.equal(h.urls.length,1);
 assert.equal((await nearest(h.io,'yfull','R-CHILD',[],new AbortController().signal)).checked,0);await assert.rejects(nearest(h.io,'yfull','R-CHILD',['R-CHILD'],new AbortController().signal));await assert.rejects(nearest(h.io,'yfull','R-CHILD',['R-PARENT','R-PARENT'],new AbortController().signal));
});
test('local bridge reads only current formal node parent IDs, nearest first, with cycle protection',()=>{
 const doc=parseHTML('<div class="tree-wrapper"><svg><g class="node"><text class="label">R-CHILD</text></g></svg></div>').document;
 const root:any={data:{id:'R-ROOT',private:'NEVER_COPY'}};const parent:any={data:{id:'R-PARENT'},parent:root};const child:any={data:{id:'R-CHILD'},parent};(doc.querySelector('g') as any).__data__=child;root.parent=parent;
 assert.deepEqual(localAncestors(doc as any,'R-CHILD'),['R-PARENT','R-ROOT']);assert.deepEqual(localAncestors(doc as any,'R-OTHER'),[]);
});
