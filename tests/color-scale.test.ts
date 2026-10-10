import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COLORS,NO_DATA,naturalBreaks,colorFor,copyRegions,flatten,flattenCities,matchCounties,type Atlas} from '../src/model';
import {prepareAtlas} from '../src/geography';

test('natural breaks handle empty, invalid, zero, constant and sparse frequencies',()=>{
  assert.deepEqual(naturalBreaks([NaN,Infinity,-.1,1.01]),[]);
  for(const value of [0,.02,1]){
    const bins=naturalBreaks([value,value,value]);
    assert.equal(bins.length,1);assert.equal(bins[0].color,'#fee08b');
    assert.equal(colorFor(value,bins),'#fee08b');
  }
  assert.equal(naturalBreaks([0,.01,.02]).length,3);
  assert.equal(colorFor(NaN,naturalBreaks([0,.5])),NO_DATA);
  assert.equal(colorFor(-1,naturalBreaks([0,.5])),NO_DATA);
  assert.equal(colorFor(1,naturalBreaks([0,.5])),NO_DATA);
});

test('nine colors retain anchors and RGB midpoint colors',()=>{
  const anchors=['#1a9850','#91cf60','#fee08b','#fc8d59','#d73027'];
  assert.deepEqual(COLORS.filter((_,i)=>i%2===0),anchors);
  for(let i=0;i<4;i++){
    const rgb=(s:string)=>[1,3,5].map(pos=>parseInt(s.slice(pos,pos+2),16));
    const a=rgb(anchors[i]),b=rgb(anchors[i+1]);
    assert.deepEqual(rgb(COLORS[i*2+1]),a.map((v,j)=>Math.round((v+b[j])/2)));
  }
});

test('each raw boundary belongs to exactly one bin, with permutation stability',()=>{
  const values=[0,0,.00001,.01,.011,.012,.03,.05,.08,.13,.14,.15,.2,.4,1];
  const original=[...values],bins=naturalBreaks(values);
  assert.equal(bins.length,9);assert.deepEqual(values,original);
  assert.deepEqual(naturalBreaks([...values].reverse()),bins);
  for(const value of [...values,...bins.map(b=>b.max)]){
    const hits=bins.filter((b,i)=>(i===0?value>=b.min:value>b.min)&&value<=b.max);
    assert.equal(hits.length,1);assert.equal(colorFor(value,bins),hits[0].color);
  }
  assert.equal(bins[0].min,0);assert.equal(bins.at(-1)!.max,1);
  for(let i=1;i<bins.length;i++)assert.equal(bins[i].min,bins[i-1].max);
});

test('duplicate observations retain administrative-region weight',()=>{
  const values=[0,.01,.02,.03,.04,.05,.06,.07,.08,.1];
  const unweighted=naturalBreaks(values).map(b=>b.max);
  const weighted=naturalBreaks([...values,...Array(100).fill(.01),...Array(100).fill(.02)]).map(b=>b.max);
  assert.notDeepEqual(weighted,unweighted);
});

test('legend distinguishes small boundaries and marks rounding without changing cuts',()=>{
  const bins=naturalBreaks([0,.00001234,.00001345,.017891]);
  assert.equal(bins[1].max,.00001234);
  assert.match(bins[1].label,/≈/);assert.match(bins[1].title!,/0.00001234/);
  assert.match(naturalBreaks([.01])[0].label,/^1.00%$/);
  const tiny=naturalBreaks([1e-30,2e-30]);
  assert.notEqual(tiny[0].label,tiny[1].label);assert.ok(!tiny[0].label.includes('0.00%'));
});

for(const node of ['O-F2758','O-F2890']){
  const fixture=JSON.parse(readFileSync('tests/fixtures/'+node+'.json','utf8'));
  const items=copyRegions(fixture.geographicDistribution.chartItems);
  for(const level of ['county','city'] as const)test(node+' '+level+' uses nationwide thresholds across filters',()=>{
    const extract=level==='city'?flattenCities:flatten;
    const raw:Atlas=JSON.parse(readFileSync('assets/'+(level==='city'?'cities':'counties')+'.geo.json','utf8'));
    const atlas=level==='county'?prepareAtlas(extract(items),raw):raw;
    const geometry=level==='city'?'city':'district';
    const all=matchCounties(extract(items),atlas,geometry).matched;
    const filtered=matchCounties(extract(items,[[{code:'45'},{code:'0'}]]),atlas,geometry).matched;
    const bins=naturalBreaks(all.map(m=>m.record.percent!));
    assert.equal(bins.length,9);assert.ok(filtered.length>0);
    const colors=new Map(all.map(m=>[m.record.code,colorFor(m.record.percent!,bins)]));
    for(const m of filtered)assert.equal(colorFor(m.record.percent!,bins),colors.get(m.record.code));
    assert.ok(all.every(m=>colorFor(m.record.percent!,bins)!==NO_DATA));
  });
}
