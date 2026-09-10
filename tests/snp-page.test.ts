import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bootSnpPage} from '../src/ancient/snp-page';
import {localSnps} from '../src/ancient/mofang-bridge';
import {htmlSnps} from '../src/ancient/nuxt-snps';
import {orderedSnpGroups} from '../src/ancient/snp-order';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,20));
const groups=['CTS6198/M1633','F76','F257/M1591','CTS5866','F8','Z25787','MF753240','MF748818'];
function fixture(){
  const dom=new JSDOM('<body><div class="tree-wrapper"><svg><g class="node"><text class="label">O-F8</text><g class="snp-wrapper"><text>SNP</text></g></g></svg></div></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-F8',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  return {dom,w,d};
}
test('display transport preserves source groups and order without mutating rsids or returning private fields',()=>{
  const {dom,d}=fixture();const values=[...groups,'MF123#annotation%123:C->T'];
  d.querySelector('g.node').__data__={data:{id:'O-F8',rsids:values,private:'DO_NOT_COPY',children:[{rsids:['CHILD1']}]}};
  assert.deepEqual(localSnps('O-F8',d,null,true),[...groups,'MF123']);assert.equal(values.at(-1),'MF123#annotation%123:C->T');
  const html='<script>window.__NUXT__='+JSON.stringify({data:[{treeData:{id:'O-F8',rsids:groups}}]})+';</script>';
  assert.deepEqual(htmlSnps(html,'O-F8',true),groups);
  assert.deepEqual(orderedSnpGroups(['F8','bad/<script>','F76','F8']),['F8','F76','F8']);dom.window.close();
});
test('native SNP click opens a separate dialog, blocks native hover, preserves aliases and queries only on submit',async()=>{
  const {dom,w,d}=fixture();let native=0,queries=0,opened='';
  const button=d.querySelector('.snp-wrapper');button.addEventListener('click',()=>native++);button.addEventListener('mouseover',()=>native++);
  d.addEventListener('mofang-sample-panel-open',(e:any)=>opened=e.detail);
  const page=bootSnpPage(d,{read:async()=>groups,query:async(value,provider,owner)=>{queries++;assert.equal(value,'M1633');assert.equal(provider,'mofang');assert.equal(owner,'O-F8');return {query:value,url:'https://www.23mofang.com/ancestry/ytree/O-F8',status:'ok',message:'查询成功',rows:[{name:value,position:'hg19:123',mutation:'C→T',time:''}]};}})!;
  button.dispatchEvent(new w.MouseEvent('mouseover',{bubbles:true}));assert.equal(native,0);assert.equal(page.dialog.open,false);
  button.querySelector('text').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await tick();
  assert.equal(native,0);assert.equal(opened,'snp');assert.equal(page.dialog.open,true);
  const shadow=page.host.shadowRoot!;
  assert.deepEqual([...shadow.querySelectorAll('.snp-group')].map(e=>e.textContent),groups);
  assert.equal(queries,0);
  [...shadow.querySelectorAll<HTMLButtonElement>('.snp-group button')].find(b=>b.textContent==='M1633')!.click();
  assert.equal(queries,0);assert.equal(shadow.querySelector<HTMLInputElement>('[name=snpname]')!.value,'M1633');
  shadow.querySelector('select')!.value='mofang';shadow.querySelector('form')!.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(queries,1);assert.match(shadow.querySelector('.snp-result')!.textContent!,/hg19:123/);
  shadow.querySelector<HTMLButtonElement>('.close')!.click();assert.equal(page.dialog.open,false);assert.equal(shadow.querySelector('.snp-result')!.textContent,'');dom.window.close();
});
test('dynamic and undated nodes use the same keyboard entry; route changes discard pending reads',async()=>{
  const {dom,w,d}=fixture();let finish!:(v:string[])=>void;
  const page=bootSnpPage(d,{read:()=>new Promise(r=>finish=r),query:async()=>{throw Error('unexpected query');}})!;
  const node=d.querySelector('g.node');const next=node.cloneNode(true);next.querySelector('.label').textContent='O-F76';node.after(next);
  next.querySelector('.snp-wrapper').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await tick();
  assert.equal(page.dialog.open,true);assert.match(page.host.shadowRoot!.querySelector('h1')!.textContent!,/O-F76/);
  dom.reconfigure({url:'https://www.23mofang.com/ancestry/ytree/O-F8/branch'});w.dispatchEvent(new w.PopStateEvent('popstate'));
  assert.equal(page.dialog.open,false);finish(['OLD1']);await tick();assert.equal(page.host.shadowRoot!.querySelectorAll('.snp-group').length,0);dom.window.close();
});
test('report entry reuses the independent dialog and does not read a tree node',async()=>{
  const {dom,w,d}=fixture();dom.reconfigure({url:'https://www.23mofang.com/report/ancestry'});
  const page=bootSnpPage(d,{read:async()=>{throw Error('unexpected read');},query:async()=>{throw Error('unexpected query');}})!;
  const button=page.host.shadowRoot!.querySelector<HTMLButtonElement>('.report-entry')!;assert.equal(button.hidden,false);button.click();await tick();assert.equal(page.dialog.open,true);
  d.dispatchEvent(new w.CustomEvent('mofang-sample-panel-open',{detail:'multi'}));assert.equal(page.dialog.open,false);dom.window.close();
});
