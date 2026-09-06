import {A_CHANNEL,normalizeTree,sourceMarker} from './model';
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.channel!==A_CHANNEL||event.data?.type!=='read-source')return;
  const name=sourceMarker(location.pathname);if(!name)return;
  try{
    const tree=(window as any).jQuery?.fn?.zTree?.getZTreeObj('tree');
    if(!tree?.getNodes)return;
    const roots=tree.getNodes();const queue=[...roots];const rows:any[]=[];const visited=new Set();
    while(queue.length&&rows.length<150000){const n=queue.shift();if(!n||visited.has(n))continue;visited.add(n);rows.push(n);if(Array.isArray(n.children))queue.push(...n.children);}
    // Publicly displayed source tree only, stripped BEFORE crossing worlds.
    const page=normalizeTree({code:1,data:{ytree:rows}});
    window.postMessage({channel:A_CHANNEL,type:'source-tree',marker:name,page},location.origin);
  }catch{/* The normal page may still be loading its tree widget. */}
});
