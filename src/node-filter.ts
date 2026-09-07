// Node filter for the 23mofang ancestry tree: hide branches whose clan-relation
// count (clanRelationCount) is below a threshold. The condition is injected
// into the site's existing "筛选" popup and persists in chrome.storage.local.
import {NODE_FILTER_CHANNEL, type NodeFilterThresholds} from './node-filter-shared';

const KEY = 'mofang.nodeFilter.v1';

type Thresholds = NodeFilterThresholds;

export function normalizeThreshold(v: unknown): number {
  const parsed = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

async function loadFilter(): Promise<Thresholds> {
  try {
    const got = await chrome.storage.local.get(KEY);
    const v = got?.[KEY] as Partial<Thresholds> | undefined;
    return { minSamples: normalizeThreshold(v?.minSamples) };
  } catch {
    return { minSamples: 0 };
  }
}

function saveFilter(f: Thresholds): void {
  void chrome.storage.local.set({ [KEY]: f }).catch(() => {});
}

function applyFilter(f: Thresholds): void {
  window.postMessage({channel: NODE_FILTER_CHANNEL, type: 'apply', filter: f}, location.origin);
}

function findConfirmButton(content: Element): HTMLElement | null {
  let scope: Element | null = content;
  while (scope) {
    const actions = Array.from(scope.querySelectorAll<HTMLElement>('button,[role="button"]'));
    const confirm = actions.find(action => action.textContent?.trim() === '确定');
    if (confirm && actions.some(action => action.textContent?.trim() === '重置')) return confirm;
    scope = scope.parentElement;
  }
  return null;
}

function enableConfirmButton(content: Element): HTMLElement | null {
  const confirm = findConfirmButton(content);
  if (!confirm) return null;
  if ('disabled' in confirm) (confirm as HTMLButtonElement).disabled = false;
  confirm.removeAttribute('disabled');
  if (confirm.hasAttribute('aria-disabled')) confirm.setAttribute('aria-disabled', 'false');
  for (const name of ['disabled', 'is-disabled']) confirm.classList.remove(name);
  return confirm;
}

function group(title: string, value: number, onInput: (v: number) => void, onDirty: () => void): HTMLElement {
  const box = document.createElement('div');
  box.dataset.mofangNodeFilterGroup = '';
  box.style.cssText = 'margin:0;padding:4px 0 2px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;letter-spacing:0;';
  const head = document.createElement('div');
  head.textContent = title;
  head.style.cssText = 'margin:0 0 9px;color:#2f3a40;font-size:15px;font-weight:500;line-height:21px;letter-spacing:0;';
  const body = document.createElement('div');
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0;color:#56636a;font-size:14px;font-weight:400;line-height:20px;letter-spacing:0;';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.value = String(value);
  input.setAttribute('aria-label', title);
  input.style.cssText = 'box-sizing:border-box;width:112px;height:36px;margin:0;padding:6px 10px;border:1px solid #cfd8dc;border-radius:6px;background:#fff;color:#253238;font:400 15px/22px -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;letter-spacing:0;outline:none;';
  input.addEventListener('input', () => {
    onInput(normalizeThreshold(input.value));
    onDirty();
  });
  input.addEventListener('change', () => {
    const v = normalizeThreshold(input.value);
    input.value = String(v);
    onInput(v);
    onDirty();
  });
  const suffix = document.createElement('span');
  suffix.textContent = '及以上';
  label.append(input, suffix);
  body.append(label);
  box.append(head, body);
  return box;
}

async function boot(): Promise<void> {
  const filter = await loadFilter();
  let control: HTMLElement | null = null;
  let content: Element | null = null;
  let extensionDirty = false;
  const watchedButtons = new WeakSet<HTMLElement>();

  const markDirty = () => {
    extensionDirty = true;
    if (!content) return;
    const confirm = enableConfirmButton(content);
    if (confirm && !watchedButtons.has(confirm)) {
      watchedButtons.add(confirm);
      confirm.addEventListener('click', () => { extensionDirty = false; }, { capture: true });
    }
  };

  const install = () => {
    const nextContent = document.querySelector('.node-filter-content');
    if (!nextContent) { content = null; return; }
    content = nextContent;
    // Re-inject if the site re-rendered the popup and dropped our controls.
    if (!control?.isConnected || control.parentElement !== content) {
      control = document.createElement('div');
      control.dataset.mofangNodeFilter = '';
      control.style.cssText = 'padding:6px 0 2px;';
      control.append(
        group('最小宗亲人数', filter.minSamples, v => { filter.minSamples = v; saveFilter(filter); applyFilter(filter); }, markDirty),
      );
      content.append(control);
    }
    if (extensionDirty) markDirty();
  };

  let timer = 0;
  const schedule = () => {
    if (timer) return;
    timer = window.setTimeout(() => { timer = 0; install(); applyFilter(filter); }, 180);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  // Route changes may replace the tree without a mutation; re-check on a timer.
  let route = location.pathname + location.search;
  window.setInterval(() => {
    const now = location.pathname + location.search;
    if (now !== route) { route = now; install(); applyFilter(filter); }
  }, 700);
  install();
  applyFilter(filter);
}

if (typeof document !== 'undefined') {
  if (document.body) void boot().catch(e => console.error('节点筛选启动失败', e));
  else document.addEventListener('DOMContentLoaded', () => void boot().catch(e => console.error('节点筛选启动失败', e)), { once: true });
}
