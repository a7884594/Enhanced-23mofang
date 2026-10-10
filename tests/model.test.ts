import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COLORS,copyRegions,copySelections,flatten,matchCounties,percentText,naturalBreaks,colorFor,routeNode,type Atlas} from '../src/model.ts';
const fixture=JSON.parse(readFileSync('tests/fixtures/O-CTS7316.json','utf8'));
const items=copyRegions(fixture.geographicDistribution.chartItems);
const records=flatten(items);
const atlas:Atlas=JSON.parse(readFileSync('assets/counties.geo.json','utf8'));
test('live county values retain website precision and percentages',()=>{
  assert.equal(percentText(records.find(r=>r.code==='130433')!.percent),'12.50%');
  assert.equal(percentText(records.find(r=>r.code==='130481')!.percent),'9.09%');
  assert.ok(records.length>1000);
});
test('every county is accounted for exactly once',()=>{
  const {matched,unmatched}=matchCounties(records,atlas);
  assert.equal(matched.length+unmatched.length,records.length);
  assert.equal(new Set([...matched,...unmatched].map(r=>r.record)).size,records.length);
  assert.ok(matched.length>1000);
  assert.ok(matched.some(r=>r.record.code==='130521'&&r.feature.properties.group==='130500'));
  assert.ok(matched.some(r=>r.record.code==='130502'&&r.feature.properties.name==='桥东区'));
  assert.ok(matched.some(r=>r.record.code==='130433'));
});
test('districts under municipalities and directly administered counties survive flattening',()=>{
  const sample=copyRegions([{code:'11',name:'北京市',childItems:[{code:'110101',name:'东城区',percent:0,childItems:[]}]},{code:'46',name:'海南省',childItems:[{code:'4690',name:'省直辖',childItems:[{code:'469002',name:'琼海市',percent:.03}]}]}]);
  const r=flatten(sample);assert.equal(r.length,2);assert.equal(r[0].city,'');assert.equal(r[0].percent,0);
});
test('missing, zero and tiny values are distinct',()=>{
  assert.equal(percentText(null),'未提供');assert.equal(percentText(0),'0.00%');assert.equal(percentText(.00001),'<0.01%');assert.equal(percentText(.000099),'0.01%');
  assert.equal(copyRegions([{code:'130433',name:'馆陶县',percent:null}])[0].percent,null);
});
test('filter by region path, wildcard and same-name districts',()=>{
  const r=flatten(items,copySelections([[{code:'13'},{code:'1304'},{code:'0'}]]));
  assert.ok(r.length>0);assert.ok(r.every(v=>v.code.startsWith('1304')));
  assert.equal(flatten(items,[[{code:'13'},{code:'1304'},{code:'130433'}]]).length,1);
  assert.ok(flatten(items,[[{code:'130000'},{code:'0'}]]).every(v=>v.province==='河北省'));
  assert.equal(flatten(items,[[{code:'99'}]]).length,0);
});
test('natural break ties never leave gaps or overlapping colors',()=>{
  for(const values of [[0],[.05,.05,.05],[0,0,.01,.01,.3],[0,.01,.02,.03,.04,.05,.06]]){
    const bins=naturalBreaks(values);assert.equal(bins.length,Math.min(9,new Set(values).size));
    for(const v of values)assert.notEqual(colorFor(v,bins),'#e9edf1');
    for(let i=1;i<bins.length;i++)assert.equal(bins[i].min,bins[i-1].max);
  }
  assert.deepEqual(naturalBreaks([]),[]);
});
test('untrusted fields are discarded and invalid paths rejected',()=>{
  const r=copyRegions([{code:'13',name:'河北省',percent:Infinity,token:'secret',childItems:[]}]);
  assert.equal(r[0].percent,null);assert.equal('token' in r[0],false);
  assert.equal(routeNode('/ancestry/ytree/O-CTS7316/branch'),'O-CTS7316');assert.equal(routeNode('/ancestry/ytree/O-CTS7316'),null);
});
test('duplicate codes are quarantined instead of painting an arbitrary value',()=>{
  const county=records.find(r=>r.code==='130433')!;
  const result=matchCounties([county,{...county,percent:.6}],atlas);
  assert.equal(result.matched.length,0);assert.equal(result.unmatched.length,2);
});
test('frequency palette runs from green to red; gray remains reserved for missing data',()=>{
  const bins=naturalBreaks([0,.01,.02,.03,.04,.05]);
  assert.equal(colorFor(0,bins),'#1a9850');assert.equal(colorFor(.05,bins),'#d73027');assert.equal(COLORS.includes('#e9edf1'),false);
});
