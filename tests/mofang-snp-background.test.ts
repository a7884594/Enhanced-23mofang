import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
import {reportScope} from '../src/ancient/mofang-snp-bridge';import {lookupMofang} from '../src/ancient/mofang-snp-result';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const bundle=(await build({entryPoints:['src/ancient/mofang-snp-bridge.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
test('only signed-in current own report may perform report lookup',()=>{
 assert.equal(reportScope({authed:true,sct:{currentReportBarcode:'CURRENT'}}).allowed,true);
 for(const state of [{authed:false,sct:{currentReportBarcode:'CURRENT'}},{authed:true,sct:{}},{authed:true,sct:{currentReportBarcode:'CURRENT',sampleFlag:true}},{authed:true,sct:{currentReportBarcode:'CURRENT'},share:{isShareUrl:true}}])assert.equal(reportScope(state).allowed,false);
});
test('authorized report lookup returns coordinates only and does not query generic details redundantly',async()=>{
 const api={getTreeDetailByNode:async()=>({code:0,data:{id:'O-MF920596',rsids:['MF920605']}}),getTreeNodeById:async()=>{throw Error('unnecessary lookup');}};
 const r=await lookupMofang('MF920605',api,[],async node=>{assert.equal(node,'O-MF920596');return {code:0,data:{haplogroup:node,matchList:['MF920605#matched%15711271:C->A'],personal:'HIDDEN'}};});assert.equal(r.status,'ok');assert.equal(r.rows[0].position,'hg19:15711271');assert.ok(!JSON.stringify(r).includes('HIDDEN'));
 for(const detail of [{code:403},{code:0,data:{nodeRsIds:['MF920605']}},{code:0,data:{haplogroup:'O-OTHER',nodeRsIds:['MF920605#x%15711271:C->A']}}]){const denied=await lookupMofang('MF920605',api,[],async()=>detail);assert.equal(denied.status,'unsupported');assert.deepEqual(denied.rows,[]);}
});
test('MAIN bridge uses current report locally and discards result after report switch',async()=>{
 for(const switched of [false,true]){
  const dom=new JSDOM('<body></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-MF920596',runScripts:'outside-only'});const w=dom.window as any;const replies:any[]=[];const calls:any[]=[];let finish:(v:any)=>void=()=>{};
  w.$nuxt={$store:{state:{authed:true,sct:{currentReportBarcode:'CURRENT'}}},$api:{ancestry:{getTreeDetailByNode:async()=>({code:0,data:{id:'O-MF920596',rsids:['MF920605']}}),getTreeNodeById:async()=>{throw Error('unnecessary');},postHaploidDetail:async(p:any)=>{calls.push(p);return new Promise(resolve=>{finish=resolve;});}}}};
  w.open=()=>{throw Error('must not open page');};w.postMessage=(m:any)=>replies.push(m);
  try{w.eval(bundle);w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:'mofang-snp-lookup/v1',type:'query',query:'MF920605',request:'query1'}}));await new Promise(r=>setTimeout(r,10));assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{haplogroup:'O-MF920596',barcode:'CURRENT',show_clan_relation:false}]);
   if(switched)w.$nuxt.$store.state.sct.currentReportBarcode='OTHER';finish({code:0,data:{haplogroup:'O-MF920596',nodeRsIds:['MF920605#x%15711271:C->A'],private:'HIDDEN'}});await new Promise(r=>setTimeout(r,10));
   if(switched){assert.match(replies[0].error,/已切换/);assert.equal(replies[0].result,undefined);}else assert.equal(replies[0].result.rows[0].position,'hg19:15711271');assert.ok(!JSON.stringify(replies).includes('CURRENT'));assert.ok(!JSON.stringify(replies).includes('HIDDEN'));
  }finally{dom.window.close();}
 }
});
