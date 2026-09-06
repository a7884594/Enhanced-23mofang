// Development-only: reproducible, cached, single-concurrency boundary supplements.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import mapshaper from 'mapshaper';
const sha=s=>createHash('sha256').update(s).digest('hex');
const groups=['360100','360700','340200','350400','350600','330100','320600','370600','130500','410300','520200','451000','220300','140700','630100','652900','530400','510100','450100','431100','421000','513400','520500','532300','610900','610300','654200'];
await mkdir('.cache/historical',{recursive:true});
const base=JSON.parse(await readFile('assets/counties.geo.json','utf8'));
// Idempotent: strip previously generated variants before rebuilding.
base.features=base.features.filter(f=>!f.properties.supplement);
const sources=[];const features=[];
for(const group of groups){
  const url=`https://geo.datav.aliyun.com/areas/bound/${group}_full.json`;
  let raw;try{raw=await readFile(`.cache/historical/${group}.json`,'utf8');}catch{
    const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${url}: ${r.status}`);
    raw=await r.text();await writeFile(`.cache/historical/${group}.json`,raw);await new Promise(r=>setTimeout(r,500));
  }
  const data=JSON.parse(raw);if(!data.features?.length)throw Error(`Empty ${group}`);
  const province=base.features.find(f=>f.properties.code===`outline-${group.slice(0,2)}0000`)?.properties.name;
  const city=base.features.find(f=>f.properties.level==='district'&&f.properties.code.startsWith(group.slice(0,4)))?.properties.path[1];
  if(!province||!city)throw Error(`Unknown parents ${group}`);
  sources.push({group,url,sha256:sha(raw),names:data.features.map(f=>f.properties.name)});
  for(const f of data.features){
    const p=f.properties;if(p.level!=='district'||!f.geometry)throw Error(`Non-district ${group}`);
    features.push({type:'Feature',properties:{code:String(p.adcode),name:p.name,level:'district',path:[province,city,p.name],center:p.centroid||p.center,supplement:'historical',group,source:url,boundaryNote:'DataV旧版区县边界；按网站旧区划显示，非现行政区范围'},geometry:f.geometry});
  }
}
const twUrl='https://geo.maderaojen.me/datasets/tw-counties/releases/v1/2026-08-07.1/data.geojson';
let tw;try{tw=await readFile('.cache/taiwan.geo.json','utf8');}catch{const r=await fetch(twUrl);if(!r.ok)throw Error(String(r.status));tw=await r.text();await writeFile('.cache/taiwan.geo.json',tw);}
if(sha(tw)!=='25a1ef2fcd0c09f5dabe070fbd64490e0084cba8795c2724a9be335e2d6a183e')throw Error('Taiwan release checksum changed');
const names={'彰化縣':'彰化县','嘉義市':'嘉义市','嘉義縣':'嘉义县','新竹縣':'新竹县','新竹市':'新竹市','花蓮縣':'花莲县','宜蘭縣':'宜兰县','基隆市':'基隆市','高雄市':'高雄市','苗栗縣':'苗栗县','南投縣':'南投县','新北市':'新北市','澎湖縣':'澎湖县','屏東縣':'屏东县','桃園市':'桃园市','臺南市':'台南市','臺北市':'台北市','臺東縣':'台东县','臺中市':'台中市','雲林縣':'云林县'};
for(const f of JSON.parse(tw).features){
  const name=names[f.properties.COUNTYNAME];if(!name)continue;
  // Locate the largest polygon, so distant small islands do not pull search focus away.
  const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
  const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0));
  const ring=polygons.map(p=>p[0]).sort((a,b)=>area(b)-area(a))[0];
  const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
  features.push({type:'Feature',properties:{code:f.properties.COUNTYCODE,name,level:'district',path:['台湾省','台湾省',name],center,supplement:'taiwan',source:twUrl,boundaryNote:'县市级原值；NLSC 2025县市界线（GeoJSON转换版，WGS84）'},geometry:f.geometry});
}
sources.push({url:twUrl,sha256:sha(tw),original:'https://data.gov.tw/dataset/7442',license:'政府資料開放授權條款－第1版',crs:'EPSG:4326',note:'NLSC 1140318; GeoJSON conversion by Geodata. Explicit traditional/simplified county-name crosswalk, scoped to 71-prefix website records.'});
const output=await new Promise((resolve,reject)=>mapshaper.applyCommands('-i input.geojson -simplify weighted 12% keep-shapes -o format=geojson precision=0.0001 output.geojson',{'input.geojson':JSON.stringify({type:'FeatureCollection',features})},(err,out)=>err?reject(err):resolve(out)));
base.features.push(...JSON.parse(String(output['output.geojson'])).features);
// These are actual county-level geometries, mislabeled city/aggregate by the provider.
for(const f of base.features)if(f.properties.level==='aggregate'&&/^(419|429|469|659)\d{3}$/.test(f.properties.code)){
  f.properties.level='district';f.properties.boundaryNote='省直辖县级地区：使用23魔方原有独立边界';
}
base.metadata.countyCount=base.features.filter(f=>f.properties.level==='district'&&!f.properties.group).length;
base.metadata.historicalCount=features.filter(f=>f.properties.group).length;
base.metadata.supplementedAt=new Date().toISOString();
const serialized=JSON.stringify(base);await writeFile('assets/counties.geo.json',serialized);
const provenance=JSON.parse(await readFile('assets/map-provenance.json','utf8'));
Object.assign(provenance,{sha256:sha(serialized),countyCount:base.metadata.countyCount,historicalCount:base.metadata.historicalCount,supplementedAt:base.metadata.supplementedAt,supplementSources:sources});
await writeFile('assets/map-provenance.json',JSON.stringify(provenance,null,2)+'\n');
console.log({bytes:Buffer.byteLength(serialized),countyCount:base.metadata.countyCount,historicalCount:base.metadata.historicalCount});
