import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {AncientEngine,type IO} from '../src/ancient/engine';
import {checkSnp,mappingTarget,needsSnpQuery} from '../src/ancient/snps';
import {equivalentEvidence,applyEquivalent,disambiguate,dialogGroups} from '../src/ancient/equivalent';
import {parseDetail} from '../src/ancient/parser';
const read=(n:string)=>JSON.parse(readFileSync(`tests/fixtures/ancient/${n}.json`,'utf8'));
const fixture=read('MF190013-searches'),ft=read('FT130664-equivalent'),by=read('BY136818-equivalent');
const checks=()=>fixture.searches.map((r:any)=>checkSnp(r.page,r.snp,fixture.nodeSnps));
const annotated=read('MF15505-equivalent');
test('MF15505 matches Z44059 using plain aliases while preserving unused (T) markers',()=>{
 const e=equivalentEvidence(annotated.candidate,annotated.groups,annotated.local,Date.now(),'visible-dialog');
 assert.deepEqual(e.overlap,['MF15505','MF170687','ZS3220']);assert.deepEqual(e.ignored,['Z46519(T)','TY478604(T)']);assert.deepEqual(e.groups,annotated.groups);assert.ok(!e.snps.includes('Z46519'));
 const records=annotated.local.map((s:string)=>({snp:s,target:'',issue:['MF15505','MF170687','ZS3220'].includes(s)?'待核对':'',url:'',candidate:s==='ZS3220'?annotated.other.candidate:['MF15505','MF170687'].includes(s)?annotated.candidate:undefined}));
 const other=equivalentEvidence(annotated.other.candidate,annotated.other.groups,annotated.local,Date.now(),'visible-dialog');
 const resolved=disambiguate(applyEquivalent(applyEquivalent(records,e),other),annotated.marker);
 assert.equal(mappingTarget(resolved),'O-Z44059');assert.ok(resolved.find(c=>c.snp==='ZS3220')?.note);
});
test('annotations alone never become SNP matching evidence; incomplete old checks can retry',()=>{
 assert.throws(()=>equivalentEvidence({id:'34',marker:'O-Z44059',count:1},['MF15505(T)'],annotated.local,0,'visible-dialog'));
 assert.equal(needsSnpQuery([{snp:'ZS3220',target:'',issue:'待核对',url:''}],'ZS3220'),true);
 assert.equal(needsSnpQuery([{snp:'ZS3220',target:'',issue:'待核对',url:'',candidate:annotated.other.candidate}],'ZS3220'),false);
});
const evidence=(f:any)=>equivalentEvidence(f.candidate,f.groups,fixture.nodeSnps,Date.now(),'visible-dialog');
test('real logged-in slash aliases establish MF190013 and Y86790 overlap',()=>{
 const e=evidence(ft);assert.deepEqual(e.overlap,['MF190013','Y86790']);assert.ok(e.snps.includes('TYT278842'));assert.equal(e.groups.length,2);
 assert.equal(mappingTarget(checks()),'');assert.equal(checks()[0].candidate.marker,'O-FT130664');
});
test('reused Y86790 does not import the unrelated BY136818 branch',()=>{
 let c=applyEquivalent(checks(),evidence(ft));assert.equal(c.some((r:any)=>r.issue),true);
 c=applyEquivalent(c,evidence(by));assert.equal(mappingTarget(c),'');
 c=disambiguate(c,fixture.marker);assert.equal(mappingTarget(c),'O-FT130664');
 assert.ok(c.find((v:any)=>v.snp==='Y86790')!.note);assert.equal(c.find((v:any)=>v.snp==='Y86790')!.target,'');
});
test('no shared SNP, incomplete lists, tentative names and markup never become aliases',()=>{
 assert.equal(equivalentEvidence(ft.candidate,['OTHER1','OTHER2'],fixture.nodeSnps,0,'visible-dialog').overlap.length,0);
 assert.throws(()=>equivalentEvidence(ft.candidate,['Y86790'],fixture.nodeSnps,0,'visible-dialog'));
 assert.throws(()=>equivalentEvidence(ft.candidate,['MF190013?','Y86790'],fixture.nodeSnps,0,'visible-dialog'));
 assert.throws(()=>equivalentEvidence(ft.candidate,['<script>1</script>','Y86790'],fixture.nodeSnps,0,'visible-dialog'));
});
test('two candidates containing the current primary alias remain ambiguous',()=>{
 const a=evidence(ft),b=equivalentEvidence({...by.candidate,count:2},['MF190013','Y86790'],fixture.nodeSnps,0,'visible-dialog');
 assert.equal(mappingTarget(disambiguate(applyEquivalent(applyEquivalent(checks(),a),b),fixture.marker)),'');
});
test('dialog fallback is tied to the visible exact node title and preserves slash groups',()=>{
 const {document}=parseHTML('<div id="equivalentMutationsModal" style="display:block"><h4 id="equivalentMutationsModalTitle">O-FT130664</h4><div id="equivalentMutationsList">Y86790, TYT278842/MF190013</div></div>');
 assert.deepEqual(dialogGroups(document,ft.candidate),ft.groups);assert.equal(dialogGroups(document,by.candidate),null);
 document.querySelector<HTMLElement>('#equivalentMutationsModal')!.style.display='none';assert.equal(dialogGroups(document,ft.candidate),null);
});
const raw=(p:any)=>({code:1,data:{ytree:[...p.branches.map((b:any)=>({hid:b.id,parent:b.parent,name:b.marker,isParent:b.pending?1:0,equivalent_mutations:{equivalent_count:b.equivalentCount}})),...p.samples.map((s:any)=>({sid:s.au.slice(2),parent:s.parentId,name:s.name,haplogroup:s.marker,stype:2,sid_encrypted:s.url.split('/').at(-1).replace('.html','')}))]}});
function harness(){
 const store=new Map<string,any>(),urls:string[]=[];let id=0;
 const io:IO={get:async k=>structuredClone(store.get(k)),set:async(k,v)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>`eq-${++id}`,request:async(url,signal)=>{
   urls.push(url);if(signal.aborted)throw Error('aborted');const s=new URL(url).searchParams.get('snp');
   let body:string;
   if(s)body=JSON.stringify(raw(fixture.searches.find((r:any)=>r.snp===s).page));
   else if(url.includes('/sample/')){const a=fixture.searches[0].page.samples.find((v:any)=>v.url===url);body=readFileSync(`tests/fixtures/ancient/${a.au}.html`,'utf8');}
   else body=JSON.stringify(raw(fixture.searches[0].page));
   return {status:200,url,body};
 }};return {engine:new AncientEngine(io),store,urls};
}
async function wait(h:ReturnType<typeof harness>,id:string){for(let i=0;i<200;i++){const j=await h.engine.get(id);if(j?.status!=='running')return j!;await new Promise(r=>setTimeout(r,5));}throw Error('timeout');}
async function resolve(h:ReturnType<typeof harness>,id:string){const j=await h.engine.beginSource(id);for(const f of [ft,by])await h.engine.sourceEquivalent(id,f.candidate.id,f.groups,'authenticated-page',j.mappingToken!);return (await h.engine.get(id))!;}
test('end to end source sync resolves rename and confirms exactly the two direct ancient samples',async()=>{
 const h=harness();let j=await wait(h,(await h.engine.start(fixture.marker,'direct',false,fixture.nodeSnps)).id);
 assert.equal(j.status,'sync');assert.equal(j.complete,false);assert.equal(j.samples.length,0);
 j=await resolve(h,j.id);assert.equal(j.mappingReady,true);assert.equal(j.target,'O-FT130664');
 j=await h.engine.adopt(j.id,fixture.searches[0].page);
 for(const s of j.samples)await h.engine.sourceDetail(j.id,s.au,parseDetail(readFileSync(`tests/fixtures/ancient/${s.au}.html`,'utf8'),s.url));
 j=await h.engine.finishSource(j.id);assert.equal(j.complete,true);assert.deepEqual(j.samples.map(s=>s.au),['AU82800','AU82840']);assert.ok(j.samples.every(s=>s.path.join()==='O-FT130664'));
 const cached=await h.engine.start(fixture.marker,'direct',false,fixture.nodeSnps);assert.equal(cached.cached,true);
 const fresh=await wait(h,(await h.engine.start(fixture.marker,'direct',true,fixture.nodeSnps)).id);assert.equal(fresh.mappingReady,false);assert.equal(fresh.status,'sync');
 assert.ok(h.urls.every(u=>!u.includes('getEquivalentMutationsDetail')));
});
test('verified source lists are reusable for another scope with locally recomputed overlap',async()=>{
 const h=harness();const j=await wait(h,(await h.engine.start(fixture.marker,'direct',false,fixture.nodeSnps)).id);await resolve(h,j.id);
 const d=await wait(h,(await h.engine.start(fixture.marker,'downstream',false,fixture.nodeSnps)).id);assert.equal(d.target,'O-FT130664');assert.equal(d.complete,true);assert.equal(d.samples.length,2);
});
test('paused or superseded mapping tokens cannot import equivalent lists',async()=>{
 const h=harness();const j=await wait(h,(await h.engine.start(fixture.marker,'direct',false,fixture.nodeSnps)).id);
 const first=await h.engine.beginSource(j.id);const second=await h.engine.beginSource(j.id);
 await assert.rejects(h.engine.sourceEquivalent(j.id,ft.candidate.id,ft.groups,'visible-dialog',first.mappingToken!));
 await h.engine.pause(j.id);await assert.rejects(h.engine.sourceEquivalent(j.id,ft.candidate.id,ft.groups,'visible-dialog',second.mappingToken!));
 assert.equal((await h.engine.get(j.id))?.mappingReady,false);
});
