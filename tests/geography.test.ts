import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchCounties,type Atlas,type County} from '../src/model';
import {prepareAtlas} from '../src/geography';
const atlas:Atlas=JSON.parse(readFileSync('assets/counties.geo.json','utf8'));
const r=(code:string,name:string,province:string,city:string,percent:number|null=.123456):County=>({code,name,province,city,percent,path:[province,city,name]});
test('provincial direct counties retain individual geometry and original frequency',()=>{
  const codes=['419001','429004','429005','429006','429021','469001','469002','469005','469006','469007','469021','469022','469023','469024','469025','469026','469027','469028','469029','469030','659001','659002','659004'];
  const records=codes.map(c=>{const p=atlas.features.find(f=>f.properties.code===c)!.properties;return r(c,p.name,p.path[0],'省直辖县级行政区划');});
  const result=matchCounties(records,atlas);assert.equal(result.matched.length,codes.length);
  for(const m of result.matched)assert.equal(m.record.percent,.123456);
});
test('split and merged districts use actual old polygons, never new enlarged polygons',()=>{
  const records=[r('340203','弋江区','安徽省','芜湖市',.9286),r('340208','三山区','安徽省','芜湖市',.7),r('330103','下城区','浙江省','杭州市'),r('330104','江干区','浙江省','杭州市'),r('130502','桥东区','河北省','邢台市'),r('130503','桥西区','河北省','邢台市'),r('130521','邢台县','河北省','邢台市'),r('370634','长岛县','山东省','烟台市'),r('370684','蓬莱市','山东省','烟台市'),r('410306','吉利区','河南省','洛阳市'),r('410322','孟津县','河南省','洛阳市'),r('360105','湾里区','江西省','南昌市'),r('350402','梅列区','福建省','三明市'),r('520221','水城县','贵州省','六盘水市')];
  const view=prepareAtlas(records,atlas);const result=matchCounties(records,view);
  assert.equal(result.unmatched.length,0);assert.equal(result.matched.length,records.length);
  assert.ok(result.matched.every(m=>m.feature.properties.group));
  assert.ok(!view.features.some(f=>f.properties.code==='340209'));
  assert.equal(view.features.filter(f=>f.properties.code==='130502').length,1);
  assert.equal(result.matched[0].record.percent,.9286);assert.equal(result.matched[1].record.percent,.7);
});
test('renamed counties match old source names without a suffix guess',()=>{
  const names='龙南县 横县 平果县 龙海市 长泰县 沙县 祁阳县 监利县 繁昌县 芜湖县 无为县 海门市 新津县 会理县 黔西县 公主岭市 禄丰县 澄江县 任县 南和县 偃师市 太谷县 旬阳县 凤翔县 湟中县 沙湾县 库车县'.split(' ');
  const records=names.map(name=>{const p=atlas.features.find(f=>f.properties.group&&f.properties.name===name)!.properties;return r(p.code,name,p.path[0],p.path[1]);});
  assert.equal(matchCounties(records,atlas).matched.length,names.length);
  const view=prepareAtlas(records,atlas);assert.ok(!view.features.some(f=>f.properties.code==='220184'));
  const unrelated=r('130502','桥东区','另一个省','另一个市');assert.equal(matchCounties([unrelated],atlas).matched.length,0);
});
test('Taiwan county/city crosswalk is province-scoped and distinguishes identically named city/county',()=>{
  const names='嘉义市 基隆市 南投县 新竹县 屏东县 花莲县 苗栗县 新竹市 台中市 云林县 彰化县 桃园市 台北市 台南市 宜兰县 新北市 高雄市 嘉义县 澎湖县'.split(' ');
  // Synthetic codes intentionally test that provider codes are not assumed to be 23mofang codes.
  const records=names.map((name,i)=>r(String(719001+i),name,'台湾省','台湾省'));
  const result=matchCounties(records,atlas);assert.equal(result.matched.length,19);
  assert.equal(new Set(result.matched.map(m=>m.feature.properties.code)).size,19);
  assert.equal(matchCounties([r('139001','新竹县','河北省','保定市')],atlas).matched.length,0);
  assert.equal(matchCounties([r('710099','不存在县','台湾省','台湾省')],atlas).matched.length,0);
});
test('target collisions, missing values and special management areas are not painted',()=>{
  const records=[r('710001','台北市','台湾省','台湾省'),r('719001','台北市','台湾省','台湾省'),r('469001','五指山市','海南省','省直辖',null),r('321171','镇江新区','江苏省','镇江市')];
  const result=matchCounties(records,atlas);assert.equal(result.matched.length,0);assert.equal(result.unmatched.length,4);
  assert.ok(result.unmatched.some(u=>u.reason.includes('统计范围')));
  assert.equal(matchCounties([r('232761','加格达奇区','黑龙江省','大兴安岭地区',0)],atlas).matched[0].record.percent,0);
});
test('switching snapshots restores modern geometry without stale historical layers',()=>{
  const old=[r('340203','弋江区','安徽省','芜湖市')];const modern=[r('340209','弋江区','安徽省','芜湖市')];
  assert.ok(prepareAtlas(old,atlas).features.some(f=>f.properties.group==='340200'));
  assert.ok(!prepareAtlas(modern,atlas).features.some(f=>f.properties.group));
  assert.equal(matchCounties(modern,atlas).matched.length,1);
  const view=prepareAtlas(old,atlas);assert.equal(new Set(view.features.map(f=>f.properties.code)).size,view.features.length);
});
