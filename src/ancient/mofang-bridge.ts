import {A_CHANNEL,marker} from './model';
import {snps} from './snps';
import {htmlSnps} from './nuxt-snps';
import {orderedSnpGroups} from './snp-order';
export function localSnps(name:string,doc:Document,nuxt:any,display=false):string[]{
  const normalize=display?orderedSnpGroups:snps;
  for(const node of doc.querySelectorAll('.tree-wrapper g.node')){
    if(node.querySelector(':scope > .person-container'))continue;
    if(marker(node.querySelector(':scope > text.label')?.textContent)!==name)continue;
    const data=(node as any).__data__?.data;
    if(data?.id===name&&Array.isArray(data.rsids))return normalize(data.rsids);
  }
  const queue=[nuxt];const seen=new Set();
  while(queue.length&&seen.size<600){const vm=queue.shift();if(!vm||seen.has(vm))continue;seen.add(vm);
    if(vm.$el?.isConnected&&!vm._isDestroyed){
      const nodes=[vm.$data?.treeData,vm.$data?.branchData];const visited=new Set();
      while(nodes.length&&visited.size<150000){const n=nodes.pop();if(!n||visited.has(n))continue;visited.add(n);
        if(n.id===name&&Array.isArray(n.rsids))return normalize(n.rsids);
        if(Array.isArray(n.children))nodes.push(...n.children);
      }
    }
    if(Array.isArray(vm.$children))queue.push(...vm.$children);
  }
  return [];
}
const fetching=new Map<string,Promise<string[]>>();
if(typeof window!=='undefined')window.addEventListener('message',async e=>{
  if(e.source!==window||e.origin!==location.origin||e.data?.channel!==A_CHANNEL||e.data.type!=='read-snps')return;
  const name=marker(e.data.marker);if(!name)return;
  const route=location.href;const display=e.data.display===true;let values=localSnps(name,document,(window as any).$nuxt,display);
  if(!values.length&&!e.data.localOnly){
    const key=name+(display?':display':'');
    if(!fetching.has(key))fetching.set(key,(async()=>{try{
      const r=await fetch(`/ancestry/ytree/${encodeURIComponent(name)}`,{credentials:'omit',signal:AbortSignal.timeout(15000)});
      return r.ok&&new URL(r.url).origin===location.origin?htmlSnps(await r.text(),name,display):[];
    }catch{return [];}finally{fetching.delete(key);}})());
    values=await fetching.get(key)!;
  }
  if(route===location.href)window.postMessage({channel:A_CHANNEL,type:'node-snps',marker:name,request:e.data.request,route,snps:values},location.origin);
});
