import {marker,TY,type TreePage} from './model';
export function snp(v:unknown):string|null {
  if(typeof v!=='string')return null;
  const s=v.trim().toUpperCase().replace(/^[A-Z]+-/, '').split('#')[0];
  return /^[A-Z][A-Z0-9._]*\d[A-Z0-9._]*$/.test(s)?s:null;
}
export function snps(v:unknown):string[]{return Array.isArray(v)?[...new Set(v.map(snp).filter((s):s is string=>!!s))].sort():[];}
export const snpUrl=(s:string)=>`${TY}/api/ysnp/theytree/?snp=${encodeURIComponent(s)}`;
export interface SnpCheck {snp:string;target:string;issue:string;url:string;note?:string;descendants?:string[];candidate?:import('./equivalent').EquivalentCandidate;evidence?:import('./equivalent').EquivalentEvidence}
// A search's source candidate is reusable, but its match depends on LOCAL SNPs.
export function rebaseSearch(check:SnpCheck,local:string[]):SnpCheck {
  const candidate=check.candidate;const target=candidate&&local.includes(snp(candidate.marker)||'')?candidate.marker:'';
  return {snp:check.snp,url:snpUrl(check.snp),candidate,descendants:check.descendants||[],target,issue:candidate&&!target?'需登录TheYtree核对该候选节点的等价SNP列表':''};
}
export function needsSnpQuery(checks:SnpCheck[]|undefined,value:string):boolean {
  const check=checks?.find(c=>c.snp===value);
  const split=new Set(checks?.map(c=>c.target).filter(Boolean)).size>1;
  return !check||!!check.issue&&!check.candidate||!!(split&&check.candidate&&!check.descendants);
}
// Search may return the default world tree for unknown SNPs. Never accept its
// first row or an ancestor as an alias. Require a unique subtree root whose
// primary SNP is explicitly present in the clicked node's LOCAL rsids list.
export function checkSnp(page:TreePage,value:string,local:string[]):SnpCheck {
  const ids=new Set(page.branches.map(b=>b.id));
  const roots=page.branches.filter(b=>!ids.has(b.parent)&&!b.tentative);
  const root=roots.length===1?roots[0]:null;
  const target=root&&marker(root.marker)&&local.includes(snp(root.marker)||'')?root.marker:'';
  const defaultTree=page.branches.some(b=>b.marker==='ROOT');
  const descendants:string[]=[];
  if(root&&!defaultTree&&ids.size===page.branches.length){
    const children=new Map<string,typeof page.branches>();
    for(const b of page.branches){const list=children.get(b.parent)||[];list.push(b);children.set(b.parent,list);}
    const queue=[root.id],seen=new Set(queue);
    for(let i=0;i<queue.length;i++)for(const b of children.get(queue[i])||[]){
      if(b.tentative||seen.has(b.id))continue;seen.add(b.id);queue.push(b.id);descendants.push(b.marker);
    }
  }
  return {snp:value,target,issue:!target&&!defaultTree?'需登录TheYtree核对该候选节点的等价SNP列表':'',url:snpUrl(value),descendants,candidate:root&&!defaultTree?{id:root.id,marker:root.marker,count:root.equivalentCount}:undefined};
}
export function mappingTarget(checks:SnpCheck[]):string {
  const targets=[...new Set(checks.map(c=>c.target).filter(Boolean))];
  return targets.length===1?targets[0]:'';
}
