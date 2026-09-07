import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {normalizeThreshold} from '../src/node-filter';

const {JSDOM} = createRequire(import.meta.url)('jsdom');
const bundle = (await build({entryPoints: ['src/node-filter.ts'], bundle: true, write: false, format: 'iife'})).outputFiles[0].text;
const bridge = (await build({entryPoints: ['src/node-filter-bridge.ts'], bundle: true, write: false, format: 'iife'})).outputFiles[0].text;

test('thresholds accept numeric input values from the DOM', () => {
  assert.equal(normalizeThreshold('12'), 12);
  assert.equal(normalizeThreshold('7.8'), 7);
  assert.equal(normalizeThreshold(''), 0);
  assert.equal(normalizeThreshold('-1'), 0);
  assert.equal(normalizeThreshold('not-a-number'), 0);
});

test('editing the clan threshold saves it, applies it, and enables the site confirm button', async () => {
  const dom = new JSDOM(`
    <body>
      <section class="filter-panel">
        <div class="node-filter-content"></div>
        <footer><button>重置</button><button class="is-disabled" disabled aria-disabled="true">确定</button></footer>
      </section>
      <div class="tree-wrapper"><svg><g id="small" class="node"></g><g id="large" class="node"></g></svg></div>
    </body>`, {url: 'https://www.23mofang.com/ancestry/ytree/O-MF109594', runScripts: 'outside-only'});
  const w = dom.window as any;
  const saved: Record<string, unknown>[] = [];
  w.chrome = {storage: {local: {
    get: async () => ({'mofang.nodeFilter.v1': {minSamples: 0, minChildren: 999}}),
    set: async (value: Record<string, unknown>) => { saved.push(value); },
  }}};
  w.postMessage = (data: unknown) => queueMicrotask(() => w.dispatchEvent(new w.MessageEvent('message', {
    source: w, origin: w.location.origin, data,
  })));
  const small = w.document.querySelector('#small');
  const large = w.document.querySelector('#large');
  small.__data__ = {data: {clanRelationCount: 2}, children: []};
  large.__data__ = {data: {clanRelationCount: 8}, children: []};

  try {
    w.eval(bridge);
    w.eval(bundle);
    await new Promise(resolve => setTimeout(resolve, 0));
    const inputs = w.document.querySelectorAll('[data-mofang-node-filter] input');
    assert.equal(inputs.length, 1);
    const control = w.document.querySelector('[data-mofang-node-filter]') as HTMLElement;
    assert.match(control.textContent, /最小宗亲人数/);
    assert.doesNotMatch(control.textContent, /一级支系|扩展/);
    assert.equal((control.querySelector('[data-mofang-node-filter-group] > div') as HTMLElement).style.fontWeight, '500');
    const input = inputs[0] as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new w.Event('input', {bubbles: true}));
    await Promise.resolve();

    const confirm = w.document.querySelector('button:last-child') as HTMLButtonElement;
    assert.equal(confirm.disabled, false);
    assert.equal(confirm.getAttribute('aria-disabled'), 'false');
    assert.equal(confirm.classList.contains('is-disabled'), false);
    assert.equal(small.style.display, 'none');
    assert.equal(large.style.display, '');
    const stored = saved.at(-1)?.['mofang.nodeFilter.v1'] as {minSamples: number; minChildren?: number};
    assert.equal(stored.minSamples, 5);
    assert.equal('minChildren' in stored, false);
  } finally {
    dom.window.close();
  }
});
