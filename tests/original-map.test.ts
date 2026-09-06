import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resizeOriginalMap} from '../src/original-map.ts';
import {hideOriginalMap,showOriginalMap} from '../src/original-visibility';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
function setup(){
  const dom=new JSDOM('<main><section id="original"><div id="map"></div></section><div id="other"></div></main>');
  const container=dom.window.document.querySelector('#original');const map=dom.window.document.querySelector('#map');
  container.getBoundingClientRect=()=>({width:700,height:360});map.getBoundingClientRect=()=>({width:488,height:324});
  const calls:any[]=[];
  const instance={getDom:()=>map,isDisposed:()=>false,resize:(options:any)=>calls.push(options)};
  const root:any={$children:[{myChart:instance}]};
  return {dom,container,map,calls,instance,root};
}
test('hiding native map keeps display measurable and restores exact inline styles across repeated toggles',()=>{
  const h=setup();h.container.style.cssText='position:relative;width:80%!important;color:red';
  const original=h.container.style.cssText;
  for(let i=0;i<3;i++){
    hideOriginalMap(h.container);hideOriginalMap(h.container);
    assert.notEqual(h.container.style.display,'none');assert.equal(h.container.style.visibility,'hidden');assert.equal(h.container.style.width,'700px');
    showOriginalMap(h.container);assert.equal(h.container.style.width,'80%');assert.equal(h.container.style.getPropertyPriority('width'),'important');assert.equal(h.container.style.position,'relative');assert.equal(h.container.style.left,'');assert.equal(h.container.style.visibility,'');
  }
  assert.ok(original.includes('red'));h.dom.window.close();
});
test('restored original map receives explicit nonzero dimensions',()=>{
  const h=setup();assert.equal(resizeOriginalMap(h.root,h.container),true);assert.deepEqual(h.calls,[{width:488,height:324}]);h.dom.window.close();
});
test('does not resize hidden containers or unrelated site charts',()=>{
  const h=setup();h.container.getBoundingClientRect=()=>({width:0,height:0});assert.equal(resizeOriginalMap(h.root,h.container),false);
  h.container.getBoundingClientRect=()=>({width:700,height:360});h.instance.getDom=()=>h.dom.window.document.querySelector('#other');assert.equal(resizeOriginalMap(h.root,h.container),false);assert.equal(h.calls.length,0);h.dom.window.close();
});
test('late-created original map can be recovered on retry',()=>{
  const h=setup();const child=h.root.$children.pop();assert.equal(resizeOriginalMap(h.root,h.container),false);h.root.$children.push(child);assert.equal(resizeOriginalMap(h.root,h.container),true);h.dom.window.close();
});
test('disposed or detached original chart is ignored',()=>{
  const h=setup();h.instance.isDisposed=()=>true;assert.equal(resizeOriginalMap(h.root,h.container),false);h.instance.isDisposed=()=>false;h.map.remove();assert.equal(resizeOriginalMap(h.root,h.container),false);h.dom.window.close();
});
test('cycles and duplicate references resize an instance only once',()=>{
  const h=setup();h.root.$children.push(h.root,h.root.$children[0]);assert.equal(resizeOriginalMap(h.root,h.container),true);assert.equal(h.calls.length,1);h.dom.window.close();
});
