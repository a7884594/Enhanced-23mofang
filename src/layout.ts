export interface MapMount {anchor:Element; container:HTMLElement|null; after:boolean}
export function findMapMount(doc:Document,allowFallback=false):MapMount|null {
  const container=doc.querySelector<HTMLElement>('.parentsum-distributed-map-container');
  // The website uses row-reverse on desktop and column on mobile. Stay OUTSIDE
  // this flex container, instead of becoming another item next to the provinces.
  const group=container?.closest('.parentsum-distributed-map')||doc.querySelector('.parentsum-distributed-map');
  if(group)return {anchor:group,container,after:false};
  if(container)return {anchor:container,container,after:false};
  // Do not briefly mount a ready/loading map at the page title while Vue mounts
  // the distribution section. A title fallback is only for error/empty notices.
  const title=allowFallback?doc.querySelector('h1'):null;
  return title?{anchor:title,container:null,after:true}:null;
}
export function insertMapHost(host:HTMLElement,target:MapMount){
  if(target.after)target.anchor.after(host);else target.anchor.before(host);
}
