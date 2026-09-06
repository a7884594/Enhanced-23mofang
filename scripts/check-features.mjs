import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {JSDOM} from 'jsdom';

const flush = () => new Promise(resolve => setImmediate(resolve));
// No DOM globals are provided: disabled bundles must not evaluate their UI modules.
for (const file of ['content','ancient/ui','research/ui','samples/ui','ancient/mofang-snp-entry']) {
  const errors = [];
  runInNewContext(await readFile(`dist/${file}.js`, 'utf8'), {
    chrome: {storage: {local: {get: async key => ({[key]: false})}}},
    console: {error: (...args) => errors.push(args)},
  });
  await flush();
  assert.deepEqual(errors, [], `${file} evaluated disabled UI`);
}
const html = await readFile('dist/popup.html','utf8');
const code = await readFile('dist/popup.js','utf8');
const saved = {};
let fail = false;
async function popup() {
  const dom = new JSDOM(html, {runScripts:'outside-only'});
  dom.window.chrome = {storage:{local:{
    get: async () => ({...saved}),
    set: async values => {if(fail) throw Error('simulated save failure');Object.assign(saved,values);},
  }}};
  dom.window.eval(code);
  await flush();
  return dom;
}
let dom = await popup();
let doc = dom.window.document;
assert.equal(doc.querySelector('#samples').checked,true);
assert.equal(doc.querySelector('#map').checked,true);
for (const name of ['samples','map']) {
  const input = doc.querySelector(`#${name}`);
  input.checked = false;
  input.dispatchEvent(new dom.window.Event('change'));
  await flush();
  assert.equal(saved[`mofang.features.${name}`],false);
}
assert.match(doc.querySelector('#status').textContent,/已保存/);
dom.window.close();
dom = await popup();doc = dom.window.document;
assert.equal(doc.querySelector('#samples').checked,false);
assert.equal(doc.querySelector('#map').checked,false);
fail = true;
const input = doc.querySelector('#samples');input.checked = true;
input.dispatchEvent(new dom.window.Event('change'));await flush();
assert.equal(input.checked,false);assert.equal(input.disabled,false);
assert.match(doc.querySelector('#status').textContent,/保存失败/);
dom.window.close();
console.log('PASS: all five disabled bundles, popup defaults, independent saving, persistence, and save failure rollback');
