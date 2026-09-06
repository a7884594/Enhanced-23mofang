import {snp} from './snps';import {marker} from './model';import type {SnpResult} from './snp-result';
export const MOFANG_SNP_CHANNEL='mofang-snp-lookup/v1';
export function mofangPositions(values:unknown,query:string):SnpResult['rows']{
  if(!Array.isArray(values))return [];const rows:SnpResult['rows']=[];
  for(const raw of values.slice(0,5000)){
    if(typeof raw!=='string'||raw.length>500)continue;
    const name=raw.split('#')[0].split('%')[0].trim().toUpperCase();if(name!==query)continue;
    const location=raw.split('%')[1];const m=location?.match(/^(\d+):([ACGT]+|[-]):?->([ACGT]+|[-])$/i);
    if(m)rows.push({name,position:'hg19:'+m[1],mutation:m[2].toUpperCase()+'→'+m[3].toUpperCase(),time:''});
  }return rows.filter((r,i)=>rows.findIndex(v=>v.name===r.name&&v.position===r.position&&v.mutation===r.mutation)===i);
}
export async function lookupMofang(value:unknown,api:any,local:unknown[]=[]):Promise<SnpResult>{
  const query=snp(value);if(!query)throw Error('请输入有效SNP名称');
  const base:SnpResult={query,url:'https://www.23mofang.com/report/gene-origin/my-origin',status:'empty',rows:[],message:''};
  const loaded=mofangPositions(local,query);if(loaded.length)return {...base,status:'ok',rows:loaded,message:'23魔方 · 页面已加载的SNP位置（hg19）'};
  if(typeof api?.getTreeDetailByNode!=='function'||typeof api?.getTreeNodeById!=='function')return {...base,status:'error',message:'23魔方页面查询客户端尚未就绪，请等待页面加载或刷新后重试。'};
  const response=await api.getTreeDetailByNode(query,false);
  if(response?.code!==0)return {...base,status:'error',message:'23魔方未允许节点查询或未找到结果；请查看原页，不能认定该SNP不存在。'};
  const node=marker(response.data?.id);if(!node)return {...base,status:'empty',message:'23魔方未返回可识别的所属支系。'};
  let values=Array.isArray(response.data?.rsids)?response.data.rsids:[];
  let rows=mofangPositions(values,query);
  if(!rows.length){const detail=await api.getTreeNodeById(node);if(detail?.code===0&&(!detail.data?.id||marker(detail.data.id)===node)&&Array.isArray(detail.data?.rsids))values=detail.data.rsids;rows=mofangPositions(values,query);}
  const exact=values.some((s:unknown)=>typeof s==='string'&&s.split('#')[0].split('%')[0].toUpperCase()===query)||snp(node)===query;
  if(!exact)return {...base,status:'empty',message:'返回的节点尚未明确包含该SNP，未采用相似名称结果。'};
  return {...base,url:`https://www.23mofang.com/ancestry/ytree/${encodeURIComponent(node)}`,status:'ok',rows:rows.length?rows:[{name:query,position:'未提供坐标',mutation:'',time:''}],message:rows.length?`23魔方 · ${query} · 所属支系 ${node} · hg19`:`23魔方已确认 ${query} 属于 ${node}；公开节点仅提供名称，没有返回坐标。可在宗亲分化树打开支系详情后重试；未请求个人报告接口。`};
}
export function requestMofangSnp(query:string):Promise<SnpResult>{
  const request=crypto.randomUUID(),route=location.href;
  return new Promise((resolve,reject)=>{const listener=(e:MessageEvent)=>{const d=e.data;if(e.source!==window||e.origin!==location.origin||d?.channel!==MOFANG_SNP_CHANNEL||d.type!=='result'||d.request!==request||d.query!==query||d.route!==route||location.href!==route)return;clearTimeout(timer);window.removeEventListener('message',listener);if(d.error)reject(Error(d.error));else resolve(d.result);};const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error('23魔方查询超时，请稍后重试'));},65000);window.addEventListener('message',listener);window.postMessage({channel:MOFANG_SNP_CHANNEL,type:'query',query,request},location.origin);});
}
