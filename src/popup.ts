import {FEATURE_KEYS, type Feature} from './features';

const status = document.querySelector<HTMLElement>('#status')!;
async function boot() {
  const saved = await chrome.storage.local.get(Object.values(FEATURE_KEYS));
  for (const feature of Object.keys(FEATURE_KEYS) as Feature[]) {
    const input = document.querySelector<HTMLInputElement>(`#${feature}`)!;
    const key = FEATURE_KEYS[feature];
    input.checked = saved[key] !== false;
    input.disabled = false;
    input.onchange = async () => {
      input.disabled = true;
      try {
        await chrome.storage.local.set({[key]: input.checked});
        status.textContent = '已保存，请刷新23魔方网页使开关生效。';
      } catch {
        input.checked = !input.checked;
        status.textContent = '保存失败，请重试。';
      } finally {
        input.disabled = false;
      }
    };
  }
}
void boot().catch(() => {status.textContent = '读取设置失败，请重新打开扩展弹窗。';});
