import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createSnpLookup} from '../src/ancient/snp-lookup';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,10));
test('SNP list reads only on expansion and selecting a name never submits a query',async()=>{
  const dom=new JSDOM('<body/>');const d=dom.window.document;let reads=0,submits=0;
  const lookup=createSnpLookup(d,async name=>{reads++;assert.equal(name,'O-MF109594');return ['MF109594','MF109928','Y176322','MF109928'];});
  d.body.append(lookup.element);lookup.setMarker('O-MF109594');await tick();assert.equal(reads,0);
  lookup.element.open=true;await tick();assert.equal(reads,1);
  lookup.element.querySelector('form')!.addEventListener('submit',()=>submits++);
  const tags=[...lookup.element.querySelectorAll<HTMLButtonElement>('.snp-options button')];assert.equal(tags.length,3);
  tags.find(t=>t.textContent==='MF109928')!.click();assert.equal(lookup.element.querySelector<HTMLInputElement>('[name=snpname]')!.value,'MF109928');assert.equal(submits,0);
  lookup.element.open=false;await tick();lookup.element.open=true;await tick();assert.equal(reads,1);dom.window.close();
});
test('late SNP results cannot populate a different node and empty reads can retry',async()=>{
  const dom=new JSDOM('<body/>');const d=dom.window.document;let finish!:(v:string[])=>void,attempt=0;
  const lookup=createSnpLookup(d,name=>name==='O-OLD1'?new Promise(r=>finish=r):Promise.resolve(++attempt===1?[]:['NEW2']));d.body.append(lookup.element);
  lookup.setMarker('O-OLD1');lookup.element.open=true;await tick();
  lookup.setMarker('O-NEW2');lookup.element.open=true;await tick();finish(['OLD1']);await tick();assert.equal(lookup.element.querySelectorAll('.snp-options button').length,0);
  const retry=[...lookup.element.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='重新读取本节点SNP')!;assert.equal(retry.hidden,false);retry.click();await tick();assert.equal(lookup.element.querySelector('.snp-options')!.textContent,'NEW2');dom.window.close();
});
