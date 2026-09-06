import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import mapshaper from 'mapshaper';

await mkdir('.cache/maps', {recursive:true}); await mkdir('assets', {recursive:true});
const origin='https://www.23mofang.com';
const failures=[]; const fetched=[]; const leaves=new Map(); const outlines=[]; const seen=new Set();
async function get(code) {
  const path=`.cache/maps/${code}.json`;
  try { return JSON.parse(await readFile(path,'utf8')); } catch {}
  const url=`${origin}/web/api/new/common/mapData?areaCode=${code}&isFull=true`;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw Error(`HTTP ${response.status}`);
      const body=await response.json();
      if(body.status!==200 || body.data?.type!=='FeatureCollection' || !body.data.features?.length) throw Error('No geometry');
      await writeFile(path,JSON.stringify(body.data));
      await new Promise(r=>setTimeout(r,150));
      return body.data;
    } catch(e) { if(attempt===2) throw e; await new Promise(r=>setTimeout(r,1000*(attempt+1))); }
  }
}
let queue=[{code:'100000',path:[]}];
while(queue.length) {
  const batch=queue.splice(0,2);
  await Promise.all(batch.map(async task=>{
    if(seen.has(task.code)) return; seen.add(task.code);
    try {
      const data=await get(task.code); fetched.push(task.code);
      for(const f of data.features) {
        const p=f.properties||{}; const code=String(p.adcode||'');
        if(!f.geometry) continue;
        const path=[...task.path,p.name].filter(Boolean);
        const clean={type:'Feature',properties:{code,name:p.name||'',level:p.level||'outline',path,center:p.centroid||p.center},geometry:f.geometry};
        if(task.code==='100000') outlines.push({...clean,properties:{...clean.properties,code:`outline-${code||outlines.length}`}});
        if(p.level==='district') leaves.set(code,clean);
        else if(/^\d{6}$/.test(code) && p.childrenNum>0 && code!==task.code) queue.push({code,path});
        else if(task.code!=='100000') leaves.set(code||`outline-${leaves.size}`,{...clean,properties:{...clean.properties,level:'aggregate'}});
      }
    } catch(e) { failures.push({code:task.code,path:task.path,error:String(e)}); }
  }));
  if(seen.size%20<2 || !queue.length) console.log(JSON.stringify({visited:seen.size,queued:queue.length,features:leaves.size,failures:failures.length}));
}
const features=[...outlines,...leaves.values()];
const input={type:'FeatureCollection',features};
// Simplify all regions together so shared boundaries remain shared; retain every polygon.
const output=await new Promise((resolve,reject)=>mapshaper.applyCommands('-i input.geojson -simplify weighted 12% keep-shapes -o format=geojson precision=0.0001 output.geojson',{'input.geojson':JSON.stringify(input)},(err,out)=>err?reject(err):resolve(out)));
const raw=JSON.parse(String(output['output.geojson']));
const result={...raw,metadata:{createdAt:new Date().toISOString(),source:`${origin}/web/api/new/common/mapData`,fetchedAreas:fetched.length,countyCount:features.filter(f=>f.properties.level==='district').length,failures,notes:'区县代码与页面频率分别核对；无区县数据的地区仅作底图。'}};
const serialized=JSON.stringify(result);
await writeFile('assets/counties.geo.json',serialized);
await writeFile('assets/map-provenance.json',JSON.stringify({...result.metadata,sha256:createHash('sha256').update(serialized).digest('hex'),areaCodes:fetched},null,2));
console.log(JSON.stringify({bytes:Buffer.byteLength(serialized),...result.metadata}));
if(failures.length) process.exitCode=1;
