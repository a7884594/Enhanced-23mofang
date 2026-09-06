import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import mapshaper from 'mapshaper';
// Reuse the original province-boundary responses already cached by the county
// collector. City boundaries are authoritative polygons, never county averages.
const root=JSON.parse(await readFile('.cache/maps/100000.json','utf8'));
const municipalities=new Set(['110000','120000','310000','500000']);
const features=[];const cities=new Map();const sources=['100000'];
for(const feature of root.features){
  const p=feature.properties||{};const code=String(p.adcode||'');
  const clean={type:'Feature',properties:{code,name:p.name||'',level:'city',path:[p.name].filter(Boolean),center:p.centroid||p.center},geometry:feature.geometry};
  features.push({...clean,properties:{...clean.properties,level:'outline',code:`outline-${code||features.length}`}});
  if(municipalities.has(code)){cities.set(code,clean);continue;}
  if(!/^\d{6}$/.test(code)||!p.childrenNum)continue;
  const data=JSON.parse(await readFile(`.cache/maps/${code}.json`,'utf8'));sources.push(code);
  for(const f of data.features){
    const q=f.properties||{};
    if(q.level!=='city')continue;
    cities.set(String(q.adcode),{type:'Feature',properties:{code:String(q.adcode),name:q.name,level:'city',path:[p.name,q.name],center:q.centroid||q.center},geometry:f.geometry});
  }
}
features.push(...cities.values());
const output=await new Promise((resolve,reject)=>mapshaper.applyCommands('-i input.geojson -simplify weighted 12% keep-shapes -o format=geojson precision=0.0001 output.geojson',{'input.geojson':JSON.stringify({type:'FeatureCollection',features})},(err,out)=>err?reject(err):resolve(out)));
const data=JSON.parse(String(output['output.geojson']));
const metadata={createdAt:new Date().toISOString(),source:'https://www.23mofang.com/web/api/new/common/mapData',cityCount:cities.size,failures:[],areaCodes:sources,notes:'使用缓存的原始省级响应中的市界，直辖市使用全市边界。未将县级边界冒充市界。'};
const serialized=JSON.stringify({...data,metadata});
await writeFile('assets/cities.geo.json',serialized);
await writeFile('assets/city-map-provenance.json',JSON.stringify({...metadata,sha256:createHash('sha256').update(serialized).digest('hex')},null,2));
console.log(JSON.stringify({cityCount:cities.size,bytes:Buffer.byteLength(serialized),cachedAreas:sources.length}));
