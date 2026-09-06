import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FEATURE_KEYS, runFeature} from '../src/features';

test('feature switches preserve defaults and independently gate startup in all four combinations', async () => {
  const previous = globalThis.chrome;
  try {
    for (const map of [undefined, true, false]) for (const samples of [undefined, true, false]) {
      const saved: Record<string, unknown> = {[FEATURE_KEYS.map]: map, [FEATURE_KEYS.samples]: samples};
      globalThis.chrome = {storage: {local: {get: async (key: string) => ({[key]: saved[key]})}}} as unknown as typeof chrome;
      const started: string[] = [];
      await runFeature('map', async () => {started.push('map');});
      await runFeature('samples', async () => {started.push('samples');});
      assert.deepEqual(started, [...(map === false ? [] : ['map']), ...(samples === false ? [] : ['samples'])]);
    }
  } finally {globalThis.chrome = previous;}
});
