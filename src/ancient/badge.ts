const NS='http://www.w3.org/2000/svg';
/** Unqueried nodes stay quiet; only a complete cached result expands the badge. */
export function paintAncientBadge(button:SVGGElement,count?:number){
  const cached=count!=null;const key=`${button.dataset.marker}|${cached?count:'compact'}`;
  if(button.dataset.badgeState===key)return;button.dataset.badgeState=key;
  const rect=button.querySelector('rect')!,text=button.querySelector('text')!;
  for(const [k,v]of Object.entries({width:cached?'78':'20',height:cached?'24':'20',rx:cached?'5':'4',fill:cached?'#f8f0df':'#f5f3ee',stroke:cached?'#ccb58d':'#ded7ca'}))rect.setAttribute(k,v);
  for(const [k,v]of Object.entries({x:cached?'7':'10',y:cached?'16':'14','text-anchor':cached?'start':'middle',fill:cached?'#866134':'#897a66'}))text.setAttribute(k,v);
  text.textContent=cached?`古DNA · ${count}`:'古';
  let title=button.querySelector<SVGTitleElement>('title');if(!title){title=document.createElementNS(NS,'title');button.prepend(title);}
  title.textContent=`${button.dataset.marker} · 古DNA${cached?` · 已缓存 ${count} 条`:' · 点击查询'}`;
}
export function paintAnalysisEntry(button:HTMLButtonElement,count?:number){
  const cached=count!=null;const key=`${button.dataset.marker}|${cached?count:'compact'}`;
  if(button.dataset.badgeState===key)return;button.dataset.badgeState=key;
  button.textContent=cached?`古DNA · ${count}`:'古';
  button.title=`${button.dataset.marker} · 古DNA${cached?` · 已缓存 ${count} 条`:' · 点击查询'}`;
  button.setAttribute('aria-label',`${button.dataset.marker} 古DNA查询`);
  button.style.cssText=cached?'margin:8px 0;padding:8px 14px;border:1px solid #ccb58d;border-radius:7px;background:#f8f0df;color:#866134;cursor:pointer':'margin:8px 0;padding:0;width:24px;height:24px;border:1px solid #ded7ca;border-radius:4px;background:#f5f3ee;color:#897a66;font-size:12px;cursor:pointer';
}
