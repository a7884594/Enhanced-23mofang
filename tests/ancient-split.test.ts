import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AncientEngine,type IO} from '../src/ancient/engine';
import {normalizeTree} from '../src/ancient/model';
import {checkSnp,mappingTarget,needsSnpQuery,type SnpCheck} from '../src/ancient/snps';
import {applyEquivalent,disambiguate,equivalentEvidence,pendingEquivalentCandidates,sameTreeFilter} from '../src/ancient/equivalent';
const f=JSON.parse(readFileSync('tests/fixtures/ancient/MF60234-equivalent.json','utf8'));
// Relations observed in the normal tree; IDs 1/2/3 are local simulation IDs.
const branches=[{hid:1,parent:0,name:'O-BY107602',equivalent_mutations:{equivalent_count:18}},{hid:2,parent:1,name:'O-BY7621',equivalent_mutations:{equivalent_count:0}},{hid:3,parent:2,name:'O-Y5702',equivalent_mutations:{equivalent_count:16}}];
const raw=(rows:any[])=>({code:1,data:{ytree:rows}});
const page=normalizeTree(raw(branches));
const checks=():SnpCheck[]=>f.local.map((s:string)=>checkSnp(normalizeTree(raw(s==='BY7621'?branches.slice(1):s==='F25479'?branches.slice(2):branches)),s,f.local));
function verified(){let c=checks();for(const candidate of pendingEquivalentCandidates(c))c=applyEquivalent(c,equivalentEvidence(candidate,candidate.id==='1'?f.groups:candidate.id==='2'?[]:f.downstreamGroups,f.local,1,'visible-dialog'));return c;}
test('MF60234 direct target uses primary alias despite source splitting its local SNP block',()=>{
  const c=checks();assert.equal(mappingTarget(c),'');assert.equal(pendingEquivalentCandidates(c).length,3);
  const resolved=disambiguate(verified(),f.marker);assert.equal(mappingTarget(resolved),'O-BY107602');assert.ok(resolved.filter(c=>c.candidate?.id!=='1').every(c=>c.note?.includes('树粒度不同')));
});
test('missing ancestry, competing primary aliases and tentative paths cannot resolve splits',()=>{
  assert.equal(mappingTarget(disambiguate(verified().map(c=>({...c,descendants:[]})),f.marker)),'');
  const c=verified();const e=equivalentEvidence({id:'3',marker:'O-Y5702',count:2},['MF60234','F25479'],f.local,1,'visible-dialog');
  assert.equal(mappingTarget(disambiguate(applyEquivalent(c,e),f.marker)),'');
  const tentative=structuredClone(page);tentative.branches[1].tentative=true;
  assert.deepEqual(checkSnp(tentative,'MF60234',f.local).descendants,[]);
  assert.equal(needsSnpQuery(checks().map(({descendants,...c}:any)=>c),'MF60234'),true);
});
test('sync verifies split targets, direct returns AU40111 and successful match is reused',async()=>{
  const store=new Map<string,any>();let id=0;
  const sample={sid:40111,parent:1,name:'FA0215 甘肃省张掖市甘州区黑水国遗址 汉末',haplogroup:'O-BY107602',stype:2,sid_encrypted:f.sampleUrl.split('/').at(-1).replace('.html','')};
  const io:IO={get:async k=>structuredClone(store.get(k)),set:async(k,v)=>{store.set(k,structuredClone(v));},id:()=>String(++id),now:()=>Date.now(),request:async url=>{
    const s=new URL(url).searchParams.get('snp');const rows=s==='BY7621'?branches.slice(1):s==='F25479'?branches.slice(2):[...branches,sample];
    return {status:200,url,body:url===f.sampleUrl?readFileSync('tests/fixtures/ancient/AU40111.html','utf8'):JSON.stringify(raw(rows))};
  }};
  const engine=new AncientEngine(io);let j=await engine.start(f.marker,'direct',false,f.local);
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,2));j=(await engine.get(j.id))!;if(j.status!=='running')break;}
  assert.equal(j.status,'sync');j=await engine.beginSource(j.id);
  for(const candidate of pendingEquivalentCandidates(j.snpChecks!))j=await engine.sourceEquivalent(j.id,candidate.id,candidate.id==='1'?f.groups:candidate.id==='2'?[]:f.downstreamGroups,'visible-dialog',j.mappingToken!);
  assert.equal(j.target,'O-BY107602');assert.equal(j.mappingReady,true);
  await engine.run(j.id);j=(await engine.get(j.id))!;
  assert.equal(j.complete,true);assert.deepEqual(j.samples.map(s=>s.au),['AU40111']);assert.equal(j.samples[0].period,'汉末');
  assert.equal((await engine.start(f.marker,'direct',false)).matchReused,true);
});
test('primary name on a descendant resolves when the node also carries upstream ancestor SNPs',()=>{
  // Coarser 23mofang node: its SNP block splits across a TheYtree ancestor and
  // its descendant, with the primary name sitting on the descendant.
  const branches=[
    {hid:26524,parent:31566,name:'O-FTB26869',equivalent_mutations:{equivalent_count:2}},
    {hid:52866,parent:26524,name:'O-TYT168883',equivalent_mutations:{equivalent_count:2}},
  ];
  const raw=(rows:any[])=>({code:1,data:{ytree:rows}});
  const local=['MF159349','MF159747','MF159324','MF161210'];
  const search=(s:string)=>normalizeTree(raw(s==='MF159324'||s==='MF161210'?branches.slice(1):branches));
  let checks=local.map(s=>checkSnp(search(s),s,local));
  const ancestor={id:'26524',marker:'O-FTB26869',count:2};
  const descendant={id:'52866',marker:'O-TYT168883',count:2};
  checks=applyEquivalent(checks,equivalentEvidence(ancestor,['TYT14605/MF159349','TYT51252/MF159747'],local,1,'visible-dialog'));
  checks=applyEquivalent(checks,equivalentEvidence(descendant,['TYT168883/MF161210','TYT92183/MF159324'],local,1,'visible-dialog'));
  assert.equal(mappingTarget(checks),'');
  const resolved=disambiguate(checks,'O-MF159324');
  assert.equal(mappingTarget(resolved),'O-TYT168883');
  assert.ok(resolved.filter(c=>c.candidate?.id==='26524').every(c=>c.note?.includes('上游')&&c.target===''));
});
test('sameTreeFilter keeps the primary anchor and its subtree, discards other subtrees',()=>{
  const anchor={id:'26524',marker:'O-FTB26869',count:4};
  const descendant={id:'31572',marker:'O-BY37911',count:0};
  const otherSubtree={id:'24306',marker:'O-A9472',count:32};
  const checks=[
    {snp:'MF160381',target:'',issue:'',url:'',candidate:anchor,descendants:['O-TYT168883','O-BY37911','O-FT131941']},
    {snp:'FTB26864',target:'',issue:'',url:'',candidate:anchor,descendants:['O-TYT168883','O-BY37911','O-FT131941']},
    {snp:'FTB48163',target:'',issue:'',url:'',candidate:descendant,descendants:[]},
    {snp:'BY156070',target:'',issue:'',url:'',candidate:otherSubtree,descendants:['O-SK1759','O-TYT136059']},
  ];
  const filtered=sameTreeFilter(checks,'O-MF160381');
  assert.ok(filtered.find(c=>c.snp==='MF160381')?.candidate);
  assert.ok(filtered.find(c=>c.snp==='FTB48163')?.candidate);
  assert.equal(filtered.find(c=>c.snp==='BY156070')?.candidate,undefined);
  assert.ok(filtered.find(c=>c.snp==='BY156070')?.note?.includes('不同子树'));
  // No primary candidate → everything is kept (fallback to other markers).
  assert.equal(sameTreeFilter([{snp:'BY156070',target:'',issue:'',url:'',candidate:otherSubtree,descendants:[]}],'O-OTHER1').length,1);
});
