// Isolated-world controls. Drafts are page-local; committed state belongs to the URL.
import {NODE_FILTER_CHANNEL,normalizeThreshold,isTreePath,type NodeFilterState} from './node-filter-shared';
export {normalizeThreshold} from './node-filter-shared';

export function bootNodeFilterControls():()=>void {
  // Legacy global thresholds must never be restored, even if cleanup fails.
  try{void chrome.storage.local.remove('mofang.nodeFilter.v1').catch(()=>{});}catch{}
  let disposed=false,state:NodeFilterState|null=null,sequence=0,control:HTMLElement|null=null,chip:HTMLElement|null=null,notice:HTMLElement|null=null;
  const route=()=>location.pathname+location.search+location.hash;
  const send=(type:string,extra:Record<string,unknown>={})=>window.postMessage({channel:NODE_FILTER_CHANNEL,type,...(state?{route:state.route,epoch:state.epoch,componentId:state.componentId,sequence:++sequence}:{}),...extra},location.origin);
  function remove(){control?.remove();chip?.remove();notice?.remove();control=null;chip=null;notice=null;}
  function render(resetInput=false){
    if(disposed)return;
    if(!state||state.route!==route()||!isTreePath(location.pathname)||state.status==='inactive'){remove();return;}
    const content=document.querySelector<HTMLElement>('.node-filter-content');
    const trigger=document.querySelector<HTMLElement>(`[data-mofang-filter-trigger="${state.componentId}"]`);
    if(state.status!=='ready'){
      control?.remove();control=null;chip?.remove();chip=null;
      const anchor=content||document.querySelector<HTMLElement>('.tree-wrapper');
      if(state.status==='unavailable'&&anchor){
        if(!notice?.isConnected){notice=document.createElement('p');notice.dataset.mofangFilterNotice='';notice.style.cssText='font-size:12px;color:#6d7e8a;';if(content)content.append(notice);else anchor.before(notice);}
        const message=state.error||'人数筛选暂不可用，官方筛选仍可使用。';if(notice.textContent!==message)notice.textContent=message;
      }else{notice?.remove();notice=null;}
      return;
    }
    if(!content||content.dataset.mofangFilterOwner!==state.componentId)return;
    if(!control?.isConnected||control.parentElement!==content){
      control?.remove();control=document.createElement('div');control.dataset.mofangNodeFilter='';
      control.style.cssText='padding:6px 0 2px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;';
      const group=document.createElement('div');group.dataset.mofangNodeFilterGroup='';
      const title=document.createElement('div');title.textContent='最小宗亲人数';title.style.cssText='margin:0 0 9px;font-size:15px;font-weight:500;';
      const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;font-size:14px;';
      const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.setAttribute('aria-label','最小宗亲人数');input.value=String(state.draft);
      input.style.cssText='box-sizing:border-box;width:112px;height:36px;padding:6px 10px;border:1px solid #cfd8dc;border-radius:6px;background:#fff;color:#253238;font-family:inherit;font-size:15px;';
      input.addEventListener('input',()=>send('draft',{value:normalizeThreshold(input.value)}));
      input.addEventListener('change',()=>{input.value=String(normalizeThreshold(input.value));send('draft',{value:normalizeThreshold(input.value)});});
      const suffix=document.createElement('span');suffix.textContent='及以上';label.append(input,suffix);group.append(title,label);control.append(group);content.append(control);
    }
    const input=control.querySelector('input')!;
    if((resetInput||document.activeElement!==input)&&input.value!==String(state.draft))input.value=String(state.draft);
    if(state.applied>0){
      const anchor=trigger||control;
      if(!chip?.isConnected){
        chip=document.createElement('span');chip.dataset.mofangFilterChip='';chip.style.cssText='display:inline-flex;align-items:center;gap:6px;margin:4px 8px;font:12px/1.5 sans-serif;color:#376c80;';
        const text=document.createElement('span'),clear=document.createElement('button');clear.type='button';clear.textContent='清除';clear.setAttribute('aria-label','清除宗亲人数筛选');
        clear.style.cssText='border:0;background:transparent;color:#376c80;cursor:pointer;font:inherit;';clear.onclick=()=>send('clear');chip.append(text,clear);anchor.after(chip);
      }
      const text='宗亲人数 ≥ '+state.applied;if(chip.firstElementChild!.textContent!==text)chip.firstElementChild!.textContent=text;
    }else{chip?.remove();chip=null;}
    if(state.error){
      if(!notice?.isConnected){notice=document.createElement('p');notice.dataset.mofangFilterNotice='';notice.setAttribute('role','status');content.append(notice);}
      if(notice.textContent!==state.error)notice.textContent=state.error;
    }else{notice?.remove();notice=null;}
  }
  const listener=(event:MessageEvent)=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.channel!==NODE_FILTER_CHANNEL||event.data?.type!=='state')return;
    const next=event.data.state as NodeFilterState;
    if(!next||next.route!==route()||!Number.isSafeInteger(next.epoch)||!Number.isSafeInteger(next.revision)||!['ready','unavailable','inactive','navigating'].includes(next.status)||!/^\d*$/.test(next.componentId)||normalizeThreshold(next.draft)!==next.draft||normalizeThreshold(next.applied)!==next.applied)return;
    if(state&&(next.epoch<state.epoch||next.epoch===state.epoch&&next.revision<=state.revision))return;
    const reset=!state||next.epoch!==state.epoch||next.componentId!==state.componentId;
    state=next;render(reset);
  };
  window.addEventListener('message',listener);
  const observer=new MutationObserver(()=>render());observer.observe(document.body,{childList:true,subtree:true});
  let lastRoute=route();
  const timer=window.setInterval(()=>{if(route()!==lastRoute){lastRoute=route();remove();send('request');}else render();},300);
  send('request');
  const dispose=()=>{if(disposed)return;disposed=true;window.removeEventListener('message',listener);window.removeEventListener('pagehide',onHide);observer.disconnect();window.clearInterval(timer);remove();};
  const onHide=(event:PageTransitionEvent)=>{if(!event.persisted)dispose();};
  window.addEventListener('pagehide',onHide);
  return dispose;
}
if(typeof document!=='undefined'){
  if(document.body)bootNodeFilterControls();
  else document.addEventListener('DOMContentLoaded',()=>bootNodeFilterControls(),{once:true});
}
