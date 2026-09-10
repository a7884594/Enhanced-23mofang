import {snp} from './snps';import {marker} from './model';import type {SnpResult} from './snp-result';
import {orderedSnpGroups} from './snp-order';
export const MOFANG_SNP_CHANNEL='mofang-snp-lookup/v1';
export type MofangNode = {id:string;rsids:unknown[]};
const contains=(values:unknown,query:string)=>orderedSnpGroups(values).some(group=>group.split('/').includes(query));
/** Extract only the requested formal node's SNPs; never return the report tree. */
export function reportTreeSnps(response:any,node:string,query:string):unknown[]{
  if(response?.code!==0)return [];
  const pending=[response.data],seen=new Set(),values:unknown[]=[];
  while(pending.length&&seen.size<150000){
    const item=pending.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);
    if(item.id===node&&Array.isArray(item.rsids))values.push(...item.rsids.slice(0,5000).filter((raw:unknown)=>typeof raw==='string'&&raw.length<=500&&contains([raw],query)));
    if(Array.isArray(item.children))pending.push(...item.children);
  }
  return values;
}
export function matchingMofangNodes(nodes:MofangNode[],query:string,owner?:unknown):MofangNode[]{
  const matches=nodes.filter(n=>marker(n.id)&&(snp(n.id)===query||contains(n.rsids,query)));
  const preferred=marker(owner);const selected=matches.some(n=>n.id===preferred)?matches.filter(n=>n.id===preferred):matches;
  const merged=new Map<string,MofangNode>();
  for(const n of selected){const old=merged.get(n.id);if(old)old.rsids.push(...n.rsids);else merged.set(n.id,{id:n.id,rsids:[...n.rsids]});}
  return [...merged.values()];
}
export function mofangPositions(values:unknown,query:string):SnpResult['rows']{
  if(!Array.isArray(values))return [];const rows:SnpResult['rows']=[];
  for(const raw of values.slice(0,5000)){
    if(typeof raw!=='string'||raw.length>500)continue;
    if(!contains([raw],query))continue;const name=query;
    const location=raw.split('%')[1];const m=location?.match(/^(\d+):([ACGT]+|[-]):?->([ACGT]+|[-])$/i);
    if(m)rows.push({name,position:'hg19:'+m[1],mutation:m[2].toUpperCase()+'→'+m[3].toUpperCase(),time:''});
  }return rows.filter((r,i)=>rows.findIndex(v=>v.name===r.name&&v.position===r.position&&v.mutation===r.mutation)===i);
}
export async function lookupMofang(value:unknown,api:any,local:unknown[]=[],report?:(node:string)=>Promise<any>,context:{nodes:MofangNode[];owner?:unknown;reportTree?:(node:string)=>Promise<unknown[]>}={nodes:[]}):Promise<SnpResult>{
  const query=snp(value);if(!query)throw Error('请输入有效SNP名称');
  const base:SnpResult={query,url:'https://www.23mofang.com/report/gene-origin/my-origin',status:'empty',rows:[],message:''};
  const matches=matchingMofangNodes(context.nodes,query,context.owner);
  if(matches.length>1)return {...base,status:'empty',message:'本页多个支系包含该SNP，请从对应节点的SNP按钮进入查询，避免同名混淆。'};
  const loaded=mofangPositions(local,query);if(loaded.length)return {...base,status:'ok',rows:loaded,message:'23魔方 · 页面已加载的SNP位置（hg19）'};
  let known=matches[0];
  if(!known){
    if(typeof api?.getTreeDetailByNode!=='function')return {...base,status:'error',message:'23魔方页面查询客户端尚未就绪，请等待页面加载或刷新后重试。'};
    const response=await api.getTreeDetailByNode(query,false);
    if(response?.code!==0)return {...base,status:'error',message:'23魔方未能解析该SNP的所属节点，请从对应支系的SNP按钮进入查询；这不代表该SNP不存在。'};
    const id=marker(response.data?.id);if(!id)return {...base,status:'empty',message:'23魔方未返回可识别的所属支系。'};
    known={id,rsids:Array.isArray(response.data?.rsids)?response.data.rsids:[]};
  }
  const node=known.id;let values=known.rsids;
  let rows=mofangPositions(values,query);
  if(!rows.length&&(!(report||context.reportTree)||!(contains(values,query)||snp(node)===query))&&typeof api?.getTreeNodeById==='function'){const detail=await api.getTreeNodeById(node);if(detail?.code===0&&(!detail.data?.id||marker(detail.data.id)===node)&&Array.isArray(detail.data?.rsids))values=detail.data.rsids;rows=mofangPositions(values,query);}
  const exact=contains(values,query)||snp(node)===query;
  if(!exact)return {...base,status:'empty',message:'返回的节点尚未明确包含该SNP，未采用相似名称结果。'};
  if(!rows.length&&context.reportTree)rows=mofangPositions(await context.reportTree(node),query);
  if(!rows.length&&report){
    const detail=await report(node);
    if(detail?.code===0&&(!detail.data?.haplogroup||marker(detail.data.haplogroup)===node)){
      const values=[...(Array.isArray(detail.data?.nodeRsIds)?detail.data.nodeRsIds:[]),...(Array.isArray(detail.data?.matchList)?detail.data.matchList:[])];
      rows=mofangPositions(values,query);
    }
  }
  return {...base,url:`https://www.23mofang.com/ancestry/ytree/${encodeURIComponent(node)}`,status:rows.length?'ok':'unsupported',rows,message:rows.length?`23魔方 · ${query} · 所属支系 ${node} · hg19`:`已确认所属支系 ${node}，但当前页面或检测报告未提供 ${query} 的坐标，或不支持此次位置查询。可切换到TheYtree查询；这不代表该SNP不存在。`};
}
export function requestMofangSnp(query:string,owner?:string):Promise<SnpResult>{
  const request=crypto.randomUUID(),route=location.href;
  return new Promise((resolve,reject)=>{const listener=(e:MessageEvent)=>{const d=e.data;if(e.source!==window||e.origin!==location.origin||d?.channel!==MOFANG_SNP_CHANNEL||d.type!=='result'||d.request!==request||d.query!==query||d.route!==route||location.href!==route)return;clearTimeout(timer);window.removeEventListener('message',listener);if(d.error)reject(Error(d.error));else resolve(d.result);};const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error('23魔方查询超时，请稍后重试'));},65000);window.addEventListener('message',listener);window.postMessage({channel:MOFANG_SNP_CHANNEL,type:'query',query,request,owner:marker(owner)||undefined},location.origin);});
}
