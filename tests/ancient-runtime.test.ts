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
test('source bridge exports only ancient whitelist fields, not the raw tree object',()=>{
  const dom=new JSDOM('<body></body>',{url:'https://www.theytree.com/tree/O-F8',runScripts:'outside-only'});const w=dom.window as any;const messages:any[]=[];
  const rows=[{hid:28,parent:0,name:'O-F8',children:[{sid:1,parent:28,stype:2,name:'Ancient',cookie:'SECRET'},{sid:2,parent:28,stype:1,name:'MODERN_PRIVATE'}]}];
  w.jQuery={fn:{zTree:{getZTreeObj:()=>({getNodes:()=>rows})}}};w.postMessage=(m:any)=>messages.push(m);
  w.eval(bridge);w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:'mofang-ancient/v1',type:'read-source'}}));
  assert.equal(messages.length,1);assert.equal(messages[0].page.samples.length,1);assert.equal(JSON.stringify(messages).includes('SECRET'),false);assert.equal(JSON.stringify(messages).includes('MODERN_PRIVATE'),false);dom.window.close();
});
