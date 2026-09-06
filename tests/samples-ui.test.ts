import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const bundle=(await build({entryPoints:['src/samples/ui.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
test('multi-source UI is click-only, isolates late results, and never renders fetched markup',async()=>{
 const dom=new JSDOM('<body><div class="tree-wrapper"><svg><g class="node"><text class="label">R-YP5527</text><text class="time">形成时间距今2530年</text></g><g class="node"><text class="label">O-UNKNOWN</text></g></svg></div></body>',{url:'https://www.23mofang.com/ancestry/ytree/R-YP5527',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window as any;const calls:any[]=[];const pending:{m:any;resolve:(v:any)=>void}[]=[];let token=0;
 w.SVGElement.prototype.getScreenCTM=()=>({a:1,d:1,e:0,f:0});
 w.chrome={runtime:{sendMessage:async(m:any)=>{calls.push(m);if(m.type==='samples.begin')return {ok:true,value:{token:String(++token)}};if(m.type==='samples.cancel')return {ok:true,value:true};return new Promise(resolve=>pending.push({m,resolve}));}}};
 const tick=()=>new Promise(r=>setTimeout(r,15));
 try{
  w.eval(bundle);assert.equal(calls.length,0);assert.equal(w.document.querySelectorAll('[data-mofang-multi]').length,1);
  w.document.querySelector('[data-mofang-multi]').onclick();await tick();assert.equal(pending.length,3);
  w.document.dispatchEvent(new w.CustomEvent('mofang-multi-open',{detail:{marker:'R-CTS4385',kind:'ancient'}}));await tick();assert.equal(pending.length,6);
  for(const p of pending){const old=p.m.marker==='R-YP5527';p.resolve({ok:true,value:{provider:p.m.provider,marker:p.m.marker,target:p.m.marker,url:'https://www.yfull.com/tree/'+p.m.marker+'/',mapping:'同名',nodes:[{name:p.m.marker,parent:'',snps:[],pending:false,groups:[],samples:[{id:old?'OLD-RESULT':'NEW-RESULT',kind:'ancient',name:'<img src=x onerror=alert(1)>',region:'公开地区',period:'',culture:'',uncertain:false,evidence:'明确古人',url:'https://www.yfull.com/tree/R-CTS4385/'}]}],updatedAt:1,complete:true,status:'ready',message:''}});}
  await tick();const shadow=w.document.getElementById('mofang-samples-panel').shadowRoot;
  assert.ok(!shadow.textContent.includes('OLD-RESULT'));assert.ok(shadow.textContent.includes('NEW-RESULT'));assert.equal(shadow.querySelector('img'),null);
  shadow.querySelector('.close').click();assert.equal(shadow.querySelector('.panel').hidden,true);assert.ok(calls.some(m=>m.type==='samples.cancel'));
 }finally{dom.window.close();}
});
