import {readFileSync,writeFileSync} from 'node:fs';
import {matchCounties,type Atlas,type County} from '../src/model';
const atlas:Atlas=JSON.parse(readFileSync('assets/counties.geo.json','utf8'));
// User-supplied names, not sample frequencies. Codes below are read from boundary
// snapshots (except explicitly scoped cross-system cases); this is a local audit.
const input=`江西省|赣州市|龙南县
江西省|南昌市|湾里区
海南省|省直辖县级行政区划|昌江黎族自治县 五指山市 琼中黎族苗族自治县 白沙黎族自治县 东方市 保亭黎族苗族自治县 乐东黎族自治县 澄迈县 临高县 琼海市 文昌市 万宁市 陵水黎族自治县 定安县 屯昌县
台湾省|台湾省|嘉义市 基隆市 南投县 新竹县 屏东县 花莲县 苗栗县 新竹市 台中市 云林县 彰化县 桃园市 台北市 台南市 宜兰县 新北市 高雄市 嘉义县 澎湖县
广西壮族自治区|南宁市|横县
广西壮族自治区|百色市|平果县
福建省|漳州市|龙海市 长泰县
福建省|三明市|沙县 梅列区
浙江省|杭州市|下城区 江干区
湖南省|益阳市|益阳市大通湖管理区
湖南省|永州市|永州市金洞管理区 永州市回龙圩管理区 祁阳县
湖南省|岳阳市|岳阳市屈原管理区
湖南省|常德市|常德市西洞庭管理区
湖南省|怀化市|怀化市洪江管理区
湖北省|省直辖县级行政区划|神农架林区 潜江市 天门市 仙桃市
湖北省|黄冈市|龙感湖管理区
湖北省|荆州市|监利县
安徽省|芜湖市|弋江区 繁昌县 芜湖县 无为县 三山区
安徽省|滁州市|苏滁现代产业园
江苏省|镇江市|镇江新区
江苏省|南通市|港闸区 海门市
四川省|成都市|新津县
四川省|凉山彝族自治州|会理县
贵州省|毕节市|黔西县
贵州省|六盘水市|水城县
山东省|烟台市|长岛县 蓬莱市
吉林省|四平市|公主岭市
云南省|楚雄彝族自治州|禄丰县
云南省|玉溪市|澄江县
黑龙江省|大兴安岭地区|新林区 加格达奇区
河北省|邢台市|桥东区 任县 邢台县 南和县 桥西区
河北省|保定市|保定白沟新城
河北省|邯郸市|邯郸冀南新区
河北省|沧州市|沧州渤海新区
河南省|郑州市|郑州航空港经济综合实验区
河南省|洛阳市|孟津县 偃师市 吉利区
河南省|省直辖县级行政区划|济源市
山西省|晋中市|太谷县
陕西省|安康市|旬阳县
陕西省|宝鸡市|凤翔县
内蒙古自治区|锡林郭勒盟|乌拉盖管委会
甘肃省|兰州市|兰州新区
青海省|西宁市|湟中县
新疆维吾尔自治区|自治区直辖县级行政区划|五家渠市 阿拉尔市 石河子市
新疆维吾尔自治区|塔城地区|沙湾县
新疆维吾尔自治区|阿克苏地区|库车县`;
let synthetic=719001;
const records:County[]=input.split('\n').flatMap(line=>{const [province,city,names]=line.split('|');return names.split(' ').map(name=>{
  const candidates=atlas.features.filter(f=>f.properties.path[0]===province&&f.properties.name===name&&f.properties.level==='district');
  const feature=candidates.find(f=>f.properties.group)||candidates[0];
  const code=province==='台湾省'?String(synthetic++):name==='加格达奇区'?'232761':feature?.properties.code||'999999';
  return {code,name,province,city,path:[province,city,name],percent:.314159};
});});
// Unknown codes must not collide merely because this audit lacks the website code.
const results=records.map(r=>({r,result:matchCounties([r],atlas)}));
const count=results.filter(v=>v.result.matched.length).length;
const lines=['# 用户所列行政区域补图核查（1.3.0）','',`共 ${records.length} 个地区：${count} 个可着色，${records.length-count} 个暂缺独立边界。`,
  '', '这是对用户提供的地区名称进行的本地匹配核查，不是重新抓取用户当前支系。代码取自边界快照；台湾用模拟71前缀代码测试跨编码映射。频率测试用固定小数验证保真，扩展运行时始终读取网站原值。',
  '', '旧区划按城市整组切换至DataV旧版边界，避免旧县与合并后新区重叠。旧版接口未声明统一测绘年份，因此标为“旧版边界”，不宣称是精确的某年行政界线。全量原始下载摘要见 map-provenance.json。',
  '', '| 网站地区 | 处理结果 | 边界来源 / 说明 |','| --- | --- | --- |'];
for(const {r,result} of results){const m=result.matched[0];if(m&&m.record.percent!==.314159)throw Error('Frequency changed');
  const note=m?(m.feature.properties.group?'旧版区划着色':m.feature.properties.supplement==='taiwan'?'县市名称跨编码映射':r.name==='加格达奇区'?'统计代码映射':'直辖县级边界启用'):'暂未着色';
  const source=m?.feature.properties.source;const detail=m?(source?`[边界数据](${source})`:m.feature.properties.boundaryNote||'23魔方离线边界'):result.unmatched[0]?.reason;
  lines.push(`| ${r.path.join(' / ')} | ${note} | ${detail} |`);
}
lines.push('','管理区/功能区不能用整县边界代替。已检查DataV普通版与v2区县列表及可用独立代码，相关独立几何未取得；新林区同样缺图。未来补图需同时核查统计范围与边界版本。','');
writeFileSync('assets/region-coverage.md',lines.join('\n'));console.log({total:records.length,matched:count,unmatched:records.length-count});
