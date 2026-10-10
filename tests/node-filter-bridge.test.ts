import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {applyPageNodeFilter, observePageNodeFilter, nodeCounts} from '../src/node-filter-bridge';

const {JSDOM} = createRequire(import.meta.url)('jsdom');

test('MAIN-world bridge reads D3 counts and filters only nodes below known thresholds', () => {
  const dom = new JSDOM('<div class="tree-wrapper"><svg><g id="small" class="node"></g><g id="large" class="node"></g><g id="pending" class="node"></g></svg></div>');
  const document = dom.window.document;
  const small = document.querySelector('#small') as any;
  const large = document.querySelector('#large') as any;
  const pending = document.querySelector('#pending') as any;
  small.__data__ = {data: {clanRelationCount: 2}, children: [{}, {}]};
  large.__data__ = {data: {clanRelationCount: 8}, children: [{}, {}, {}, {}]};
  pending.__data__ = {data: {}};

  try {
    assert.deepEqual(nodeCounts(small), {samples: 2});
    applyPageNodeFilter(document, {minSamples: 5});
    assert.equal(small.style.display, 'none');
    assert.equal(large.style.display, '');
    assert.equal((document.querySelector('#pending') as HTMLElement).style.display, '');
    applyPageNodeFilter(document, {minSamples: 0, minChildren: 999});
    assert.equal(small.style.display, '');
  } finally {
    dom.window.close();
  }
});

test('unknown individual counts fail open instead of clearing the whole tree', () => {
  const dom = new JSDOM('<div class="tree-wrapper"><svg><g class="node"></g></svg></div>');
  const node = dom.window.document.querySelector('.node') as HTMLElement;
  try {
    applyPageNodeFilter(dom.window.document, {minSamples: 100});
    assert.equal(node.style.display, '');
  } finally {
    dom.window.close();
  }
});

test('hidden rows are compacted with links and SVG height, then fully restored', () => {
  const dom = new JSDOM(`<div class="tree-wrapper"><svg height="220"><g>
    <path id="to-hidden" class="link" d="M47.8,30L47.8,65L65.8,65"></path>
    <path id="to-child" class="link" d="M77.8,80L77.8,115L95.8,115"></path>
    <path id="to-sibling" class="link" d="M47.8,30L47.8,165L65.8,165"></path>
    <g id="root" class="node" transform=""></g>
    <g id="hidden" class="node" transform="translate(65.8, 50)"></g>
    <g id="child" class="node" transform="translate(95.8, 100)"></g>
    <g id="sibling" class="node" transform="translate(65.8, 150)"></g>
  </g></svg></div>`);
  const document = dom.window.document;
  const root = document.querySelector('#root') as any;
  const hidden = document.querySelector('#hidden') as any;
  const child = document.querySelector('#child') as any;
  const sibling = document.querySelector('#sibling') as any;
  root.__data__ = {data: {clanRelationCount: 100}, parent: null};
  hidden.__data__ = {data: {clanRelationCount: 2}, parent: root.__data__};
  child.__data__ = {data: {clanRelationCount: 20}, parent: hidden.__data__};
  sibling.__data__ = {data: {clanRelationCount: 50}, parent: root.__data__};
  (document.querySelector('#to-hidden') as any).__data__ = hidden.__data__;
  (document.querySelector('#to-child') as any).__data__ = child.__data__;
  (document.querySelector('#to-sibling') as any).__data__ = sibling.__data__;

  try {
    applyPageNodeFilter(document, {minSamples: 10});
    assert.equal(hidden.style.display, 'none');
    assert.equal(child.getAttribute('transform'), 'translate(95.8, 50)');
    assert.equal(sibling.getAttribute('transform'), 'translate(65.8, 100)');
    assert.equal((document.querySelector('#to-hidden') as HTMLElement).style.display, 'none');
    assert.equal(document.querySelector('#to-child')!.getAttribute('d'), 'M47.8,30L47.8,65L95.8,65');
    assert.equal(document.querySelector('#to-sibling')!.getAttribute('d'), 'M47.8,30L47.8,115L65.8,115');
    assert.equal(document.querySelector('svg')!.getAttribute('height'), '170');

    applyPageNodeFilter(document, {minSamples: 10});
    assert.equal(child.getAttribute('transform'), 'translate(95.8, 50)');
    assert.equal(document.querySelector('svg')!.getAttribute('height'), '170');

    applyPageNodeFilter(document, {minSamples: 0});
    assert.equal(hidden.style.display, '');
    assert.equal(child.getAttribute('transform'), 'translate(95.8, 100)');
    assert.equal(document.querySelector('#to-child')!.getAttribute('d'), 'M77.8,80L77.8,115L95.8,115');
    assert.equal(document.querySelector('svg')!.getAttribute('height'), '220');
  } finally {
    dom.window.close();
  }
});

test('installed MAIN observer compacts an expanded tree in the mutation microtask', async () => {
  const dom = new JSDOM(`<div class="tree-wrapper"><svg class="overlay" height="120"><g id="tree">
    <path id="to-child" class="link" d="M47.8,30L47.8,65L65.8,65"></path>
    <g id="root" class="node" transform=""></g>
    <g id="child" class="node" transform="translate(65.8, 50)"></g>
  </g></svg></div>`, {url: 'https://www.23mofang.com/ancestry/ytree/O-F8'});
  const w = dom.window as any;
  const document = w.document;
  const root = document.querySelector('#root') as any;
  const child = document.querySelector('#child') as any;
  root.__data__ = {x: 0, y: 0, data: {clanRelationCount: 100}, parent: null};
  child.__data__ = {x: 65.8, y: 50, data: {clanRelationCount: 50}, parent: root.__data__};
  (document.querySelector('#to-child') as any).__data__ = child.__data__;
  const observer = observePageNodeFilter(w as Window,()=>({minSamples:10}));

  try {
    applyPageNodeFilter(document,{minSamples:10});

    const hidden = document.createElementNS('http://www.w3.org/2000/svg', 'g') as any;
    hidden.setAttribute('id', 'hidden'); hidden.setAttribute('class', 'node'); hidden.setAttribute('transform', 'translate(65.8, 50)');
    hidden.__data__ = {x: 65.8, y: 100, data: {clanRelationCount: 2}, parent: root.__data__};
    const visible = document.createElementNS('http://www.w3.org/2000/svg', 'g') as any;
    visible.setAttribute('id', 'visible'); visible.setAttribute('class', 'node'); visible.setAttribute('transform', 'translate(65.8, 50)');
    visible.__data__ = {x: 95.8, y: 150, data: {clanRelationCount: 20}, parent: hidden.__data__};
    const toHidden = document.createElementNS('http://www.w3.org/2000/svg', 'path') as any;
    toHidden.setAttribute('class', 'link'); toHidden.setAttribute('d', 'M47.8,30L47.8,70L55,70'); toHidden.__data__ = hidden.__data__;
    const toVisible = document.createElementNS('http://www.w3.org/2000/svg', 'path') as any;
    toVisible.setAttribute('class', 'link'); toVisible.setAttribute('d', 'M77.8,80L77.8,90L80,90'); toVisible.__data__ = visible.__data__;
    const tree = document.querySelector('#tree')!;
    tree.prepend(toHidden, toVisible);
    tree.append(hidden, visible);
    document.querySelector('svg')!.setAttribute('height', '220');

    await Promise.resolve();
    assert.equal(hidden.style.display, 'none');
    assert.equal(visible.getAttribute('transform'), 'translate(95.8, 100)');
    assert.equal(toVisible.getAttribute('d'), 'M47.8,30L47.8,115L95.8,115');
    assert.equal(document.querySelector('svg')!.getAttribute('height'), '170');
  } finally {
    observer.disconnect();
    dom.window.close();
  }
});
