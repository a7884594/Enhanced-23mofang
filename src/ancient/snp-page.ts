import {createSnpLookup} from './snp-lookup';
import {A_CHANNEL, marker} from './model';
import {orderedSnpGroups} from './snp-order';
import {requestMofangSnp} from './mofang-snp-result';
import type {SnpResult} from './snp-result';

export function readOrderedNodeSnps(name: string): Promise<string[]> {
  const request = crypto.randomUUID(), route = location.href;
  return new Promise((resolve, reject) => {
    const done = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window || event.origin !== location.origin || data?.channel !== A_CHANNEL || data.type !== 'node-snps' || data.request !== request || data.marker !== name || data.route !== route || location.href !== route) return;
      clearTimeout(timer); window.removeEventListener('message', done);
      resolve(orderedSnpGroups(data.snps));
    };
    const timer = setTimeout(() => {window.removeEventListener('message', done); reject(Error('读取SNP超时，请等待树加载后重试。'));}, 18000);
    window.addEventListener('message', done);
    window.postMessage({channel: A_CHANNEL, type: 'read-snps', marker: name, request, localOnly: true, display: true}, location.origin);
  });
}

const STYLE = `
:host{color:#253e4c;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;color-scheme:light}*{box-sizing:border-box}
dialog{width:1080px;max-width:calc(100vw - 48px);height:760px;max-height:calc(100dvh - 48px);padding:0;border:1px solid #d8e3e8;border-radius:16px;background:#fbfcfd;color:inherit;box-shadow:0 24px 90px #122e4540;overflow:hidden}
dialog::backdrop{background:#172f4655}dialog[open]{display:flex;flex-direction:column}
header{padding:22px 28px;background:white;border-bottom:1px solid #e0e8ed;display:flex;align-items:center;justify-content:space-between;gap:16px}
h1{font-size:24px;margin:0}header p{margin:4px 0 0;color:#657b89;font-size:13px}.close{background:#edf3f6;border:0;border-radius:7px;padding:8px 14px;color:#365569}
button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #76b4d8;outline-offset:2px}button:disabled{opacity:.5;cursor:wait}
main{flex:1;min-height:0;padding:22px 28px;overflow:auto}.snp-lookup{height:100%}.snp-layout{height:min(590px,calc(100dvh - 224px));display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto;gap:14px 24px}
.snp-lookup>summary{display:none}.snp-layout>p[role=status]{grid-column:1;grid-row:1;margin:0;font-size:13px;color:#597180;align-self:center}
.snp-options{grid-column:1;grid-row:2 / 4;overflow:auto;align-content:start;display:flex;flex-wrap:wrap;gap:9px;padding:14px;background:white;border:1px solid #e0e8ed;border-radius:10px}
.snp-group{display:inline-flex;align-items:center;flex-wrap:wrap;align-self:flex-start;gap:2px;border:1px solid #d9e4e9;border-radius:6px;padding:3px;color:#96a7b0;max-width:100%}
.snp-group button{border:0;background:transparent;border-radius:4px;padding:3px 5px;font-size:13px;color:#35576c;overflow-wrap:anywhere;min-width:0}.snp-group button:hover{background:#eaf3f8}.snp-group button[aria-pressed=true]{background:#226b92;color:white}
form{grid-column:2;grid-row:1;display:flex;gap:7px;align-items:center}form input:not([type=hidden]){width:0;min-width:0;flex:1}form input,form select{padding:8px;border:1px solid #ccdbe3;border-radius:6px;background:white;color:#304f60}form button{background:#226b92;border:1px solid #226b92;color:white;padding:8px 14px;border-radius:6px}
.snp-result{grid-column:2;grid-row:2 / 4;overflow:auto;overflow-wrap:anywhere;padding:16px;border:1px solid #e0e8ed;border-radius:10px;background:white}.snp-result:empty:before{content:'选择左侧 SNP 或输入名称，再点击查询。';color:#78909e}.snp-result article{border-top:1px solid #e4ebef;padding:14px 0}.snp-result p{margin:0 0 12px}.snp-result a{color:#226b92}
.snp-layout>button{grid-column:1;grid-row:4;justify-self:start;padding:6px 10px;border:1px solid #ccdbe3;background:white;border-radius:6px;color:#365569}.snp-layout>p:last-child{grid-column:2;grid-row:4;margin:0;color:#78909e;font-size:12px}
[hidden]{display:none!important}.report-entry{position:fixed;right:18px;bottom:20px;z-index:2147483500;border:1px solid #ccdbe3;border-radius:8px;padding:10px 16px;background:white;color:#365569;box-shadow:0 4px 20px #1232}
@media(max-width:700px){dialog{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0}header{padding:14px 16px}h1{font-size:20px}main{padding:14px 16px}.snp-lookup{height:auto}.snp-layout{height:auto;display:flex;flex-direction:column;gap:14px}.snp-layout>p[role=status]{align-self:stretch}.snp-options{min-height:80px;max-height:36dvh;flex-shrink:0}.snp-result{min-height:130px;overflow:visible}form{order:-1}.snp-layout>button{align-self:flex-start}}
`;

type Services = {read: (name: string) => Promise<string[]>; query: (value: string, provider?: 'theytree' | 'mofang',owner?:string) => Promise<SnpResult>};
export function bootSnpPage(doc = document, services: Services = {
  read: readOrderedNodeSnps,
  query: async (value, provider,owner) => {
    if (provider === 'mofang') return requestMofangSnp(value,owner);
    const response = await chrome.runtime.sendMessage({type: 'anc.snpLookup', snp: value});
    if (!response?.ok) throw Error(response?.error || 'SNP查询失败，请重试');
    return response.value;
  },
}) {
  if (doc.getElementById('mofang-snp-page')) return;
  const win = doc.defaultView!;
  const host = doc.createElement('div'); host.id = 'mofang-snp-page';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>${STYLE}</style><dialog aria-labelledby="snp-title"><header><div><h1 id="snp-title">SNP查询</h1><p>23魔方原站顺序 · 点击同义组内的名称进行查询</p></div><button class="close" type="button">关闭</button></header><main></main></dialog><button class="report-entry" type="button" hidden>SNP查询</button>`;
  doc.body.append(host);
  const dialog = shadow.querySelector('dialog')!;
  const title = shadow.querySelector('h1')!;
  const closeButton = shadow.querySelector<HTMLButtonElement>('.close')!;
  const reportEntry = shadow.querySelector<HTMLButtonElement>('.report-entry')!;
  const lookup = createSnpLookup(doc, services.read, services.query);
  shadow.querySelector('main')!.append(lookup.element);
  let trigger: Element | null = null, route = win.location.href;
  function close(restoreFocus = true) {
    lookup.reset(); if (dialog.open) dialog.close();
    if (restoreFocus && trigger?.isConnected) (trigger as HTMLElement).focus?.();
    trigger = null;
  }
  function open(name: string, source: Element) {
    doc.dispatchEvent(new win.CustomEvent('mofang-sample-panel-open', {detail: 'snp'}));
    trigger = source; route = win.location.href;
    title.textContent = name ? `${name} · SNP查询` : 'SNP查询';
    lookup.setMarker(name); lookup.element.open = true;
    if (!dialog.open) dialog.showModal();
    closeButton.focus();
  }
  closeButton.onclick = () => close();
  dialog.addEventListener('cancel', event => {event.preventDefault(); close();});
  dialog.addEventListener('close', () => {if (!dialog.open) lookup.reset();});
  doc.addEventListener('mofang-sample-panel-open', event => {if ((event as CustomEvent).detail !== 'snp' && dialog.open) close(false);});
  reportEntry.onclick = () => open('', reportEntry);

  function nativeControl(target: EventTarget | null) {
    if (!(target instanceof win.Element)) return null;
    const button = target.closest('.snp-wrapper');
    const node = button?.parentElement;
    if (!button || !node?.matches('.tree-wrapper g.node') || node.querySelector(':scope > .person-container')) return null;
    const name = marker(node.querySelector(':scope > text.label')?.textContent);
    return name ? {button, name} : null;
  }
  // Capture before the site's tooltip and node handlers, retaining its original control geometry.
  for (const type of ['mouseover','mouseenter','pointerover','pointerenter','mousedown','pointerdown','click','dblclick','keydown']) {
    win.addEventListener(type, event => {
      const control = nativeControl(event.target); if (!control) return;
      if (event.type === 'keydown' && !['Enter',' '].includes((event as KeyboardEvent).key)) return;
      event.stopImmediatePropagation(); event.preventDefault();
      if (event.type === 'click' || event.type === 'keydown') open(control.name, control.button);
    }, true);
  }
  function scan() {
    if (route !== win.location.href) {route = win.location.href; if (dialog.open) close(false);}
    for (const button of doc.querySelectorAll('.tree-wrapper g.node > .snp-wrapper')) {
      const control = nativeControl(button); if (!control) continue;
      for (const [key, value] of Object.entries({role: 'button', tabindex: '0', 'aria-label': `${control.name} SNP查询`, 'aria-haspopup': 'dialog'})) {
        if (button.getAttribute(key) !== value) button.setAttribute(key, value);
      }
    }
    reportEntry.hidden = !['/report/ancestry','/report/gene-origin/my-origin'].includes(win.location.pathname.replace(/\/$/, ''));
  }
  let scheduled = false;
  new win.MutationObserver(() => {
    if (scheduled) return; scheduled = true;
    win.setTimeout(() => {scheduled = false; scan();}, 200);
  }).observe(doc.body, {childList: true, subtree: true, characterData: true});
  win.addEventListener('popstate', scan);
  win.setInterval(() => {if (route !== win.location.href) scan();}, 700);
  scan();
  return {host, dialog};
}
