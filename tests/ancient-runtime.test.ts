import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const worker=(await build({entryPoints:['src/ancient/background.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const bridge=(await build({entryPoints:['src/ancient/source-bridge.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
test('background isolates owners and serializes rapid starts from one tab',async()=>{
  const store:Record<string,any>={};let listener:any;let counter=0;
  const chrome={runtime:{onMessage:{addListener:(l:any)=>{listener=l;}}},storage:{local:{get:async(k:string)=>({[k]:structuredClone(store[k])}),set:async(v:any)=>{Object.assign(store,structuredClone(v));}}},tabs:{create:async()=>({id:99})}};
  runInNewContext(worker,{chrome,console,URL,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,atob,btoa,crypto:{randomUUID:()=>`id-${++counter}`},fetch:async(url:string)=>({status:200,url,text:async()=>JSON.stringify({code:1,data:{ytree:[{hid:28,parent:0,name:'O-F8',isParent:0}]}})})});
  const ask=(m:any,tab=1,origin='https://www.23mofang.com')=>new Promise<any>(resolve=>listener(m,{url:origin+'/ancestry/ytree/O-F8',tab:{id:tab}},resolve));
  const [a,b]=await Promise.all([ask({type:'anc.start',marker:'O-F8'}),ask({type:'anc.start',marker:'O-F8'})]);
  assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(store['anc.owner.1'],b.value.id);
  assert.equal((await ask({type:'anc.get',id:a.value.id})).ok,false);
  assert.equal((await ask({type:'anc.get',id:b.value.id},2)).ok,false);
  assert.equal((await ask({type:'anc.start',marker:'O-F8'},1,'https://evil.example')).ok,false);
  await ask({type:'anc.cancel',id:b.value.id});
});
test('runtime ownership uses session storage and releasing a completed panel removes its UUID job',async()=>{
  const local:Record<string,any>={},session:Record<string,any>={};let listener:any;let counter=0;
  const area=(store:Record<string,any>)=>({get:async(k:any)=>k==null?structuredClone(store):typeof k==='string'&&k in store?{[k]:structuredClone(store[k])}:{},set:async(v:any)=>Object.assign(store,structuredClone(v)),remove:async(k:string|string[])=>{for(const key of Array.isArray(k)?k:[k])delete store[key];}});
  const chrome={runtime:{onMessage:{addListener:(l:any)=>{listener=l;}}},storage:{local:area(local),session:area(session)},tabs:{create:async()=>({id:99}),onRemoved:{addListener:()=>{}}}};
  runInNewContext(worker,{chrome,console,URL,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,atob,btoa,crypto:{randomUUID:()=>`session-${++counter}`},fetch:async(url:string)=>({status:200,url,text:async()=>JSON.stringify({code:1,data:{ytree:[{hid:28,parent:0,name:'O-F8',isParent:0}]}})})});
  const ask=(m:any)=>new Promise<any>(resolve=>listener(m,{url:'https://www.23mofang.com/ancestry/ytree/O-F8',tab:{id:7}},resolve));
  const started=await ask({type:'anc.start',marker:'O-F8',scope:'direct'});assert.equal(started.ok,true);assert.equal(local['anc.owner.7'],undefined);assert.equal(session['anc.owner.7'],started.value.id);
  let job:any;for(let i=0;i<100;i++){job=(await ask({type:'anc.get',id:started.value.id})).value;if(job.complete)break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(job.complete,true);assert.ok(local[`anc.job.${started.value.id}`]);
  assert.equal((await ask({type:'anc.release',id:started.value.id})).ok,true);assert.equal(session['anc.owner.7'],undefined);assert.equal(local[`anc.job.${started.value.id}`],undefined);assert.ok(local['anc.cache.fast4.O-F8.direct']);
});
test('source bridge exports only ancient whitelist fields, not the raw tree object',()=>{
  const dom=new JSDOM('<body></body>',{url:'https://www.theytree.com/tree/O-F8',runScripts:'outside-only'});const w=dom.window as any;const messages:any[]=[];
  const rows=[{hid:28,parent:0,name:'O-F8',children:[{sid:1,parent:28,stype:2,name:'Ancient',cookie:'SECRET'},{sid:2,parent:28,stype:1,name:'MODERN_PRIVATE'}]}];
  w.jQuery={fn:{zTree:{getZTreeObj:()=>({getNodes:()=>rows})}}};w.postMessage=(m:any)=>messages.push(m);
  w.eval(bridge);w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:'mofang-ancient/v1',type:'read-source'}}));
  assert.equal(messages.length,1);assert.equal(messages[0].page.samples.length,1);assert.equal(JSON.stringify(messages).includes('SECRET'),false);assert.equal(JSON.stringify(messages).includes('MODERN_PRIVATE'),false);dom.window.close();
});

test('sync opens the resolved target despite stale unrelated candidates, in both sample modes',async()=>{
  for(const research of [false,true]){
    const prefix=research?'res':'anc';const id='sync-job';let listener:any;let tabId=98;const opened:any[]=[];
    const store:Record<string,any>={
      [`${prefix}.owner.1`]:id,[`${prefix}.parentTab.${id}`]:1,
      [`${prefix}.job.${id}`]:{id,marker:'O-MF10031',target:'O-CTS5308',mappingReady:true,scope:'downstream',status:'partial',complete:false,createdAt:Date.now(),updatedAt:Date.now(),samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],nodeSnps:['MF10031'],snpChecks:[{snp:'X123',target:'',issue:'历史候选待核对',candidate:{id:'123',marker:'R-Y82825'}}]}
    };
    const chrome={runtime:{onMessage:{addListener:(l:any)=>{listener=l;}}},storage:{local:{get:async(k:string)=>({[k]:structuredClone(store[k])}),set:async(v:any)=>{Object.assign(store,structuredClone(v));}}},tabs:{create:async(options:any)=>{opened.push(options);return {id:++tabId};}}};
    const code=research?(await build({entryPoints:['src/ancient/background.ts'],bundle:true,write:false,format:'iife',define:{__RESEARCH__:'true'}})).outputFiles[0].text:worker;
    runInNewContext(code,{chrome,URL,atob,btoa,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,crypto:{randomUUID:()=>id},fetch:async()=>{throw Error('Opening sync must not fetch samples');}});
    const ask=(type:string,tab=1,url='https://www.23mofang.com/ancestry/ytree/O-MF10031')=>new Promise<any>(resolve=>listener({type:`${prefix}.${type}`,id},{url,tab:{id:tab}},resolve));
    assert.equal((await ask('sync')).ok,true);assert.equal(opened[0].url,'https://www.theytree.com/tree/O-CTS5308');assert.equal(opened[0].active,true);
    assert.equal(store[`${prefix}.syncTarget.${id}`],'O-CTS5308');
    assert.equal((await ask('sourceBegin',99,'https://www.theytree.com/tree/R-Y82825')).ok,false);
    assert.equal((await ask('sync')).ok,true);
    assert.equal((await ask('sourceContext',99,'https://www.theytree.com/tree/O-CTS5308')).value,null);
    assert.equal((await ask('sourceBegin',100,'https://www.theytree.com/tree/O-CTS5308')).ok,true);
    // Before identity is confirmed, a candidate page is still allowed for SNP verification.
    store[`${prefix}.job.${id}`].mappingReady=false;
    assert.equal((await ask('sync')).ok,true);assert.equal(opened[2].url,'https://www.theytree.com/tree/R-Y82825');
  }
});

test('background sync uses browser credentials and never opens a tab',async()=>{
 const id='background-retry';let listener:any;const requests:any[]=[];
 const store:Record<string,any>={'anc.owner.1':id,['anc.job.'+id]:{id,marker:'O-MF190013',target:'O-MF190013',nodeSnps:['MF190013'],snpChecks:[],mappingReady:false,scope:'direct',status:'sync',complete:false,createdAt:Date.now(),updatedAt:Date.now(),samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],excluded:0},['anc.syncTab.'+id]:99};
 const chrome={runtime:{onMessage:{addListener:(l:any)=>listener=l}},storage:{local:{get:async(k:string)=>({[k]:structuredClone(store[k])}),set:async(v:any)=>Object.assign(store,structuredClone(v))}},tabs:{create:async()=>{throw Error('Must not open a tab');}}};
 runInNewContext(worker,{chrome,URL,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout,atob,btoa,crypto:{randomUUID:()=>id},fetch:async(url:string,opts:any)=>{requests.push({url,credentials:opts.credentials});return {status:403,url,text:async()=>''};}});
 const ask=(type:string)=>new Promise<any>(resolve=>listener({type,id},{url:'https://www.23mofang.com/ancestry/ytree/O-MF190013',tab:{id:1}},resolve));
 assert.equal((await ask('anc.backgroundSync')).ok,true);
 for(let i=0;i<100&&store['anc.job.'+id].status==='running';i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(requests.length,1);assert.equal(requests[0].credentials,'include');assert.ok(requests[0].url.includes('haplogroup=O-FT130664'));assert.equal(store['anc.syncTab.'+id],null);assert.equal(store['anc.job.'+id].status,'sync');assert.equal(store['anc.job.'+id].complete,false);
});
