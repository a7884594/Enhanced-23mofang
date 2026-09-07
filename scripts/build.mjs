import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile,appendFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
await mkdir('dist/assets',{recursive:true});await mkdir('dist/icons',{recursive:true});
await build({entryPoints:['src/popup.ts','src/bridge.ts','src/ancient/mofang-bridge.ts','src/ancient/background.ts','src/ancient/source.ts','src/ancient/source-bridge.ts','src/ancient/mofang-snp-bridge.ts'],outdir:'dist',outbase:'src',define:{__RESEARCH__:'false'},bundle:true,format:'iife',target:'chrome111',minify:true,legalComments:'eof'});
await build({entryPoints:['src/ancient/mofang-bridge.ts','src/ancient/background.ts','src/ancient/source.ts','src/ancient/source-bridge.ts'],outdir:'dist/research',outbase:'src/ancient',define:{__RESEARCH__:'true'},bundle:true,format:'iife',target:'chrome111',minify:true,legalComments:'eof'});
// Bundle lazy initializers so disabled features never install UI, timers, or observers.
for(const [source,output,feature,research] of [
  ['content','content','map',false],
  ['ancient/ui','ancient/ui','samples',false],
  ['ancient/ui','research/ui','samples',true],
  ['samples/ui','samples/ui','samples',false],
  ['ancient/mofang-snp-entry','ancient/mofang-snp-entry','samples',false],
  ['node-filter','node-filter','nodes',false],
]) await build({stdin:{contents:`import {runFeature} from './src/features'; void runFeature('${feature}',()=>import('./src/${source}'));`,resolveDir:process.cwd(),loader:'ts'},outfile:`dist/${output}.js`,define:{__RESEARCH__:String(research)},bundle:true,format:'iife',target:'chrome111',minify:true,legalComments:'eof'});
await copyFile('src/popup.html','dist/popup.html');
// One classic MV3 worker, two isolated message handlers, one shared request gate.
await appendFile('dist/ancient/background.js','\nimportScripts("../research/background.js");\n');
await build({entryPoints:['src/samples/background.ts','src/samples/ancestry-bridge.ts'],outdir:'dist/samples',outbase:'src/samples',define:{__RESEARCH__:'false'},bundle:true,format:'iife',target:'chrome111',minify:true,legalComments:'eof'});
await appendFile('dist/ancient/background.js','\nimportScripts("../samples/background.js");\n');
await copyFile('manifest.json','dist/manifest.json');
await copyFile('assets/counties.geo.json','dist/assets/counties.geo.json');
await copyFile('assets/map-provenance.json','dist/assets/map-provenance.json');
await copyFile('assets/cities.geo.json','dist/assets/cities.geo.json');
await copyFile('assets/city-map-provenance.json','dist/assets/city-map-provenance.json');
// Original geometric icon, rendered directly to PNG without external assets.
function crc32(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([length,t,data,crc]);}
for(const size of [48,128]) {
  const data=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=x/size,ny=y/size;let color=[24,64,87,255];
    const cells=[[.2,.25,.39,.47,[153,203,220,255]],[.43,.18,.68,.42,[85,170,191,255]],[.25,.52,.52,.79,[214,233,244,255]],[.56,.47,.8,.72,[77,152,175,255]]];
    for(const[a,b,c,d,col]of cells)if(nx>a&&nx<c&&ny>b&&ny<d)color=col;
    const offset=y*(size*4+1)+1+x*4;color.forEach((v,i)=>data[offset+i]=v);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  await writeFile(`dist/icons/${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]));
}
const license=await readFile('node_modules/echarts/LICENSE','utf8');
await writeFile('dist/THIRD-PARTY-NOTICES.txt',`ECharts and zrender: Apache License 2.0\n${license}\nMap boundaries: supplied by the public 23mofang mapData endpoint; retrieved for this local-use extension. See assets/map-provenance.json for provenance. No public redistribution or map ownership is claimed.\n`);
console.log('Built unpacked extension: dist/');
await appendFile('dist/THIRD-PARTY-NOTICES.txt','\nHistorical county boundaries: Alibaba DataV GeoAtlas areas/bound snapshots, retrieved 2026-09-06 for local visualization; source URLs and SHA-256 in assets/map-provenance.json. Boundary edition is selected by exact website county name and code, not claimed to be current.\nTaiwan county/city boundaries: NLSC 2025 (1140318), https://data.gov.tw/dataset/7442 ; GeoJSON conversion by https://geo.maderaojen.me/ (2026-08-07.1). Open Government Data License version 1.0: https://data.gov.tw/license . Simplified for this extension; county/city name crosswalk is scoped to Taiwan records, original frequencies unchanged.\n');
// Include notices for all installed production dependencies in the local bundle.
await mkdir('dist/licenses',{recursive:true});
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
for(const [path,info] of Object.entries(lock.packages)){
  if(!path||info.dev||!path.startsWith('node_modules/'))continue;
  for(const name of ['LICENSE','LICENSE.md','LICENSE.txt','license','LICENSE-MIT']){
    try{const text=await readFile(`${path}/${name}`,'utf8');await writeFile(`dist/licenses/${path.replaceAll('/','_')}.txt`,text);break;}catch{}
  }
}
