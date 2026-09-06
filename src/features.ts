export const FEATURE_KEYS = {
  samples: 'mofang.features.samples',
  map: 'mofang.features.map',
} as const;
export type Feature = keyof typeof FEATURE_KEYS;

// Missing settings preserve the behavior of existing installations.
export async function runFeature(feature: Feature, start: () => Promise<unknown>): Promise<void> {
  try {
    const key = FEATURE_KEYS[feature];
    const saved = await chrome.storage.local.get(key);
    if (saved[key] !== false) await start();
  } catch (error) {
    console.error('Enhanced 23mofang 功能启动失败', feature, error);
  }
}
