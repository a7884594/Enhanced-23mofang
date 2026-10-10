import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const bundles=await Promise.all(['tests/node-filter-fixture.ts','src/node-filter-bridge.ts','src/node-filter.ts'].map(async entry=>(await build({entryPoints:[entry],bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"test"'}})).outputFiles[0].text));
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
test('real Vue 2 computed controls and Vue Router 3 route lifecycle support draft, submit and reset',async()=>{
  const dom=new JSDOM('<body><div id="app"></div></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-F2758',runScripts:'outside-only'}),w=dom.window as any,d=w.document;
  w.postMessage=(data:any)=>queueMicrotask(()=>{if(w.document)w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data}));});
  try{
    for(const bundle of bundles)w.eval(bundle);await tick();
    let input=d.querySelector('[aria-label="最小宗亲人数"]');assert.ok(input);
    input.value='5';input.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();
    assert.equal(d.querySelector('[data-action="confirm"]').disabled,false);
    assert.equal(d.querySelector('[data-count="2"]').style.display,'');
    d.querySelector('[data-action="confirm"]').click();await tick();
    assert.equal(new URL(w.location.href).searchParams.get('mofangMinSamples'),'5');
    assert.equal(d.querySelector('[data-count="2"]').style.display,'none');
    assert.equal(d.querySelector('[data-native-request]').textContent,'{}');
    (Array.from(d.querySelectorAll('button')) as HTMLButtonElement[]).find(button=>button.textContent==='筛选')!.click();await tick();
    d.querySelector('[data-action="reset"]').click();await tick();
    assert.equal(w.location.search,'');assert.equal(d.querySelector('[data-count="2"]').style.display,'');
    assert.equal(d.querySelector('[aria-label="最小宗亲人数"]').value,'0');
    assert.notEqual(d.querySelector('.node-filter-container').parentElement.style.display,'none');
  }finally{w.dispatchEvent(new w.PageTransitionEvent('pagehide'));dom.window.close();}
});
