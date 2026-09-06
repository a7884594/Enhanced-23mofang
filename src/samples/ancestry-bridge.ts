import {marker} from '../ancient/model';
export function localAncestors(doc:Document,name:string):string[]{
  for(const node of doc.querySelectorAll('.tree-wrapper g.node')){
    if(node.querySelector(':scope > .person-container')||marker(node.querySelector(':scope > text.label')?.textContent)!==name)continue;
    const data=(node as any).__data__;if(marker(data?.data?.id)!==name)return [];
    const result:string[]=[],seen=new Set([data]);let parent=data.parent;
    while(parent&&result.length<80&&!seen.has(parent)){seen.add(parent);const m=marker(parent.data?.id);if(!m)break;result.push(m);parent=parent.parent;}
    return result;
  }return [];
}
if(typeof window!=='undefined')window.addEventListener('message',e=>{
  if(e.source!==window||e.origin!==location.origin||e.data?.channel!=='mofang-samples-ancestry/v1'||e.data.type!=='read-ancestors')return;
  const name=marker(e.data.marker);if(!name||typeof e.data.request!=='string')return;
  window.postMessage({channel:'mofang-samples-ancestry/v1',type:'ancestors',request:e.data.request,marker:name,route:location.href,ancestors:localAncestors(document,name)},location.origin);
});
