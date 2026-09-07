// Node filter for the 23mofang ancestry tree: hide branches whose clan-relation
// count (clanRelationCount) or first-level branch count (children.length) is
// below a threshold. Two conditions are injected into the site's existing
// "筛选" popup; thresholds persist in chrome.storage.local.
const KEY = 'mofang.nodeFilter.v1';
const NODE_SEL = '.tree-wrapper g.node';

interface Thresholds { minSamples: number; minChildren: number }

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

async function loadFilter(): Promise<Thresholds> {
  try {
    const got = await chrome.storage.local.get(KEY);
    const v = got?.[KEY] as Thresholds | undefined;
    return { minSamples: num(v?.minSamples), minChildren: num(v?.minChildren) };
  } catch {
    return { minSamples: 0, minChildren: 0 };
  }
}

function saveFilter(f: Thresholds): void {
  void chrome.storage.local.set({ [KEY]: f }).catch(() => {});
}

function nodeCounts(node: Element): { samples: number; children: number } {
  const d = (node as any).__data__;
  const data = d?.data;
  const samples = typeof data?.clanRelationCount === 'number' ? data.clanRelationCount : 0;
  const kids = d?.children;
  const children = Array.isArray(kids) ? kids.length : Array.isArray(data?.children) ? data.children.length : 0;
  return { samples, children };
}

function active(f: Thresholds): boolean {
  return f.minSamples > 0 || f.minChildren > 0;
}

function applyFilter(f: Thresholds): void {
  for (const node of document.querySelectorAll(NODE_SEL)) {
    const el = node as HTMLElement;
    if (!active(f)) { el.style.display = ''; continue; }
    const { samples, children } = nodeCounts(node);
    el.style.display = samples < f.minSamples || children < f.minChildren ? 'none' : '';
  }
}

function group(title: string, value: number, onInput: (v: number) => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'checkbox-container';
  const head = document.createElement('h4');
  head.className = 'checkbox-group-title';
  const span = document.createElement('span');
  span.textContent = title;
  head.append(span);
  const body = document.createElement('div');
  body.className = 'filter-content';
  const label = document.createElement('label');
  label.style.cssText = 'display:flex;align-items:center;gap:8px;font:13px/1.5 system-ui,sans-serif;color:#333;padding:6px 0;';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.value = String(value);
  input.style.cssText = 'width:72px;padding:4px 6px;border:1px solid #ccd4d8;border-radius:4px;font:inherit;';
  input.addEventListener('change', () => {
    const v = num(input.value);
    input.value = String(v);
    onInput(v);
  });
  label.append(input, document.createTextNode(' 及以上'));
  body.append(label);
  box.append(head, body);
  return box;
}

async function boot(): Promise<void> {
  const filter = await loadFilter();
  let control: HTMLElement | null = null;

  const install = () => {
    const content = document.querySelector('.node-filter-content');
    if (!content) return;
    // Re-inject if the site re-rendered the popup and dropped our controls.
    if (control?.isConnected && control.parentElement === content) return;
    control = document.createElement('div');
    control.append(
      group('最小宗亲数量（扩展）', filter.minSamples, v => { filter.minSamples = v; saveFilter(filter); applyFilter(filter); }),
      group('最小一级支系数（扩展）', filter.minChildren, v => { filter.minChildren = v; saveFilter(filter); applyFilter(filter); }),
    );
    content.append(control);
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
