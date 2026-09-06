import {test} from 'node:test';import assert from 'node:assert/strict';import {lookupMofang,mofangPositions} from '../src/ancient/mofang-snp-result';import {createSnpLookup} from '../src/ancient/snp-lookup';import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('23mofang encoded position keeps hg19 and exact SNP identity from screenshot format',()=>{
 assert.deepEqual(mofangPositions(['MF920605#annotation%15711271:C->A','MF9206050#x%1:A->C','MF920605#x%<script>'],'MF920605'),[{name:'MF920605',position:'hg19:15711271',mutation:'C→A',time:''}]);assert.deepEqual(mofangPositions(['MF920605'],'MF920605'),[]);
});
test('already loaded public position performs no API request and leaks no report fields',async()=>{
 const r=await lookupMofang('MF920605',null,['MF920605#note%15711271:C->A']);assert.equal(r.status,'ok');assert.equal(r.rows[0].position,'hg19:15711271');
});
test('public node lookup uses only keyword and node ID and distinguishes missing coordinates',async()=>{
 const calls:any[]=[];const api={getTreeDetailByNode:async(...args:any[])=>{calls.push(args);return {code:0,data:{id:'O-MF920596',rsids:['MF920605'],private:'DO_NOT_COPY'}};},getTreeNodeById:async(...args:any[])=>{calls.push(args);return {code:0,data:{id:'O-MF920596',rsids:['MF920605']}};}};
 const r=await lookupMofang('MF920605',api);assert.deepEqual(calls,[['MF920605',false],['O-MF920596']]);assert.equal(r.rows[0].position,'未提供坐标');assert.match(r.message,/没有返回坐标/);assert.ok(!JSON.stringify(r).includes('DO_NOT_COPY'));
 api.getTreeNodeById=async()=>({code:0,data:{id:'O-MF920596',rsids:['MF920605#note%15711271:C->A']}});assert.equal((await lookupMofang('MF920605',api)).rows[0].position,'hg19:15711271');
});
test('source selector changes do not query and selected source results stay inline',async()=>{
 const d=new JSDOM('<body></body>');const calls:any[]=[];const widget=createSnpLookup(d.window.document,undefined,async(q,p)=>{calls.push([q,p]);return {status:'ok',query:q,url:'https://www.23mofang.com/ancestry/ytree/O-MF920596',message:'模拟结果',rows:[]};});d.window.document.body.append(widget.element);
 try{const select=widget.element.querySelector('select')!;select.value='mofang';select.dispatchEvent(new d.window.Event('change'));assert.equal(calls.length,0);widget.element.querySelector('input')!.value='MF920605';widget.element.querySelector('form')!.dispatchEvent(new d.window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));assert.deepEqual(calls,[['MF920605','mofang']]);assert.equal(widget.element.querySelector('a')!.hostname,'www.23mofang.com');}finally{d.window.close();}
});
