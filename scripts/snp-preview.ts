import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {AncientEngine} from '../src/ancient/engine';
const records=JSON.parse((await readFile('tests/fixtures/ancient/MF9915-snps.json','utf8')).replace(/^\uFEFF/,''));
const node=JSON.parse(await readFile('tests/fixtures/ancient/MF9915-node.json','utf8'));
const detail=await readFile('tests/fixtures/ancient/AU75605.html','utf8');
const store=new Map<string,any>();let owner='';
const engine=new AncientEngine({get:async k=>structuredClone(store.get(k)),set:async(k,v)=>{store.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>crypto.randomUUID(),request:async(url,signal)=>{
 await new Promise(r=>setTimeout(r,500));if(signal.aborted)throw Error('aborted');
 const s=new URL(url).searchParams.get('snp');const row=records.find((r:any)=>r.snp===s)||records[0];
 return {status:200,url,body:url.includes('/sample/')?detail:JSON.stringify({code:1,data:{ytree:[...row.branches,...row.ancient]}})};
}});
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>SNP对应 · 本地回归验证</title><style>body{background:#f3f5f8;font:15px sans-serif;margin:30px;color:#345}.tree-wrapper{background:white;padding:25px;border-radius:12px}svg text{font:14px sans-serif;fill:#345}</style><h1>O-MF9915 · SNP交叉对应验证</h1><p>使用2026-09-06采集的9条SNP搜索响应和AU75605详情；本地模拟传输，不代表已安装扩展的实时查询。</p><div class="tree-wrapper"><svg width="1000" height="200"><g class="node" transform="translate(10,20)"><rect width="110" height="32" fill="#eee"/><text class="label" x="8" y="22">O-MF9915</text><g class="snp-wrapper" transform="translate(150,0)"><text y="22">SNP</text></g></g><g class="node" transform="translate(40,90)"><g class="person-container"><text y="22">个人样本（不添加按钮）</text></g></g></svg></div><script>document.querySelector('g.node').__data__={data:{id:'O-MF9915',rsids:${JSON.stringify(node.snps)}}};window.chrome={runtime:{sendMessage:async m=>(await fetch('/api',{method:'POST',body:JSON.stringify(m)})).json()}};</script><script src="/mofang-bridge.js"></script><script src="/ui.js"></script></html>`;
createServer(async(req,res)=>{
 if(req.url==='/api'&&req.method==='POST'){
  try{let s='';for await(const c of req){s+=c;if(s.length>100000)throw Error('oversize');}const m=JSON.parse(s);let value;
   if(m.type==='anc.start'){if(owner)await engine.pause(owner);value=await engine.start(m.marker,m.scope,m.refresh,m.snps);owner=value.id;}
   else if(m.type==='anc.counts')value={};
   else if(m.id!==owner)throw Error('Wrong task');
   else if(m.type==='anc.get')value=await engine.get(owner);
   else if(m.type==='anc.cancel')value=await engine.pause(owner);
   else if(m.type==='anc.resume')value=await engine.resume(owner);
   res.end(JSON.stringify({ok:true,value}));
  }catch(e){res.end(JSON.stringify({ok:false,error:String(e)}));}return;
 }
 if(req.url==='/ui.js'||req.url==='/mofang-bridge.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('dist/ancient'+req.url));return;}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);
}).listen(4175,'127.0.0.1',()=>console.log('http://127.0.0.1:4175/ancestry/ytree/O-MF9915'));
