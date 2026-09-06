import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {AncientEngine} from '../src/ancient/engine';
import {pathToRoot} from '../src/ancient/model';
await mkdir('.cache',{recursive:true});
await build({entryPoints:['src/ancient/engine.ts'],outfile:'.cache/research-preview.cjs',bundle:true,platform:'node',packages:'external',format:'cjs',define:{__RESEARCH__:'true'}});
const ResearchEngine=createRequire(import.meta.url)(resolve('.cache/research-preview.cjs')).AncientEngine;
const ancient=JSON.parse(await readFile('tests/fixtures/ancient/O-F8.json','utf8'));
const scientific=JSON.parse(await readFile('tests/fixtures/research/O-Y5702.json','utf8'));
const rows=[ancient.samples.find((s:any)=>s.au==='AU334'),scientific.samples[0]];
const branches=pathToRoot(scientific.branches[0].id,'28',ancient.branches)!;
const raw={code:1,data:{ytree:[...branches.map(b=>({hid:b.id,parent:b.parent,name:b.marker})),...rows.map(s=>({sid:s.au.slice(2),parent:s.parentId,name:s.name,haplogroup:s.marker,stype:s.type==='scientific'?1:2,sid_encrypted:s.url.split('/').at(-1).replace('.html','')}))]}};
const details=new Map(await Promise.all(rows.map(async s=>[s.url,await readFile(`tests/fixtures/${s.type==='scientific'?'research':'ancient'}/${s.au}.html`,'utf8')])));
const store=new Map();const io={get:async(k:string)=>structuredClone(store.get(k)),set:async(k:string,v:any)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>crypto.randomUUID(),request:async(url:string)=>{await new Promise(r=>setTimeout(r,180));return {status:200,url,body:url.includes('/sample/')?details.get(url)||'':JSON.stringify(raw)};}};
const engines:any={anc:new AncientEngine(io),res:new ResearchEngine(io)},owners:any={};
const page=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>古DNA与科研样本 · 本地验证</title><style>body{font:14px 'Microsoft YaHei',sans-serif;background:#f3f5f8;color:#345;padding:24px}h1{font-size:24px}.note{padding:16px;background:#f4ead9;border-radius:10px}.tree-wrapper{background:white;padding:25px;margin-top:20px;border-radius:12px}svg text{font:13px sans-serif;fill:#345}svg rect{fill:#f3f6f8;stroke:#aab8c4}</style><h1>古DNA／科研样本 · 共存验证</h1><p class="note">本地模拟：限定AU334与科研AU38407，使用公开样本字段及已有树路径；不是实时查询。分别点击“古”和“研”。</p><div class="tree-wrapper"><svg width="1100" height="180"><g class="node" transform="translate(10,20)"><rect width="90" height="30" rx="5"/><text class="label" x="10" y="20">O-F8</text><text class="time" x="120" y="20">形成时间距今6910年</text><g class="snp-wrapper" transform="translate(320,3)"><rect width="32" height="24"/><text x="3" y="17">SNP</text></g></g><g class="node" transform="translate(50,95)"><rect width="100" height="30" rx="5"/><text class="label" x="10" y="20">O-Y5702</text><g class="snp-wrapper" transform="translate(320,3)"><rect width="32" height="24"/><text x="3" y="17">SNP</text></g></g></svg></div><script>window.chrome={runtime:{sendMessage:async m=>(await fetch('/api',{method:'POST',body:JSON.stringify(m)})).json()}};</script><script src="/ancient/ui.js"></script><script src="/research/ui.js"></script></html>`;
createServer(async(req,res)=>{
 if(req.url==='/api'&&req.method==='POST'){try{
  let body='';for await(const c of req){body+=c;if(body.length>100000)throw Error('oversize');}const m=JSON.parse(body),[kind,type]=m.type.split('.'),engine=engines[kind];if(!engine)throw Error('unknown module');let value;
  if(type==='counts'){value={};for(const name of m.markers||[]){const c=await engine.getBadge(name);if(c)value[name]=c;}}
  else if(type==='start'){if(owners[kind])await engine.pause(owners[kind]);value=await engine.start(m.marker,m.scope,!!m.refresh,m.snps);owners[kind]=value.id;}
  else if(m.id!==owners[kind])throw Error('wrong owner');else if(type==='get')value=await engine.get(m.id);else if(type==='cancel')value=await engine.pause(m.id);else if(type==='resume')value=await engine.resume(m.id);else throw Error('not provided by preview');
  res.end(JSON.stringify({ok:true,value}));
 }catch(e){res.end(JSON.stringify({ok:false,error:String(e)}));}return;}
 if(['/ancient/ui.js','/research/ui.js'].includes(req.url||'')){res.setHeader('Content-Type','text/javascript');res.end(await readFile('dist'+req.url));return;}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end(page);
}).listen(4176,'127.0.0.1',()=>console.log('http://127.0.0.1:4176/ancestry/ytree/O-F8'));
