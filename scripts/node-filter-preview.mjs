import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
const fixture=(await build({entryPoints:['tests/node-filter-fixture.ts'],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"development"'}})).outputFiles[0].text;
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>节点筛选验证</title><style>body{font:15px/1.6 "Microsoft YaHei",sans-serif;background:#f4f7f9;color:#244559;margin:0}main{max-width:860px;margin:24px auto;background:white;padding:24px;border-radius:12px}button{padding:7px 14px;margin:4px;border:1px solid #cfd8dc;border-radius:5px;background:white;color:#244559;cursor:pointer}button:disabled{opacity:.45;cursor:default}.node-filter-container{border:1px solid #dce5eb;padding:16px;border-radius:8px;margin:18px 0}input{padding:7px;border:1px solid #cfd8dc;border-radius:5px;max-width:180px}code{display:block;overflow-wrap:anywhere;font-size:12px;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}.tree-wrapper{margin:24px 0}svg{max-width:100%}@media(max-width:500px){main{margin:0;padding:14px}h1{font-size:21px}nav{display:flex;flex-wrap:wrap}}</style><div id="app"></div><script src="/fixture.js"></script><script src="/dist/node-filter-bridge.js"></script><script src="/dist/node-filter.js"></script></html>';
const root=new URL('../',import.meta.url),port=Number(process.env.PORT||4176);
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(path==='/fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fixture);return;}
  if(['/dist/node-filter.js','/dist/node-filter-bridge.js'].includes(path)){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(new URL(path.slice(1),root)));return;}
  if(/^\/ancestry\/ytree\/[^/]+$/.test(path)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  res.writeHead(404);res.end();
}).listen(port,'127.0.0.1',()=>console.log('Node filter preview: http://127.0.0.1:'+port+'/ancestry/ytree/O-F2758'));
