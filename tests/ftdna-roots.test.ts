import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {query} from '../src/samples/service';
import {select} from '../src/samples/model';
const raw=JSON.parse(readFileSync('tests/fixtures/samples/ftdna-R-M207-root.json','utf8'));
const search=JSON.parse(readFileSync('tests/fixtures/samples/ftdna-R-search.json','utf8'));
test('all twenty audited letter entries replay their source headers and preserve independently verified targets',async()=>{
  const audit=JSON.parse(readFileSync('tests/fixtures/samples/ftdna-letter-root-headers.json','utf8'));assert.equal(audit.rows.length,20);
  for(const row of audit.rows){
    const calls:string[]=[];const io={get:async()=>undefined,set:async()=>{},now:()=>1000,id:()=>'',request:async(url:string)=>{
      calls.push(url);const response=row.responses.find((r:any)=>r.url===url);assert.ok(response,`${row.letter}: unexpected URL ${url}`);
      return {url,status:response.status,body:JSON.stringify(response.search||response.root&&{node:{...response.root,children:[],modern:[],ancient:[]}}||{})};
    }};
    const r=await query(io,'ftdna',row.mofang,false,new AbortController().signal);
    assert.equal(r.status,'ready',row.letter);assert.equal(r.target,row.target,row.letter);assert.ok(row.overlap.length>0);assert.equal(calls.length,row.responses.length);
  }
});
test('real FTDNA R alias resolves to R-M207 with root evidence, preserves partial scope and caches',async()=>{
  const data=new Map<string,any>(),calls:string[]=[];
  const io={get:async(k:string)=>data.get(k),set:async(k:string,v:any)=>{data.set(k,v);},now:()=>1000,id:()=>'',request:async(url:string)=>{
    calls.push(url);return {url,status:url.endsWith('/R.json')?403:200,body:JSON.stringify(url.includes('/HaplogroupSearch/')?search:raw)};
  }};
  const r=await query(io,'ftdna','R',false,new AbortController().signal);
  assert.equal(r.status,'ready');assert.equal(r.target,'R-M207');assert.match(r.mapping,/根节点.*R → R-M207/);
  assert.ok(select(r,false).rows.length>0);assert.equal(r.complete,false);assert.equal(calls.length,3);
  assert.equal((await query(io,'ftdna','R',false,new AbortController().signal)).cached,true);assert.equal(calls.length,3);
  await query(io,'ftdna','R',true,new AbortController().signal);assert.equal(calls.length,6);
});
test('letter root resolution rejects fuzzy, ambiguous, cross-lineage, wrong-short and unsupported roots',async()=>{
  for(const mode of ['fuzzy','ambiguous','wrong-family','wrong-short','wrong-node','no-snp','descendant-only','cross-origin','denied','A-navigation']){
    const root=structuredClone(raw),hits=structuredClone(search);const name=mode==='A-navigation'?'A':'R';
    if(mode==='fuzzy')hits[0].exact=false;
    if(mode==='ambiguous')hits.push({name:'R-OTHER1',exact:true,root_haplogroup:'R'});
    if(mode==='wrong-family')hits[0].root_haplogroup='O';
    if(mode==='wrong-short')root.node.short.name='R1';
    if(mode==='wrong-node')root.node.name='R-OTHER1';
    if(mode==='no-snp')root.node.variants=[];
    if(mode==='descendant-only'){root.node.short.name='R1';root.node.children[0].short={name:'R'};}
    if(mode==='A-navigation')hits[0]={name:'A-M91',exact:true,root_haplogroup:'A'};
    const io={get:async()=>undefined,set:async()=>{throw Error('must not cache');},now:()=>1000,id:()=>'',request:async(url:string)=>({url:mode==='cross-origin'&&url.endsWith('R-M207.json')?'https://example.com/':url,status:url.endsWith(`/${name}.json`)||mode==='denied'&&url.endsWith('R-M207.json')?403:200,body:JSON.stringify(url.includes('HaplogroupSearch')?hits:root)})};
    await assert.rejects(query(io,'ftdna',name,false,new AbortController().signal),/403/,mode);
  }
});
