import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
await mkdir('dist/assets',{recursive:true});await mkdir('dist/icons',{recursive:true});
await build({entryPoints:['src/content.ts','src/bridge.ts'],outdir:'dist',bundle:true,format:'iife',target:'chrome111',minify:true,legalComments:'eof'});
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
