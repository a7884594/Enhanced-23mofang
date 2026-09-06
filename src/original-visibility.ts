const fields=['position','left','top','width','visibility','pointer-events'] as const;
const states=new WeakMap<HTMLElement,{field:string;value:string;priority:string}[]>();
/** Keep measurable dimensions while the native chart initializes asynchronously. */
export function hideOriginalMap(container:HTMLElement){
  if(states.has(container))return;
  const width=container.getBoundingClientRect().width;
  states.set(container,fields.map(field=>({field,value:container.style.getPropertyValue(field),priority:container.style.getPropertyPriority(field)})));
  container.style.setProperty('position','absolute','important');
  container.style.setProperty('left','-100000px','important');
  container.style.setProperty('top','0','important');
  if(width>0)container.style.setProperty('width',`${width}px`,'important');
  container.style.setProperty('visibility','hidden','important');
  container.style.setProperty('pointer-events','none','important');
}
export function showOriginalMap(container:HTMLElement){
  const state=states.get(container);if(!state)return;
  for(const {field,value,priority} of state){if(value)container.style.setProperty(field,value,priority);else container.style.removeProperty(field);}
  states.delete(container);
}
