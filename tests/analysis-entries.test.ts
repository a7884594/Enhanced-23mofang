import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('analysis pages keep native heading and age without injected ancient, research or multi buttons',async()=>{
  for(const [entry,research] of [['src/ancient/ui.ts',false],['src/ancient/ui.ts',true],['src/samples/ui.ts',false]] as const){
    const code=(await build({entryPoints:[entry],bundle:true,write:false,format:'iife',define:{__RESEARCH__:String(research)}})).outputFiles[0].text;
    const dom=new JSDOM('<body><h1>O-F8 支系分析</h1><p id="age">形成时间距今 6910 年</p></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-F8/branch',runScripts:'outside-only'});
    const w=dom.window as any;w.chrome={runtime:{sendMessage:async()=>({ok:true,value:{}})},storage:{onChanged:{addListener:()=>{}}}};
    try{w.eval(code);await new Promise(r=>setTimeout(r,15));assert.equal(w.document.querySelector('#mofang-ancient-entry,#mofang-research-entry,#mofang-multi-entry'),null);assert.equal(w.document.querySelector('#age').textContent,'形成时间距今 6910 年');assert.equal(w.document.querySelector('h1').nextElementSibling.id,'age');}finally{dom.window.close();}
  }
});
