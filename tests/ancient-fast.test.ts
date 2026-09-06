import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {formationAge,analysisAge,showAncientEntry} from '../src/ancient/age';
import {formalNodes} from '../src/ancient/ui';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const ui=(await build({entryPoints:['src/ancient/ui.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
test('age boundary uses displayed formation years and skips unknown ages',()=>{
 assert.equal(formationAge('形成时间距今 999 年'),999);assert.equal(showAncientEntry(199),false);assert.equal(showAncientEntry(200),true);
 for(const age of [230,680,750,999,1000])assert.equal(showAncientEntry(age),true);
 assert.equal(formationAge('形成时间距今约1.2万年'),12000);assert.equal(formationAge('形成时间距今 1,000 年'),1000);
 assert.equal(formationAge('宗亲999人'),null);assert.equal(showAncientEntry(null),false);assert.equal(formationAge('形成时间距今950-1100年'),null);
});
const tree=(name='O-F8',age=6910)=>`<div class="tree-wrapper"><svg><g class="node"><text class="label">${name}</text><text class="time">形成时间距今${age}年</text></g><g class="node"><text class="label">O-Y199</text><text class="time">形成时间距今199年</text></g><g class="node"><text class="label">O-Y200</text><text class="time">形成时间距今200年</text></g><g class="node"><g class="person-container"></g><text class="label">O-P100</text></g></svg></div>`;
test('formal node list excludes under-200-year branches before geometry or badge requests',()=>{
 const d=new JSDOM(tree());assert.deepEqual(formalNodes(d.window.document).map(n=>n.name),['O-F8','O-Y200']);d.window.close();
});
function harness(rename=false,html=tree(rename?'O-MF9915':'O-F8'),path='/ancestry/ytree/O-F8'){
 const dom=new JSDOM(html,{url:'https://www.23mofang.com'+path,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window as any;
 w.SVGElement.prototype.getScreenCTM=()=>({a:1,e:0});const calls:any[]=[];let snpReads=0;
 w.postMessage=(m:any)=>{if(m.type==='read-snps'){snpReads++;setTimeout(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:m.channel,type:'node-snps',request:m.request,route:w.location.href,marker:m.marker,snps:['MF9915','BY220310']}})),0);}};
 w.chrome={runtime:{sendMessage:async(m:any)=>{
  calls.push(m);if(m.type==='anc.counts')return {ok:true,value:{}};
  const missed=rename&&!m.snps;
  const value={id:m.snps?'second':'first',marker:m.marker||'O-F8',target:m.snps?'O-BY220310':'O-F8',scope:'direct',nodeSnps:m.snps,status:missed?'unmatched':'complete',complete:!missed,mapping:'同名标记对应',samples:[],unknown:[],branches:[],snpChecks:[],checked:[],queue:[],details:[],failures:[],updatedAt:Date.now(),message:missed?'未找到同名节点':'查询完成'};
  return {ok:true,value};
 }}};
 w.eval(ui);return {dom,w,calls,reads:()=>snpReads};
}
const tick=()=>new Promise(r=>setTimeout(r,40));
test('O-F8 same-name UI query sends no SNP read or SNP-query payload',async()=>{
 const h=harness();try{
 h.w.document.querySelector('[data-marker="O-F8"]').onclick(new h.w.Event('click'));await tick();
 assert.equal(h.reads(),0);assert.equal(h.calls.filter(c=>c.type==='anc.start').length,1);assert.equal(h.calls.find(c=>c.type==='anc.start').snps,undefined);
 assert.ok(h.calls.filter(c=>c.type==='anc.counts').every(c=>!c.markers.includes('O-Y199')));
 }finally{h.dom.window.close();}
});
test('missing same-name result automatically falls back to full SNP matching once',async()=>{
 const h=harness(true);try{
 h.w.document.querySelector('[data-marker="O-MF9915"]').onclick(new h.w.Event('click'));await tick();
 const starts=h.calls.filter(c=>c.type==='anc.start');assert.equal(starts.length,2);assert.equal(h.reads(),1);assert.equal(starts[0].snps,undefined);assert.deepEqual([...starts[1].snps],['BY220310','MF9915']);
 }finally{h.dom.window.close();}
});
test('age changes remove existing SVG buttons and close their open panel',async()=>{
 const h=harness();try{
 h.w.document.querySelector('[data-marker="O-F8"]').onclick(new h.w.Event('click'));await tick();
 h.w.document.querySelector('.time').textContent='形成时间距今199年';await new Promise(r=>setTimeout(r,740));
 assert.equal(h.w.document.querySelector('[data-marker="O-F8"]'),null);assert.equal(h.w.document.querySelector('#mofang-ancient-panel').shadowRoot.querySelector('.panel').hidden,true);
 }finally{h.dom.window.close();}
});
test('analysis-page keeps sample entries absent when subtitle age changes',async()=>{
 const h=harness(false,'<main><h1>O-F8 支系分析</h1><p>形成时间距今199年</p><section>宗亲10000人</section></main>','/ancestry/ytree/O-F8/branch');try{
 assert.equal(analysisAge(h.w.document),199);assert.equal(h.w.document.getElementById('mofang-ancient-entry'),null);
 h.w.document.querySelector('p').textContent='形成时间距今200年';await new Promise(r=>setTimeout(r,740));assert.equal(h.w.document.getElementById('mofang-ancient-entry'),null);
 h.w.document.querySelector('p').textContent='形成时间距今199年';await new Promise(r=>setTimeout(r,740));assert.equal(h.w.document.getElementById('mofang-ancient-entry'),null);
 }finally{h.dom.window.close();}
});


test('R-FGC9988 at 680 years and R-FGC9989 at 230 years expose ancient entry',async()=>{
 const html='<div class="tree-wrapper"><svg>'+[['R-FGC9988',680],['R-FGC9989',230],['R-Y95533',670]].map(([name,age])=>`<g class="node"><text class="label">${name}</text><text class="time">形成时间距今${age}年</text></g>`).join('')+'</svg></div>';
 const h=harness(false,html,'/ancestry/ytree/R-FGC9988');try{
  for(const name of ['R-FGC9988','R-FGC9989','R-Y95533'])assert.ok(h.w.document.querySelector(`[data-marker="${name}"]`));
  h.w.document.querySelector('[data-marker="R-FGC9988"]').onclick(new h.w.Event('click'));await tick();
  assert.equal(h.calls.find(c=>c.type==='anc.start').marker,'R-FGC9988');assert.equal(h.reads(),0);
 }finally{h.dom.window.close();}
});
