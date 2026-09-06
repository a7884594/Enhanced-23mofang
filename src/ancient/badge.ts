const NS='http://www.w3.org/2000/svg';
/** Only confirmed direct-zero results are hidden; unknown is never treated as zero. */
export function paintAncientBadge(button:SVGGElement,count?:number,complete=true){
  const empty=count===0&&complete;
  if(empty)button.style.setProperty('display','none','important');else button.style.removeProperty('display');
  button.setAttribute('aria-hidden',String(empty));button.setAttribute('tabindex',empty?'-1':'0');
  const cached=count!=null;const key=`${button.dataset.marker}|${cached?count:'compact'}|${complete}`;
  const rect=button.querySelector('rect')!,text=button.querySelector('text')!;
  const label=cached?`古DNA · ${count}${complete?'':'+'}`:'古';
  if(button.dataset.badgeState===key&&text.textContent===label&&rect.getAttribute('width')===(cached?'78':'20'))return;button.dataset.badgeState=key;
  for(const [k,v]of Object.entries({width:cached?'78':'20',height:cached?'24':'20',rx:cached?'5':'4',fill:cached?'#f8f0df':'#f5f3ee',stroke:cached?'#ccb58d':'#ded7ca'}))rect.setAttribute(k,v);
  for(const [k,v]of Object.entries({x:cached?'7':'10',y:cached?'16':'14','text-anchor':cached?'start':'middle',fill:cached?'#866134':'#897a66'}))text.setAttribute(k,v);
  text.textContent=label;
  let title=button.querySelector<SVGTitleElement>('title');if(!title){title=document.createElementNS(NS,'title');button.prepend(title);}
  title.textContent=`${button.dataset.marker} · 古DNA${cached?(complete?` · 已缓存 ${count} 条`:` · 已发现 ${count} 条，查询尚未完整，点击继续`):' · 尚未确认：未查询或两站节点未对应，点击查询'}`;
}
export function paintAnalysisEntry(button:HTMLButtonElement,count?:number,complete=true){
  const empty=count===0&&complete;button.hidden=empty;
  if(empty)button.style.setProperty('display','none','important');else button.style.removeProperty('display');
  const cached=count!=null;const key=`${button.dataset.marker}|${cached?count:'compact'}|${complete}`;
  if(button.dataset.badgeState===key)return;button.dataset.badgeState=key;
  button.textContent=cached?`古DNA · ${count}${complete?'':'+'}`:'古';
  button.title=`${button.dataset.marker} · 古DNA${cached?(complete?` · 已缓存 ${count} 条`:` · 已发现 ${count} 条，查询尚未完整，点击继续`):' · 尚未确认：未查询或两站节点未对应，点击查询'}`;
  button.setAttribute('aria-label',`${button.dataset.marker} 古DNA查询`);
  button.style.cssText=cached?'margin:8px 0;padding:8px 14px;border:1px solid #ccb58d;border-radius:7px;background:#f8f0df;color:#866134;cursor:pointer':'margin:8px 0;padding:0;width:24px;height:24px;border:1px solid #ded7ca;border-radius:4px;background:#f5f3ee;color:#897a66;font-size:12px;cursor:pointer';
  if(empty)button.style.setProperty('display','none','important');
}
