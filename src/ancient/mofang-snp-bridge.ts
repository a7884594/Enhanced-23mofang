import {lookupMofang,MOFANG_SNP_CHANNEL} from './mofang-snp-result';import {snp} from './snps';
let busy=false;
function positions():unknown[]{
  const values:unknown[]=[];
  for(const n of document.querySelectorAll('.tree-wrapper g.node')){if(n.querySelector(':scope > .person-container'))continue;const rsids=(n as any).__data__?.data?.rsids;if(Array.isArray(rsids))values.push(...rsids.slice(0,5000));if(values.length>=10000)break;}
  const queue=[(window as any).$nuxt],seen=new Set();
  while(queue.length&&seen.size<600){const vm=queue.shift();if(!vm||seen.has(vm))continue;seen.add(vm);if(vm.$el?.isConnected&&!vm._isDestroyed){const raw=vm.$data?.haploidDetail?.nodeRsIds;if(Array.isArray(raw))values.push(...raw.slice(0,5000));}if(Array.isArray(vm.$children))queue.push(...vm.$children);if(values.length>=15000)break;}
  return values;
}
window.addEventListener('message',async e=>{
  const d=e.data;if(e.source!==window||e.origin!==location.origin||d?.channel!==MOFANG_SNP_CHANNEL||d.type!=='query'||typeof d.request!=='string')return;
  const query=snp(d.query);if(!query)return;const route=location.href;
  const send=(data:object)=>{if(location.href===route)window.postMessage({channel:MOFANG_SNP_CHANNEL,type:'result',query,request:d.request,route,...data},location.origin);};
  if(busy){send({error:'前一个23魔方查询仍在进行，请稍后重试'});return;}busy=true;
  try{const result=await lookupMofang(query,(window as any).$nuxt?.$api?.ancestry,positions());send({result});}catch{send({error:'23魔方查询失败，可能需要登录、等待页面加载或稍后重试'});}finally{busy=false;}
});
