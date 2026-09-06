import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const compiled=(await build({entryPoints:['src/bridge.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
function harness(){
  const dom=new JSDOM('<main></main>',{url:'https://www.23mofang.com/ancestry/ytree/O-CTS7316/branch',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window as any;const events:any[]=[];const guards:Function[]=[];const after:Function[]=[];let poll=()=>{};
  w.postMessage=(m:any)=>events.push(m.snapshot);
  w.setInterval=(fn:()=>void)=>{poll=fn;return 1;};
  const branch={id:'O-CTS7316',geographicDistribution:{chartItems:[{code:'13',name:'河北省',percent:.03,childItems:[{code:'1304',name:'邯郸市',percent:.05,childItems:[{code:'130433',name:'馆陶县',percent:.125}]}]}]},accountToken:'never-export'};
  const vm:any={$data:{branchData:branch},branchData:branch,$el:w.document.querySelector('main'),$route:{path:w.location.pathname,fullPath:w.location.pathname},$children:[],filterParams:{}};
  w.$nuxt={$children:[vm],$router:{beforeEach:(f:Function)=>guards.push(f),afterEach:(f:Function)=>after.push(f)}};
  w.eval(compiled);
  return {dom,w,events,guards,after,vm,poll:()=>poll(),last:()=>events.at(-1)};
}
test('bridge emits only whitelisted geographical summary',()=>{
  const h=harness();assert.equal(h.last().status,'ready');assert.equal(h.last().items[0].childItems[0].childItems[0].percent,.125);
  assert.ok(!JSON.stringify(h.events).includes('never-export'));h.dom.window.close();
});
test('route transition clears immediately, rejects old id, accepts new data',async()=>{
  const h=harness();const to={path:'/ancestry/ytree/O-MF564266/branch',fullPath:'/ancestry/ytree/O-MF564266/branch'};let next=false;
  h.guards[0](to,h.vm.$route,()=>next=true);assert.equal(next,true);assert.equal(h.last().status,'loading');assert.equal(h.last().items.length,0);
  h.dom.reconfigure({url:'https://www.23mofang.com'+to.path});h.vm.$route=to;h.after[0]();await Promise.resolve();h.poll();assert.equal(h.last().status,'loading');
  h.vm.branchData={...h.vm.branchData,id:'O-MF564266'};h.vm.$data.branchData=h.vm.branchData;h.poll();assert.equal(h.last().node,'O-MF564266');assert.equal(h.last().status,'ready');h.dom.window.close();
});
test('filter changes refresh snapshot even with the same data object',()=>{
  const h=harness();h.vm.filterParams={birthplace:[[{code:'13',name:'河北省'},{code:'0'}]]};h.poll();assert.equal(h.last().label,'河北省');assert.equal(h.last().birthplace[0][1].code,'0');h.dom.window.close();
});
test('no-data branch and leaving the page remove old values',()=>{
  const h=harness();h.vm.branchData={id:'O-CTS7316'};h.poll();assert.equal(h.last().status,'empty');
  h.dom.reconfigure({url:'https://www.23mofang.com/'});h.poll();assert.equal(h.last().node,'');assert.equal(h.last().items.length,0);h.dom.window.close();
});
test('anchor links do not cause a valid branch to be rejected',()=>{
  const h=harness();h.vm.$route.fullPath+='#geography';h.dom.reconfigure({url:'https://www.23mofang.com'+h.vm.$route.fullPath});h.poll();assert.equal(h.last().status,'ready');h.dom.window.close();
});
