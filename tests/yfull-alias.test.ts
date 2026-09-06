import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {query} from '../src/samples/service';
import {yfullSnpIndex} from '../src/samples/adapters';
import {select} from '../src/samples/model';
const index=readFileSync('tests/fixtures/samples/yfull-N-B482-index.html','utf8');
const canonical=readFileSync('tests/fixtures/samples/yfull-N-Y6503.html','utf8');
const url=(name:string)=>`https://www.yfull.com/tree/${name}/`;
const page=(name:string,snps:string,children='')=>`<li id="l${name}"><a>${name}</a><span class="yf-snpforhg">${snps}</span>${children?'<ul>'+children+'</ul>':''}</li>`;
const tree=(body:string)=>'<ul id="tree">'+body+'</ul>';
function harness(indexBody=index,canonicalBody=canonical){
  const data=new Map<string,any>(),calls:string[]=[];
  const io={get:async(k:string)=>data.get(k),set:async(k:string,v:any)=>{data.set(k,v);},now:()=>100000,id:()=>'',request:async(request:string)=>{
    calls.push(request);
    if(request===url('N-B482')||request===url('N-NONE123'))return {status:404,url:request,body:'not found'};
    if(request===url('N'))return {status:200,url:request,body:indexBody};
    if(request===url('N-Y6503'))return {status:200,url:request,body:canonicalBody};
    throw Error('unexpected URL '+request);
  }};
  return {data,calls,io};
}
test('real B482 alias resolves through YFull own SNP index, validates canonical root and caches only its subtree',async()=>{
  const h=harness(),signal=new AbortController().signal;
  const r=await query(h.io,'yfull','N-B482',false,signal);
  assert.equal(r.status,'ready');assert.equal(r.target,'N-Y6503');assert.equal(r.url,url('N-Y6503'));assert.match(r.mapping,/共同SNP：B482/);
  assert.deepEqual(h.calls,[url('N-B482'),url('N'),url('N-Y6503')]);
  assert.equal(r.nodes.some(n=>n.name==='N'),false);assert.ok(select(r,true).rows.length>0);
  assert.ok(select(r,false).rows.every(s=>s.node==='N-Y6503'||s.node==='N-Y6503*'));
  const child=r.nodes.find(n=>n.name==='N-Y147969')!;assert.equal(child.parent,'N-Y6503');assert.equal(child.snps.includes('B482'),false);
  assert.equal((await query(h.io,'yfull','N-B482',false,signal)).cached,true);assert.equal(h.calls.length,3);
  await query(h.io,'yfull','N-NONE123',false,signal);assert.equal(h.calls.filter(x=>x===url('N')).length,1);
  await query(h.io,'yfull','N-B482',true,signal);assert.equal(h.calls.filter(x=>x===url('N')).length,2);
});
test('SNP index excludes sample data and keeps exact unannotated aliases',()=>{
  const values=yfullSnpIndex(tree(page('N','M231',page('N-Y6503','FGC28394/Y6584/B482 B4820 B482(H)')+'<li><span class="yf-s-name">PRIVATE SAMPLE</span></li>')));
  assert.deepEqual(values[1].snps,['FGC28394','Y6584','B482','B4820']);
  assert.equal(JSON.stringify(values).includes('PRIVATE'),false);
});
test('ambiguous, annotated-only, substring and cross-lineage matches never choose a candidate',async()=>{
  for(const nodes of [page('N-Y6503','B482')+page('N-X1','B482'),page('N-Y6503','B482(H)'),page('N-Y6503','B4820'),page('R-Y6503','B482')]){
    const h=harness(tree(page('N','M231',nodes)));
    const r=await query(h.io,'yfull','N-B482',false,new AbortController().signal);
    assert.equal(r.status,'unmatched');assert.equal(h.calls.length,2);assert.equal(h.data.has('samples.v2.yfull.N-B482.N-B482'),false);
  }
});
test('canonical page must confirm the root itself, never a descendant, ancestor, or duplicate SNP',async()=>{
  for(const body of [tree(page('N-Y6503','Y6503',page('N-Y147969','B482'))),tree(page('N','B482',page('N-Y6503','B482'))),tree(page('N-Y6503','B482',page('N-X1','B482'))),tree(page('N-Y147969','B482'))]){
    const h=harness(index,body);const r=await query(h.io,'yfull','N-B482',false,new AbortController().signal);
    assert.equal(r.status,'unmatched');assert.match(r.message,/复核/);assert.equal(r.nodes.length,0);
  }
});
test('access restrictions, login pages, wrong origins, oversized indexes and cancellation remain errors',async()=>{
  for(const mode of ['403','login','origin','size','wrong-root','cancel']){
    const h=harness();const original=h.io.request;const controller=new AbortController();
    h.io.request=async request=>{
      if(request!==url('N'))return original(request);
      h.calls.push(request);if(mode==='cancel')controller.abort();
      return {status:mode==='403'?403:200,url:mode==='origin'?'https://example.com/':request,body:mode==='login'?'<input type="password">':mode==='size'?' '.repeat(8_000_001):mode==='wrong-root'?tree(page('R','M207',page('N-Y6503','B482'))):index};
    };
    await assert.rejects(query(h.io,'yfull','N-B482',false,controller.signal),Error,mode);assert.equal(h.data.has('samples.v2.yfull.N-B482.N-B482'),false);
  }
});
test('direct access denied does not trigger alternate requests and a working direct node keeps one request',async()=>{
  for(const status of [403,200]){
    let calls=0;const io={get:async()=>undefined,set:async()=>{},now:()=>1,id:()=>'',request:async(request:string)=>{calls++;return {status,url:request,body:tree(page('N-B482','B482'))};}};
    if(status===403)await assert.rejects(query(io,'yfull','N-B482',false,new AbortController().signal),/403/);
    else assert.equal((await query(io,'yfull','N-B482',false,new AbortController().signal)).target,'N-B482');
    assert.equal(calls,1);
  }
});
