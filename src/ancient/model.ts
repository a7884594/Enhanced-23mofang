import {SAMPLE_KIND,STYPE} from './profile';
import {profileText} from './profile';
export const A_CHANNEL=profileText('mofang-ancient/v1');
export const TY='https://www.theytree.com';
export const TTL=7*24*60*60*1000;
export type Scope='direct'|'downstream';
export interface Branch {equivalentCount?:number;id:string;parent:string;marker:string;pending:boolean;tentative:boolean}
export interface AncientSample {au:string;name:string;marker:string;parentId:string;path:string[];tentative:boolean;type:'ancient'|'scientific'|'unknown';typeEvidence:string;url:string;country:string;place:string;culture:string;period:string;coverage:number|null;depth:number|null;paper:string;paperUrl:string;detail:boolean;issue:string}
export interface TreePage {branches:Branch[];samples:AncientSample[];unclassified:AncientSample[];excluded:number;valid:boolean;reason:string}
export interface QueryResult {projectedVersion?:number;cachedChildren?:number;cacheOrigin?:{marker:string;at:number};mappingVerifiedAt?:number;mappingToken?:string;nodeSnps?:string[];snpChecks?:import("./snps").SnpCheck[];mappingReady?:boolean;id:string;marker:string;target:string;scope:Scope;status:'running'|'complete'|'partial'|'paused'|'sync'|'unmatched'|'error';mapping:string;createdAt:number;updatedAt:number;cached:boolean;forceRefresh?:boolean;syncToken?:string;complete:boolean;samples:AncientSample[];unknown:AncientSample[];branches:Branch[];checked:string[];queue:string[];details:string[];failures:{key:string;message:string}[];excluded:number;message:string}
export const safeText=(v:unknown,max=1200)=>typeof v==='string'?v.trim().slice(0,max):'';
export function marker(v:unknown):string|null {const s=safeText(v,100).toUpperCase();return /^(?:ROOT|[A-Z][A-Z0-9]*(?:-[A-Z0-9][A-Z0-9._-]*)?)$/.test(s)?s:null;}
export function treeMarker(path:string):string|null {const m=/^\/ancestry\/ytree\/([^/]+)\/?(?:branch\/?)?$/.exec(path);try{return m?marker(decodeURIComponent(m[1])):null;}catch{return null;}}
export function sourceMarker(path:string):string|null {const m=/^\/tree\/([^/]+)\/?$/.exec(path);try{return m?marker(decodeURIComponent(m[1])):null;}catch{return null;}}
export function sourceUrl(value:unknown):string {try{const u=new URL(String(value),TY);return u.origin===TY&&!u.username&&!u.password&&/^\/sample\/[a-f\d]{16,64}\.html$/.test(u.pathname)?u.href:'';}catch{return '';}}
export function paperUrl(value:unknown):string {try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export const treeUrl=(m:string)=>`${TY}/tree/${encodeURIComponent(m)}`;
export const queryUrl=(m:string)=>`${TY}/api/ysnp/theytree/?haplogroup=${encodeURIComponent(m)}`;
export const nodeUrl=(id:string)=>`${TY}/api/ysnp/theytree/node/?hid=${encodeURIComponent(id)}`;
export function normalizeTree(raw:any):TreePage {
  const rows=raw?.data?.ytree;
  if(raw?.code!==1||!Array.isArray(rows))return {branches:[],samples:[],unclassified:[],excluded:0,valid:false,reason:safeText(raw?.msg)||'源站未返回可识别的树数据'};
  if(rows.length>150000)throw Error('树数据过大，请选择更小的支系');
  const counts=new Map<string,number>();for(const r of rows)if(r&&r.parent!=null)counts.set(String(r.parent),(counts.get(String(r.parent))||0)+1);
  const branches:Branch[]=[],samples:AncientSample[]=[],unclassified:AncientSample[]=[];let excluded=0;
  for(const r of rows){
    if(!r||typeof r!=='object')continue;
    if(r.sid==null){
      const id=String(r.hid??'');if(!/^\d+(?:LOW)?$/.test(id))continue;
      const name=safeText(r.name,100),tentative=name.endsWith('?')||id.endsWith('LOW');
      if(!marker(name.replace(/\?$/,'')))continue;
      const children=counts.get(id)||0;
      branches.push({equivalentCount:Number.isInteger(r.equivalent_mutations?.equivalent_count)&&r.equivalent_mutations.equivalent_count>=0?r.equivalent_mutations.equivalent_count:undefined,id,parent:String(r.parent??''),marker:name.toUpperCase(),tentative,pending:!!r.isParent&&(!children||Number(r.low_count||0)>children)});
      continue;
    }
    // stype=2 selects Ancient; stype=1 selects Scientific, matching the site's
    // user_anc/user_sci renderers. AU alone never establishes a category.
    if(r.stype!=null&&[0,1,2,3,4,5].includes(Number(r.stype))&&Number(r.stype)!==STYPE){excluded++;continue;}
    if(!/^\d+$/.test(String(r.sid)))continue;
    const ancient=Number(r.stype)===STYPE;
    const sample:AncientSample={au:`AU${r.sid}`,name:ancient?safeText(r.name):'',marker:safeText(r.haplogroup,100).toUpperCase(),parentId:String(r.parent??''),path:[],tentative:false,type:ancient?SAMPLE_KIND:'unknown',typeEvidence:ancient?`TheYtree公开树 stype=${STYPE}`:'类型尚未确认',url:sourceUrl(`/sample/${r.sid_encrypted}.html`),country:ancient?safeText(r.country,150):'',place:'',culture:'',period:ancient?safeText(r.period,250):'',coverage:ancient&&typeof r.coverage==='number'&&r.coverage>=0&&r.coverage<=1?r.coverage:null,depth:ancient&&typeof r.average_depth==='number'&&r.average_depth>=0?r.average_depth:null,paper:'',paperUrl:'',detail:false,issue:ancient?'':'待核对样本类型'};
    (ancient?samples:unclassified).push(sample);
  }
  return {branches,samples,unclassified,excluded,valid:true,reason:''};
}
export function pathToRoot(parent:string,root:string,branches:Branch[]):Branch[]|null {
  const index=new Map(branches.map(b=>[b.id,b]));const path:Branch[]=[];const seen=new Set<string>();
  let id=parent;while(id&&path.length<1000){if(seen.has(id))return null;seen.add(id);const b=index.get(id);if(!b)return null;path.unshift(b);if(id===root)return path;id=b.parent;}return null;
}
export function selectSamples(page:TreePage,root:Branch,scope:Scope):{samples:AncientSample[];unknown:AncientSample[]} {
  const samples:AncientSample[]=[],unknown:AncientSample[]=[];
  for(const s of [...page.samples,...page.unclassified]){
    const path=pathToRoot(s.parentId,root.id,page.branches);if(!path)continue;
    const pending=path.some(b=>b.tentative)||s.marker.endsWith('?');
    if(scope==='direct'&&s.parentId!==root.id){if(!(pending&&path.length===2))continue;}
    const sample={...s,path:path.map(b=>b.marker),tentative:pending};
    if(sample.type==='unknown'||pending){sample.issue=sample.issue||(pending?'源站暂定归类（?），不计入已确认数量':'类型尚未确认');unknown.push(sample);}else samples.push(sample);
  }
  return {samples:dedupe(samples),unknown:dedupe(unknown)};
}
export function dedupe(rows:AncientSample[]):AncientSample[]{const m=new Map<string,AncientSample>();for(const r of rows){const old=m.get(r.au);if(!old)m.set(r.au,r);else if(old.parentId!==r.parentId){m.set(r.au,{...old,tentative:true,issue:'同一AU编号出现多个挂载位置，待核对'});}else if(r.detail)m.set(r.au,r);}return [...m.values()];}
export function dated(period:string):{basis:'BP'|'cal BP';midpoint:number}|null {
  const s=period.replace(/,/g,'').replace(/[–—至]/g,'-');
  const m=/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(cal\s*BP|BP)\b/i.exec(s);
  return m?{basis:/cal/i.test(m[3])?'cal BP':'BP',midpoint:(Number(m[1])+Number(m[2]||m[1]))/2}:null;
}
export function fresh(result:QueryResult,now=Date.now()){return result.complete&&now-result.updatedAt<TTL;}
export function summary(result:QueryResult){return {marker:result.marker,scope:result.scope,count:result.samples.filter(s=>!s.tentative).length,complete:result.complete,updatedAt:result.updatedAt};}
