import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4173');let file;
  if(/^\/ancestry\/ytree\/[^/]+\/branch$/.test(url.pathname))file='tests/preview.html';
  else if(['/dist/content.js','/dist/bridge.js','/assets/counties.geo.json'].includes(url.pathname)||/^\/tests\/fixtures\/O-[\w]+\.json$/.test(url.pathname))file=url.pathname.slice(1);
  else {res.writeHead(404);res.end();return;}
  try{const body=await readFile(new URL(file,root));res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'application/json');res.end(body);}catch{res.writeHead(404);res.end();}
});
server.listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173/ancestry/ytree/O-CTS7316/branch'));
