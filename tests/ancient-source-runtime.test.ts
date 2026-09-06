import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {AncientEngine,type IO} from '../src/ancient/engine';
import {checkSnp} from '../src/ancient/snps';
import type {QueryResult} from '../src/ancient/model';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const source=(await build({entryPoints:['src/ancient/source.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const f=JSON.parse(readFileSync('tests/fixtures/ancient/MF190013-searches.json','utf8'));
const ft=JSON.parse(readFileSync('tests/fixtures/ancient/FT130664-equivalent.json','utf8'));
const by=JSON.parse(readFileSync('tests/fixtures/ancient/BY136818-equivalent.json','utf8'));
const p=f.searches[0].page;
const tree={code:1,data:{ytree:[...p.branches.map((b:any)=>({hid:b.id,parent:b.parent,name:b.marker,isParent:b.pending?1:0})),...p.samples.map((s:any)=>({sid:s.au.slice(2),name:s.name,parent:s.parentId,haplogroup:s.marker,stype:2,sid_encrypted:s.url.split('/').at(-1).replace('.html','')}))]}};
async function run(loggedIn:boolean,confirmedAlias=false){
 const store=new Map();let seq=0;const requests:any[]=[];
 const io:IO={get:async k=>structuredClone(store.get(k)),set:async(k,v)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>`token-${++seq}`,request:async()=>{throw Error('Background must not request authenticated SNPs');}};
 const engine=new AncientEngine(io);
 const j:QueryResult={id:'runtime',marker:f.marker,target:f.marker,nodeSnps:f.nodeSnps,snpChecks:f.searches.map((r:any)=>checkSnp(r.page,r.snp,f.nodeSnps)),mappingReady:false,scope:'direct',status:'sync',mapping:'',createdAt:Date.now(),updatedAt:Date.now(),cached:false,complete:false,samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],excluded:0,message:''};await engine.save(j);
 if(confirmedAlias){j.target='O-FT130664';j.mappingReady=true;j.nodeSnps=undefined;j.snpChecks=[];await engine.save(j);}
 const dom=new JSDOM('<body></body>',{url:ft.source,runScripts:'outside-only'});const w=dom.window as any;
 w.AbortSignal=AbortSignal;
 w.fetch=async(url:string,opts:any)=>{requests.push({url,credentials:opts.credentials});let body;
   if(url.includes('getEquivalentMutationsDetail'))body=JSON.stringify(loggedIn?{code:1,data:{equivalent_snps:url.includes('44659')?ft.groups:by.groups}}:{code:0,msg:'请先登录'});
   else if(url.includes('/sample/')){const s=p.samples.find((s:any)=>s.url===url);body=readFileSync(`tests/fixtures/ancient/${s.au}.html`,'utf8');}
   else body=JSON.stringify(tree);
   return {ok:true,status:200,url,text:async()=>body};
 };
 w.chrome={runtime:{sendMessage:async(m:any)=>{try{let value;
   switch(m.type){
    case 'anc.sourceContext':value=await engine.get(j.id);break;
    case 'anc.sourceBegin':value=await engine.beginSource(j.id);break;
    case 'anc.sourceEquivalent':value=await engine.sourceEquivalent(j.id,m.candidateId,m.groups,m.method,m.mappingToken);break;
    case 'anc.source':value=await engine.adopt(j.id,m.page);break;
    case 'anc.sourceDetail':value=await engine.sourceDetail(j.id,m.au,m.detail);break;
    case 'anc.sourceFinish':value=await engine.finishSource(j.id,m.error);break;
    case 'anc.sourceProblem':value=await engine.sourceProblem(j.id,m.error,m.mappingToken);break;
    default:throw Error(`Unexpected ${m.type}`);
   }return {ok:true,value};
 }catch(e){return {ok:false,error:String(e)};}}}};
 w.eval(source);
 try{
  for(let i=0;i<200;i++){const current=await engine.get(j.id);if(current?.complete||current?.message.includes('请先在TheYtree正常登录'))return {job:current,requests};await new Promise(r=>setTimeout(r,30));}
  throw Error(`Source script timed out: ${(await engine.get(j.id))?.message}`);
 }finally{dom.window.close();}
}
test('bundled source content script uses normal same-origin login and finishes two-sample sync',async()=>{
 const {job,requests}=await run(true);assert.equal(job.complete,true);assert.equal(job.target,'O-FT130664');assert.equal(job.samples.length,2);
 assert.equal(requests.filter(r=>r.url.includes('getEquivalentMutationsDetail')).length,2);assert.ok(requests.every(r=>r.credentials==='same-origin'));
});
test('logged-out response remains incomplete and reports login requirement to 23mofang',async()=>{
 const {job,requests}=await run(false);assert.equal(job.complete,false);assert.equal(job.status,'sync');assert.equal(job.samples.length,0);assert.match(job.message,/正常登录/);assert.equal(requests.length,1);
});

test('confirmed aliases without a runtime SNP list are not rejected as missing same-name nodes',async()=>{
 const {job,requests}=await run(true,true);assert.equal(job.complete,true);assert.equal(job.samples.length,2);
 assert.ok(requests.every(r=>!r.url.includes('getEquivalentMutationsDetail')&&!r.url.includes('?snp=')));
});
