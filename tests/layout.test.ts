import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {findMapMount,insertMapHost} from '../src/layout.ts';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('map is a full-width sibling before the website flex group on desktop and mobile',()=>{
  for(const direction of ['row-reverse','column']){
    const dom=new JSDOM(`<h1>标题</h1><section id="section"><div class="parentsum-distributed-map" style="display:flex;flex-direction:${direction}"><div class="parentsum-distributed-map-container"></div><ul id="provinces"></ul></div></section>`);
    const doc=dom.window.document;const group=doc.querySelector('.parentsum-distributed-map');const host=doc.createElement('section');
    const target=findMapMount(doc)!;insertMapHost(host,target);
    assert.equal(host.parentElement,doc.querySelector('#section'));assert.equal(host.nextElementSibling,group);assert.equal(group.children.length,2);assert.equal(group.style.flexDirection,direction);dom.window.close();
  }
});
test('ready/loading views wait for the distribution section rather than jump below h1',()=>{
  const dom=new JSDOM('<h1>标题</h1>');const doc=dom.window.document;
  assert.equal(findMapMount(doc),null);assert.equal(findMapMount(doc,true)?.after,true);
  const group=doc.createElement('div');group.className='parentsum-distributed-map';doc.body.append(group);
  assert.equal(findMapMount(doc)?.anchor,group);assert.equal(findMapMount(doc)?.container,null);dom.window.close();
});
test('replacing the original map keeps the outer anchor and detects the new container',()=>{
  const dom=new JSDOM('<div class="parentsum-distributed-map"><div class="parentsum-distributed-map-container"></div></div>');const doc=dom.window.document;
  const before=findMapMount(doc)!;const replacement=doc.createElement('div');replacement.className='parentsum-distributed-map-container';before.container!.replaceWith(replacement);
  const after=findMapMount(doc)!;assert.equal(after.anchor,before.anchor);assert.equal(after.container,replacement);dom.window.close();
});
