import type {Atlas,County,GeoFeature} from './model';

/** Select a consistent city boundary edition, never overlay merged and old districts. */
export function prepareAtlas(records:County[],atlas:Atlas):Atlas {
  const key=(code:string,name:string,province:string)=>JSON.stringify([code,name,province]);
  const featureKey=(f:GeoFeature)=>key(f.properties.code,f.properties.name,f.properties.path[0]);
  const current=new Set(atlas.features.filter(f=>!f.properties.group&&f.properties.level==='district').map(featureKey));
  const historical=new Map(atlas.features.filter(f=>f.properties.group).map(f=>[featureKey(f),f]));
  const selected=new Set<string>();
  for(const r of records){
    const id=key(r.code,r.name,r.province);if(current.has(id))continue;
    const old=historical.get(id)||supplementaryFeature(r,atlas.features);
    if(old&&r.city===old.properties.path[1])selected.add(old.properties.group!);
  }
  return {...atlas,features:atlas.features.filter(f=>{
    if(f.properties.group)return selected.has(f.properties.group);
    if(f.properties.level!=='district')return true;
    if(selected.has(f.properties.code.slice(0,4)+'00'))return false;
    // Gongzhuling moved from Siping to Changchun; don't leave its current polygon over the old one.
    if(selected.has('220300')&&f.properties.code==='220184')return false;
    return true;
  })};
}

export function supplementaryFeature(record:County,features:GeoFeature[]):GeoFeature|undefined {
  // A city's historical edition can coexist with modern statistical names.
  // These three changes retained the county boundary; never infer this from suffixes.
  const equivalents=[
    ['广西壮族自治区','百色市','451003','田阳区','451021','田阳县','451000'],
    ['浙江省','杭州市','330112','临安区','330185','临安区','330100'],
    ['江苏省','南通市','320685','海安市','320621','海安县','320600'],
  ];
  for(const [province,city,code,name,oldCode,oldName,group] of equivalents){
    if(record.province!==province||record.city!==city||record.code!==code||record.name!==name)continue;
    const old=features.find(f=>f.properties.group===group&&f.properties.code===oldCode&&f.properties.name===oldName&&f.properties.path[0]===province&&f.properties.path[1]===city);
    if(old)return {...old,properties:{...old.properties,name,
      boundaryNote:`${name}（${code}）对应原${oldName}（${oldCode}）边界；撤县市设区或设市时行政区域不变。${old.properties.boundaryNote||''}`}};
  }
  // Two code systems. Only explicitly bundled Taiwan county/city names qualify.
  if(record.province==='台湾省'&&/^71\d{4}$/.test(record.code))
    return features.find(f=>f.properties.supplement==='taiwan'&&f.properties.name===record.name);
  // Provider uses 232718; the website's statistical code is 232761.
  if(record.province==='黑龙江省'&&record.city==='大兴安岭地区'&&record.code==='232761'&&record.name==='加格达奇区')
    return features.find(f=>f.properties.code==='232718'&&f.properties.name===record.name);
}

export function missingBoundaryReason(record:County):string|undefined {
  if(/管理区|管委会|新区|产业园|实验区|新城/.test(record.name))
    return '管理或功能区：尚无与网站统计范围一致的独立边界，不能使用所在县市边界代替';
  if(record.name==='新林区'&&record.province==='黑龙江省')
    return '旧版与现有地图均未提供新林区独立边界，保留原频率等待补图';
}
