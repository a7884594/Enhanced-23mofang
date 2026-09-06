import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {YFULL_ROOT_ALIASES} from '../src/samples/yfull-roots';import {query} from '../src/samples/service';
const audit=JSON.parse(readFileSync('assets/yfull-root-audit.json','utf8'));
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
test('all twenty letter entries use independently audited YFull root names in one request',async()=>{
 assert.equal(audit.rows.length,20);assert.equal(Object.keys(YFULL_ROOT_ALIASES).length,9);
 for(const row of audit.rows){
  const source=row.alternate||row.direct;assert.equal(source.status,200);
  const html=`<ul id="tree"><li id="l${source.name}"><a>${source.name}</a><span class="yf-snpforhg">${escape(source.groups[0]||'')}</span><span class="yf-plus-snps" title="${escape(source.groups[1]||'')}"></span></li></ul>`;
  const calls:string[]=[],store=new Map<string,any>();const io={get:async(k:string)=>store.get(k),set:async(k:string,v:any)=>{store.set(k,v);},now:()=>1000,id:()=>'',request:async(url:string)=>{calls.push(url);assert.equal(url,source.url);return {status:200,url,body:html};}};
  const result=await query(io,'yfull',row.mofang,false,new AbortController().signal);assert.equal(result.status,'ready',row.mofang);assert.equal(result.target,source.name);assert.equal(calls.length,1);
  assert.equal((await query(io,'yfull',row.mofang,false,new AbortController().signal)).cached,true);assert.equal(calls.length,1);
 }
});
test('root aliases do not collapse downstream markers or treat the navigation A as A1',()=>{
 for(const name of ['A','A-P108','O-F265','K-M526','N-M128','O-MF190013','B-M87201'])assert.equal(YFULL_ROOT_ALIASES[name],undefined);
 assert.equal(YFULL_ROOT_ALIASES['A-P305'].target,'A1');
});
test('root mapping fails closed when marker only occurs in a child node',async()=>{
 const io={get:async()=>undefined,set:async()=>{throw Error('must not save');},now:()=>1000,id:()=>'',request:async(url:string)=>({url,status:200,body:'<ul id="tree"><li id="lA1"><a>A1</a><span class="yf-snpforhg">OTHER123</span><ul><li id="lA1a"><a>A1a</a><span class="yf-snpforhg">P305</span></li></ul></li></ul>'})};
 assert.equal((await query(io,'yfull','A-P305',false,new AbortController().signal)).status,'unmatched');
});
