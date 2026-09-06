import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {snps,checkSnp,mappingTarget,lineage,searchableSnps} from '../src/ancient/snps';
import {normalizeTree} from '../src/ancient/model';
import {AncientEngine,cacheKey,jobKey,type IO} from '../src/ancient/engine';
import {localSnps} from '../src/ancient/mofang-bridge';
import {htmlSnps} from '../src/ancient/nuxt-snps';
import {parseDetail} from '../src/ancient/parser';
const records=JSON.parse(readFileSync('tests/fixtures/ancient/MF9915-snps.json','utf8').replace(/^\uFEFF/,''));
const values=snps(records.map((r:any)=>r.snp));
const raw=(r:any)=>({code:1,data:{ytree:[...r.branches,...r.ancient]}});
test('real nine SNP queries: seven corroborate BY220310, two default trees are not matches',()=>{
  const checks=records.map((r:any)=>checkSnp(normalizeTree(raw(r)),r.snp,values));
  assert.equal(checks.filter((c:any)=>c.target==='O-BY220310').length,7);
  assert.equal(checks.filter((c:any)=>c.target==='').length,2);
  assert.equal(checks.some((c:any)=>c.issue),false);
  assert.equal(mappingTarget(checks),'O-BY220310');
  assert.equal(records[0].ancient[0].sid,75605);assert.equal(records[0].ancient[0].parent,21717);
});
test('split nodes and uncorroborated canonical names cannot establish unique identity',()=>{
  const p=normalizeTree({code:1,data:{ytree:[{hid:1,parent:0,name:'O-OTHER123'}]}});
  assert.ok(checkSnp(p,'MF9915',values).issue);
  assert.equal(mappingTarget([{snp:'A1',target:'O-A1',issue:'',url:''},{snp:'B1',target:'O-B1',issue:'',url:''}]),'');
});
test('real ancient detail confirms AU75605 type and the actual BY220310 placement',()=>{
  const d=parseDetail(readFileSync('tests/fixtures/ancient/AU75605.html','utf8'),'https://www.theytree.com/sample/6d7a0fb3911021aaadd9d3d7615fe4b0.html');
  assert.equal(d.type,'ancient');assert.equal(d.sample?.au,'AU75605');assert.equal(d.sample?.marker,'O-BY220310');assert.equal(d.sample?.coverage,.0669);
  assert.deepEqual(values,JSON.parse(readFileSync('tests/fixtures/ancient/MF9915-node.json','utf8')).snps);
});
test('node-local D3 SNPs are isolated from ancestors, children and private fields',()=>{
  const {document}=parseHTML('<div class="tree-wrapper"><svg><g class="node"><text class="label">O-MF9915</text></g></svg></div>');
  (document.querySelector('g') as any).__data__={data:{id:'O-MF9915',rsids:values,token:'PRIVATE',children:[{rsids:['CHILD1']}],nodePaths:[{rsids:['ANCESTOR1']}]}};
  assert.deepEqual(localSnps('O-MF9915',document,null),values);assert.deepEqual(localSnps('O-CTS10738',document,null),[]);
});
test('SSR fallback decodes literal rsids without executing page code',()=>{
  const html='<script>window.__NUXT__=(function(a){return {data:[{treeData:{id:a,rsids:["MF9915","BY220310"]}}]}}("O-MF9915"));</script>';
  assert.deepEqual(htmlSnps(html,'O-MF9915'),['BY220310','MF9915']);
  assert.throws(()=>htmlSnps('<script>window.__NUXT__=fetch("https://evil.invalid");</script>','O-MF9915'));
});
function harness(){
 const store=new Map<string,any>(),calls:string[]=[];let seq=0;
 const io:IO={get:async k=>structuredClone(store.get(k)),set:async(k,v)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>`snp-${++seq}`,request:async(url,signal)=>{
   if(signal.aborted)throw Error('aborted');calls.push(url);const u=new URL(url);const s=u.searchParams.get('snp');
   if(s)return {status:200,url,body:JSON.stringify(raw(records.find((r:any)=>r.snp===s)))};
   // Use real branches but omit sample payload here to isolate resolution/cache tests.
   return {status:200,url,body:JSON.stringify({code:1,data:{ytree:records[0].branches.map((b:any)=>({...b,isParent:0}))}})};
 }};
 return {engine:new AncientEngine(io),store,calls};
}
async function wait(h:ReturnType<typeof harness>,id:string){for(let i=0;i<100;i++){const j=await h.engine.get(id);if(j?.status!=='running')return j!;await new Promise(r=>setTimeout(r,5));}throw Error('timeout');}
test('engine checks every SNP, resolves a different primary name, versions cache and invalidates changed lists',async()=>{
 const h=harness();h.store.set('anc.cache.O-MF9915.direct',{complete:true,updatedAt:Date.now(),samples:[]});
 let j=await wait(h,(await h.engine.start('O-MF9915','direct',false,values)).id);
 assert.equal(j.target,'O-BY220310');assert.equal(j.complete,true);assert.equal(j.snpChecks?.length,9);
 assert.equal(h.calls.filter(u=>u.includes('?snp=')).length,9);assert.ok(h.store.has(cacheKey('O-MF9915','direct')));
 j=await h.engine.start('O-MF9915','direct',false,values);assert.equal(j.cached,true);
 j=await wait(h,(await h.engine.start('O-MF9915','direct',false,['BY220310'])).id);assert.equal(j.cached,false);assert.equal(j.snpChecks?.length,1);
});
test('normal-page SNP sync can resolve an initially different primary name before adopting samples',async()=>{
 const h=harness();const j=await wait(h,(await h.engine.start('O-MF9915','direct',false,values)).id);
 j.mappingReady=false;j.target='O-MF9915';j.snpChecks=[];j.status='sync';j.complete=false;await h.engine.save(j);
 for(const r of records)await h.engine.sourceSnp(j.id,r.snp,normalizeTree(raw(r)));
 const resolved=await h.engine.get(j.id);assert.equal(resolved?.target,'O-BY220310');assert.equal(resolved?.mappingReady,true);
 const adopted=await h.engine.adopt(j.id,normalizeTree(raw(records[0])));assert.equal(adopted.samples[0].au,'AU75605');assert.deepEqual(adopted.samples[0].path,['O-BY220310']);
});
test('pausing prevents stale normal-page SNP resolution from changing target',async()=>{
 const h=harness();const j=await wait(h,(await h.engine.start('O-MF9915','direct',false,values)).id);
 j.mappingReady=false;j.target='O-MF9915';j.complete=false;j.status='sync';await h.engine.save(j);await h.engine.pause(j.id);
 await assert.rejects(h.engine.sourceSnp(j.id,'BY220310',normalizeTree(raw(records[0]))));
 assert.equal((await h.engine.get(j.id))?.target,'O-MF9915');
});
test('lineage exposes only single-letter roots for cross-lineage filtering',()=>{
 assert.equal(lineage('O-MF160381'),'O');assert.equal(lineage('I-CTS11871'),'I');assert.equal(lineage('A0'),'A');
 assert.equal(lineage('ROOT'),'ROOT');assert.equal(lineage('BT-M91'),'');assert.equal(lineage('CT-M168'),'');
});
test('cross-lineage SNP hits are skipped and never become candidates',()=>{
 const iPage=normalizeTree({code:1,data:{ytree:[{hid:5269,parent:5161,name:'I-CTS11871',equivalent_mutations:{equivalent_count:0}}]}});
 const c=checkSnp(iPage,'S3673',['MF160381','S3673'],'O-MF160381');
 assert.equal(c.candidate,undefined);assert.equal(c.target,'');assert.equal(c.issue,'');assert.ok(c.note?.includes('跨谱系'));
 const plain=checkSnp(iPage,'S3673',['MF160381','S3673']);
 assert.equal(plain.candidate?.marker,'I-CTS11871');assert.equal(plain.issue,'需登录TheYtree核对该候选节点的等价SNP列表');
});
test('searchableSnps puts the primary marker first and keeps the rest intact',()=>{
 assert.deepEqual(searchableSnps(['A1','MF160381','B1'],'O-MF160381'),['MF160381','A1','B1']);
 assert.deepEqual(searchableSnps(['A1','B1'],'O-MF160381'),['A1','B1']);
});
