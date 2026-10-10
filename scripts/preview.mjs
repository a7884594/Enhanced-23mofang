import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const provinceScript=(await build({entryPoints:['tests/province-preview.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const root=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4173');let file;
  if(url.pathname==='/tests/province-preview.js'){res.setHeader('Content-Type','text/javascript');res.end(provinceScript);return;}
  if(/^\/ancestry\/ytree\/[^/]+\/branch$/.test(url.pathname))file='tests/preview.html';
  else if(['/dist/content.js','/dist/bridge.js','/assets/counties.geo.json','/assets/cities.geo.json','/reports/color-scale/index.html','/reports/color-scale/summary.json'].includes(url.pathname)||/^\/tests\/fixtures\/O-[\w]+\.json$/.test(url.pathname)||/^\/reports\/color-scale\/O-F(?:2758|2890)-(?:city|county)\.(?:svg|html)$/.test(url.pathname))file=url.pathname.slice(1);
  else {res.writeHead(404);res.end();return;}
  try{const body=await readFile(new URL(file,root));res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.js')?'text/javascript':'application/json');res.end(body);}catch{res.writeHead(404);res.end();}
});
const port=Number(process.env.PORT||4173);
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/ancestry/ytree/O-F2758/branch`));
