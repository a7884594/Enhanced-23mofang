import {marker,TY,type TreePage} from './model';
export function snp(v:unknown):string|null {
  if(typeof v!=='string')return null;
  const s=v.trim().toUpperCase().replace(/^[A-Z]+-/, '').split('#')[0];
  return /^[A-Z][A-Z0-9._]*\d[A-Z0-9._]*$/.test(s)?s:null;
}
export function snps(v:unknown):string[]{return Array.isArray(v)?[...new Set(v.map(snp).filter((s):s is string=>!!s))].sort():[];}
export const snpUrl=(s:string)=>`${TY}/api/ysnp/theytree/?snp=${encodeURIComponent(s)}`;
export interface SnpCheck {snp:string;target:string;issue:string;url:string;note?:string;candidate?:import('./equivalent').EquivalentCandidate;evidence?:import('./equivalent').EquivalentEvidence}
// Search may return the default world tree for unknown SNPs. Never accept its
// first row or an ancestor as an alias. Require a unique subtree root whose
// primary SNP is explicitly present in the clicked node's LOCAL rsids list.
export function checkSnp(page:TreePage,value:string,local:string[]):SnpCheck {
  const ids=new Set(page.branches.map(b=>b.id));
  const roots=page.branches.filter(b=>!ids.has(b.parent)&&!b.tentative);
  const root=roots.length===1?roots[0]:null;
  const target=root&&marker(root.marker)&&local.includes(snp(root.marker)||'')?root.marker:'';
  const defaultTree=page.branches.some(b=>b.marker==='ROOT');
  return {snp:value,target,issue:!target&&!defaultTree?'需登录TheYtree核对该候选节点的等价SNP列表':'',url:snpUrl(value),candidate:root&&!defaultTree?{id:root.id,marker:root.marker,count:root.equivalentCount}:undefined};
}
export function mappingTarget(checks:SnpCheck[]):string {
  const targets=[...new Set(checks.map(c=>c.target).filter(Boolean))];
  return targets.length===1?targets[0]:'';
}
