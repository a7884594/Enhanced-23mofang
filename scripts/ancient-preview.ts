import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {AncientEngine,cacheKey} from '../src/ancient/engine';
import {marker,fresh,summary,type TreePage} from '../src/ancient/model';
const page:TreePage=JSON.parse(await readFile('tests/fixtures/ancient/O-F8.json','utf8'));
const selected=page.samples.filter(s=>['AU334','AU104785'].includes(s.au));
const branches=page.branches.filter(b=>['28','34','22002'].includes(b.id));
const raw={code:1,data:{ytree:[...branches.map(b=>({hid:b.id,parent:b.parent,name:b.marker,isParent:1})),...selected.map(s=>({sid:s.au.slice(2),parent:s.parentId,name:s.name,stype:2,haplogroup:s.marker,sid_encrypted:new URL(s.url).pathname.split('/').at(-1)!.replace('.html',''),period:s.period,country:s.country,coverage:s.coverage,average_depth:s.depth}))]}};
const files=new Map(await Promise.all(selected.map(async s=>[s.url,await readFile(`tests/fixtures/ancient/${s.au}.html`,'utf8')] as const)));
const data=new Map<string,any>();let owner='';
const engine=new AncientEngine({get:async k=>structuredClone(data.get(k)),set:async(k,v)=>{data.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>crypto.randomUUID(),request:async(url,signal)=>{await new Promise(r=>setTimeout(r,350));if(signal.aborted)throw Error('aborted');return {status:200,url,body:url.includes('/api/')?JSON.stringify(raw):files.get(url)||''};}});
const html=`<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>古DNA模块 · 本地验证</title><style>body{font:14px 'Microsoft YaHei',sans-serif;background:#f3f5f8;color:#345;margin:30px}main{max-width:1180px;margin:auto}h1{font-size:24px}.note{padding:14px;background:#f5ead8;border-radius:10px;font-size:13px}.tree-wrapper{margin-top:24px;background:white;border:1px solid #dde3ea;border-radius:12px;padding:20px;overflow:auto}svg text{font:13px sans-serif;fill:#345}.label{font-weight:600}.snp-wrapper rect{fill:#e7edf2}.fake-box{fill:#fff;stroke:#99a9b7}.person-container rect{fill:#f6f8fa}</style><main><h1>O-F8 的分化路径</h1><div class="note">本地验证：限定 AU334、AU104785 两条公开回归样本，使用模拟传输，不代表全量或实时查询。点击树上的“古DNA”按钮。</div><div class="tree-wrapper"><svg width="1100" height="230"><path d="M40 40V110H80M100 115V190H130" fill="none" stroke="#ccd3dd"/><g class="node" transform="translate(15,15)"><rect class="fake-box" width="65" height="30" rx="5"/><text class="label" x="10" y="20">O-F8</text><text class="time" x="80" y="20">形成时间距今6910年</text><g class="snp-wrapper" transform="translate(250,0)"><rect width="34" height="24" rx="4"/><text x="4" y="17">SNP</text></g></g><g class="node" transform="translate(80,90)"><rect class="fake-box" width="95" height="30" rx="5"/><text class="label" x="10" y="20">O-YP4864</text><text class="time" x="115" y="20">下游支系（验证布局）</text><g class="snp-wrapper" transform="translate(300,0)"><rect width="34" height="24" rx="4"/><text x="4" y="17">SNP</text></g></g><g class="node" transform="translate(130,170)"><g class="person-container"><rect width="300" height="30" rx="4"/><text x="10" y="20">个人末端样本（不添加古DNA按钮）</text></g></g></svg></div></main><script>window.chrome={runtime:{sendMessage:async message=>{const r=await fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(message)});return r.json();}}};</script><script src="/ancient-ui.js"></script></html>`;
createServer(async(req,res)=>{
  if(req.url==='/api'&&req.method==='POST'){
    try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)throw Error('Too large');chunks.push(chunk);}const m=JSON.parse(Buffer.concat(chunks).toString());let value:any;
      if(m.type==='anc.start'){if(owner)await engine.pause(owner);value=await engine.start(m.marker,m.scope==='downstream'?'downstream':'direct',!!m.refresh);owner=value.id;}
      else if(m.type==='anc.counts'){value={};for(const x of m.markers||[]){const name=marker(x);if(name){const c=data.get(cacheKey(name,'direct'));if(c&&fresh(c))value[name]=summary(c);}}}
      else if(m.id!==owner)throw Error('Wrong task');
      else if(m.type==='anc.get')value=await engine.get(owner);else if(m.type==='anc.cancel')value=await engine.pause(owner);else if(m.type==='anc.resume')value=await engine.resume(owner);else throw Error('模拟页不打开真实源站同步');
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,value}));
    }catch(e){res.end(JSON.stringify({ok:false,error:String(e)}));}return;
  }
  if(req.url==='/ancient-ui.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('dist/ancient/ui.js'));return;}
  res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);
}).listen(4174,'127.0.0.1',()=>console.log('Ancient preview: http://127.0.0.1:4174/ancestry/ytree/O-F8'));
