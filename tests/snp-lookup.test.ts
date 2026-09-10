import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createSnpLookup} from '../src/ancient/snp-lookup';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,10));
test('every panel opening defaults to TheYtree and failures never switch sources',async()=>{
  const dom=new JSDOM('<body/>');const calls:string[]=[];
  const lookup=createSnpLookup(dom.window.document,undefined,async(value,provider)=>{calls.push(provider!);return {status:'empty',query:value,url:'',message:'未返回记录',rows:[]};});
  const select=lookup.element.querySelector('select')!,form=lookup.element.querySelector('form')!;
  const submit=async()=>{form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();};
  lookup.setMarker('O-M1518');assert.equal(select.value,'theytree');await submit();
  assert.deepEqual(calls,['theytree']);assert.equal(select.value,'theytree');
  select.value='mofang';lookup.reset();assert.equal(select.value,'theytree');
  select.value='mofang';lookup.setMarker('O-M1528');assert.equal(select.value,'theytree');await submit();
  assert.deepEqual(calls,['theytree','theytree']);
  assert.equal(new URL(lookup.element.querySelector('a')!.href).searchParams.get('snpname'),'M1528');
  assert.equal(lookup.element.querySelector('a')!.textContent,'打开 TheYtree SNP 查询页 ↗');dom.window.close();
});
test('source links distinguish SNP search, branch page, and report login destinations',async()=>{
  const dom=new JSDOM('<body/>');let url='https://www.23mofang.com/ancestry/ytree/O-M1518';
  const lookup=createSnpLookup(dom.window.document,undefined,async value=>({status:'unsupported',query:value,url,message:'无坐标',rows:[]}));
  lookup.setMarker('O-M1518');const select=lookup.element.querySelector('select')!,form=lookup.element.querySelector('form')!;
  const submit=async()=>{form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();};
  select.value='mofang';await submit();
  assert.deepEqual([...lookup.element.querySelectorAll('a')].map(a=>[a.textContent,a.href]),[
    ['查看23魔方支系页 ↗','https://www.23mofang.com/ancestry/ytree/O-M1518'],
    ['打开23魔方报告／登录 ↗','https://www.23mofang.com/report/gene-origin/my-origin'],
  ]);
  url='https://example.com/ancestry/ytree/O-M1518';await submit();assert.equal(lookup.element.querySelectorAll('a').length,1);
  select.value='theytree';await submit();assert.equal(lookup.element.querySelectorAll('a').length,1);assert.equal(new URL(lookup.element.querySelector('a')!.href).hostname,'www.theytree.com');
  dom.window.close();
});
test('SNP list reads only on expansion and selecting a name never submits a query',async()=>{
  const dom=new JSDOM('<body/>');const d=dom.window.document;let reads=0,submits=0;
  const lookup=createSnpLookup(d,async name=>{reads++;assert.equal(name,'O-MF109594');return ['MF109594','MF109928','Y176322','MF109928'];});
  d.body.append(lookup.element);lookup.setMarker('O-MF109594');await tick();assert.equal(reads,0);
  lookup.element.open=true;await tick();assert.equal(reads,1);
  lookup.element.querySelector('form')!.addEventListener('submit',()=>submits++);
  const tags=[...lookup.element.querySelectorAll<HTMLButtonElement>('.snp-options button')];assert.deepEqual(tags.map(t=>t.textContent),['MF109594','MF109928','Y176322','MF109928']);
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

test('submit stays in sidebar and late query results cannot overwrite another node',async()=>{
 const dom=new JSDOM('<body/>');const d=dom.window.document;let calls=0,finish!:(v:any)=>void;
 const lookup=createSnpLookup(d,undefined,()=>{calls++;return new Promise(r=>finish=r);});d.body.append(lookup.element);lookup.setMarker('O-FGC7600');await tick();assert.equal(calls,0);
 const form=lookup.element.querySelector('form')!;const event=new dom.window.Event('submit',{cancelable:true});form.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(calls,1);
 lookup.setMarker('O-MF109594');finish({status:'ok',query:'FGC7600',rows:[{name:'FGC7600',position:'old result',mutation:'T->G',time:''}],message:'old result'});await tick();assert.equal(lookup.element.querySelector('.snp-result')!.textContent,'');
 form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));finish({status:'ok',query:'MF109594',rows:[{name:'MF109594',position:'hg38 123',mutation:'C->T',time:'2020'}],message:'1 条结果'});await tick();assert.match(lookup.element.querySelector('.snp-result')!.textContent!,/hg38 123/);dom.window.close();
});
