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
    const old=historical.get(id);
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
