import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {copyRegions,flattenCities,matchCounties,percentText,type Atlas} from '../src/model.ts';
const items=copyRegions(JSON.parse(readFileSync('tests/fixtures/O-CTS7316.json','utf8')).geographicDistribution.chartItems);
const atlas:Atlas=JSON.parse(readFileSync('assets/cities.geo.json','utf8'));
test('city values come from the city node, never a county average',()=>{
  const city=flattenCities(items).find(c=>c.code==='130400')!;
  assert.equal(percentText(city.percent),'5.49%');
  const source=items.find(p=>p.code==='13')!.childItems.find(c=>c.code==='1304')!;
  assert.equal(city.percent,source.percent);assert.ok(!flattenCities(items).some(c=>c.code==='130433'));
  const changed=structuredClone(items);changed.find(p=>p.code==='13')!.childItems.find(c=>c.code==='1304')!.childItems.forEach(c=>c.percent=.9);
  assert.equal(flattenCities(changed).find(c=>c.code==='130400')!.percent,city.percent);
});
test('municipalities use the website citywide value, not district subgroup values',()=>{
  const values=flattenCities(items);const cq=values.find(c=>c.code==='500000')!;
  assert.equal(percentText(cq.percent),'1.47%');assert.deepEqual(cq.path,['重庆市']);assert.equal(values.filter(c=>c.code.startsWith('50')).length,1);
  assert.equal(percentText(values.find(c=>c.code==='110000')!.percent),'2.66%');
});
test('county-level filters keep the containing city original value',()=>{
  const cities=flattenCities(items,[[{code:'13'},{code:'1304'},{code:'130433'}]]);
  assert.equal(cities.length,1);assert.equal(cities[0].code,'130400');assert.equal(percentText(cities[0].percent),'5.49%');
  assert.equal(flattenCities(items,[[{code:'11'},{code:'1101'},{code:'110101'}]])[0].code,'110000');
});
test('city geometry is separate from county geometry and all records are accounted for',()=>{
  assert.ok(atlas.features.filter(f=>f.properties.level==='city').length>300);assert.equal(atlas.features.some(f=>f.properties.level==='district'),false);
  const rows=flattenCities(items);const {matched,unmatched}=matchCounties(rows,atlas,'city');
  assert.equal(matched.length+unmatched.length,rows.length);assert.ok(matched.length>250);
  assert.ok(matched.some(m=>m.record.code==='130400'));assert.ok(matched.some(m=>m.record.code==='500000'));
  assert.ok(unmatched.some(m=>m.record.code==='429000'&&m.reason.includes('直辖县级')));
});
test('missing city frequency stays missing even when child counties have values',()=>{
  const source=copyRegions([{code:'13',name:'河北省',childItems:[{code:'1304',name:'邯郸市',percent:null,childItems:[{code:'130433',name:'馆陶县',percent:.8}]}]}]);
  assert.equal(flattenCities(source)[0].percent,null);
  const result=matchCounties(flattenCities(source),atlas,'city');assert.equal(result.matched.length,0);assert.equal(result.unmatched.length,1);
});
