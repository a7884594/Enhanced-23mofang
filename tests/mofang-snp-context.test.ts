import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {lookupMofang,matchingMofangNodes,reportTreeSnps} from '../src/ancient/mofang-snp-result';
import {collectMofangContext} from '../src/ancient/mofang-snp-bridge';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const nodes=[{id:'O-MF109594',rsids:['MF109594','MF109928','Y176322','APS1750','MF610176','MF40899']}];
test('report simple tree takes positions only from the exact node, handles cycles, and precedes detail lookup',async()=>{
  const tree:any={id:'ROOT',private:'HIDDEN',children:[{id:'I-M123',rsids:['MF109928#other%999:G->T']},{id:'O-MF109594',rsids:['MF109928#fixture%123:C->T','OTHER1#x%55:A->G']}]};
  tree.children.push(tree);
  assert.deepEqual(reportTreeSnps({code:403,data:tree},'O-MF109594','MF109928'),[]);
  assert.deepEqual(reportTreeSnps({code:0,data:tree},'O-MF109594','MF109928'),['MF109928#fixture%123:C->T']);
  const r=await lookupMofang('MF109928',null,[],async()=>{throw Error('must use report tree before detail');},{nodes,reportTree:async node=>reportTreeSnps({code:0,data:tree},node,'MF109928')});
  assert.equal(r.rows[0].position,'hg19:123');assert.ok(!JSON.stringify(r).includes('HIDDEN'));
});
test('MAIN simple-tree request uses only current barcode, guards scope, and drops switched results',async()=>{
  const bundle=(await build({entryPoints:['src/ancient/mofang-snp-bridge.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
  for(const mode of ['ok','switch','logged-out','sample','share']){
    const dom=new JSDOM('<body><div class="tree-wrapper"><svg><g class="node"><text class="label">O-MF109594</text></g></svg></div></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-MF109594',runScripts:'outside-only'});
    const w=dom.window as any;w.document.querySelector('g').__data__={data:nodes[0]};const replies:any[]=[];const calls:any[]=[];let finish!:(r:any)=>void;
    w.$nuxt={$store:{state:{authed:mode!=='logged-out',sct:{currentReportBarcode:'CURRENT',sampleFlag:mode==='sample'},share:{isShareUrl:mode==='share'}}},$api:{ancestry:{getSimpleTree:async(...args:any[])=>{calls.push(args);return new Promise(resolve=>finish=resolve);}}}};
    w.postMessage=(r:any)=>replies.push(r);
    try{
      w.eval(bundle);w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:'mofang-snp-lookup/v1',type:'query',query:'MF109928',owner:'O-MF109594',request:'tree-test'}}));
      await new Promise(r=>setTimeout(r,10));
      if(mode==='ok'||mode==='switch'){
        assert.deepEqual(calls,[['CURRENT']]);if(mode==='switch')w.$nuxt.$store.state.sct.currentReportBarcode='OTHER';
        finish({code:0,data:{id:'ROOT',private:'HIDDEN',children:[{id:'O-MF109594',rsids:['MF109928#fixture%123:C->T']}]}});
        await new Promise(r=>setTimeout(r,10));
        if(mode==='ok')assert.equal(replies[0].result.rows[0].position,'hg19:123');else assert.match(replies[0].error,/已切换/);
      }else {assert.equal(calls.length,0);assert.equal(replies[0].result.rows.length,0);}
      assert.ok(!JSON.stringify(replies).includes('CURRENT'));assert.ok(!JSON.stringify(replies).includes('HIDDEN'));
    }finally{dom.window.close();}
  }
});
test('known exact node bypasses rejected keyword search and obtains report coordinates',async()=>{
  let reportCalls=0;
  const r=await lookupMofang('MF109928',{getTreeDetailByNode(){throw Error('keyword search must be bypassed');}},[],async id=>{
    reportCalls++;assert.equal(id,'O-MF109594');
    // Synthetic coordinate, not a claimed real MF109928 result.
    return {code:0,data:{haplogroup:id,nodeRsIds:['MF109928#fixture%123:C->T'],private:'HIDDEN'}};
  },{nodes,owner:'O-MF109594'});
  assert.equal(reportCalls,1);assert.equal(r.status,'ok');assert.equal(r.rows[0].position,'hg19:123');assert.ok(!JSON.stringify(r).includes('HIDDEN'));
});
test('owner is only a hint: exact aliases and collisions are validated against local data',async()=>{
  const same=[...nodes,{id:'I-M123',rsids:['MF109928']}];
  assert.equal((await lookupMofang('MF109928',null,[],undefined,{nodes:same})).status,'empty');
  assert.deepEqual(matchingMofangNodes(nodes,'OTHER123','O-MF109594'),[]);
  assert.deepEqual(matchingMofangNodes(nodes,'MF109928','O-WRONG123').map(n=>n.id),['O-MF109594']);
  assert.equal(matchingMofangNodes(same,'MF109928','I-M123')[0].id,'I-M123');
  const alias=await lookupMofang('M1633',null,[],undefined,{nodes:[{id:'O-F8',rsids:['CTS6198/M1633#test%42:G->A']}]});
  assert.equal(alias.rows[0].name,'M1633');assert.equal(alias.rows[0].position,'hg19:42');
});
test('report tree node structure resolves unloaded SNP and local matchList is readable only in allowed scope',()=>{
  const dom=new JSDOM('<body><div class="gene-origin-tree"><svg><g class="node"><text class="nodeText">O-MF920596</text></g></svg></div></body>');
  const d=dom.window.document;
  d.querySelector('g').__data__={data:{id:'O-MF920596',rsids:['MF920605'],personal:'HIDDEN'}};
  const nuxt={$el:d.body,$data:{haploidDetail:{haplogroup:'O-MF920596',matchList:['MF920605#x%15711271:C->A']}}};
  const context=collectMofangContext(d,nuxt,true,'MF920605');
  assert.equal(context.nodes[0].id,'O-MF920596');assert.ok(context.values.includes('MF920605#x%15711271:C->A'));
  assert.ok(!JSON.stringify(context).includes('HIDDEN'));
  assert.deepEqual(collectMofangContext(d,nuxt,false,'MF920605'),{nodes:[],values:[]});
  dom.window.close();
});
test('MAIN transport resolves node without public search, rejects stale account results and strips report fields',async()=>{
  const bundle=(await build({entryPoints:['src/ancient/mofang-snp-bridge.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
  for(const switched of [false,true]){
    const dom=new JSDOM('<body><div class="tree-wrapper"><svg><g class="node"><text class="label">O-MF109594</text></g></svg></div></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-MF109594',runScripts:'outside-only'});
    const w=dom.window as any;w.document.querySelector('g').__data__={data:nodes[0]};
    const replies:any[]=[];let finish!:(r:any)=>void;let calls=0;
    w.$nuxt={$store:{state:{authed:true,sct:{currentReportBarcode:'CURRENT'}}},$api:{ancestry:{postHaploidDetail:async(params:any)=>{
      calls++;assert.deepEqual(JSON.parse(JSON.stringify(params)),{haplogroup:'O-MF109594',barcode:'CURRENT',show_clan_relation:false});
      return new Promise(resolve=>finish=resolve);
    }}}};w.postMessage=(r:any)=>replies.push(r);
    try{
      w.eval(bundle);w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:'mofang-snp-lookup/v1',type:'query',query:'MF109928',owner:'O-MF109594',request:'test'}}));
      await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);
      if(switched)w.$nuxt.$store.state.sct.currentReportBarcode='OTHER';
      finish({code:0,data:{haplogroup:'O-MF109594',nodeRsIds:['MF109928#fixture%123:C->T'],private:'HIDDEN'}});
      await new Promise(r=>setTimeout(r,10));
      if(switched){assert.match(replies[0].error,/已切换/);assert.equal(replies[0].result,undefined);}else assert.equal(replies[0].result.status,'ok');
      assert.ok(!JSON.stringify(replies).includes('CURRENT'));assert.ok(!JSON.stringify(replies).includes('HIDDEN'));
    }finally{dom.window.close();}
  }
});
