import {snp,snps,type SnpCheck} from './snps';
import {TY,marker} from './model';
export interface EquivalentCandidate {id:string;marker:string;count?:number}
export interface EquivalentEvidence {id:string;marker:string;groups:string[];snps:string[];overlap:string[];ignored?:string[];url:string;capturedAt:number;method:'authenticated-page'|'visible-dialog'}
export const equivalentUrl=(c:EquivalentCandidate)=>`${TY}/api/ysnp/theytree/getEquivalentMutationsDetail?hid=${encodeURIComponent(c.id)}&haplogroup=${encodeURIComponent(c.marker)}`;
export function equivalentEvidence(c:EquivalentCandidate,groups:unknown,local:string[],at:number,method:EquivalentEvidence['method']):EquivalentEvidence {
  if(!/^\d+$/.test(c.id)||!marker(c.marker)||!Array.isArray(groups)||groups.length>10000)throw Error('等价SNP列表格式错误');
  if(c.count!=null&&c.count!==groups.length)throw Error('等价SNP数量与树节点不一致，请刷新源站树后重试');
  // Each slash group is a set of names for the same mutation, not a SNP range.
  const tokens:string[]=[],ignored:string[]=[];
  for(const g of groups){
    if(typeof g!=='string'||g.length>1000)throw Error('等价SNP字段格式错误');
    for(const raw of g.split('/')){
      const part=raw.trim();
      if(part.includes('?')||part.includes('#'))throw Error('等价SNP名称尚不能确认');
      const value=snp(part);
      if(value){tokens.push(value);continue;}
      // Do not guess what (T) or another annotation means, or strip it to create
      // evidence. Preserve the exact token, and continue with plain SNP aliases.
      if(/^[A-Z][A-Z0-9._]*\d[A-Z0-9._]*\([A-Z0-9_-]+\)$/i.test(part)){ignored.push(part);continue;}
      throw Error('等价SNP名称尚不能确认');
    }
  }
  if(groups.length&&!tokens.length)throw Error('等价列表只有带注释的标记，尚无可用于核对的明确SNP');
  const values=snps([c.marker,...tokens]);
  return {id:c.id,marker:c.marker,groups:groups.slice(),snps:values,overlap:values.filter(s=>local.includes(s)),ignored,url:equivalentUrl(c),capturedAt:at,method};
}
export function applyEquivalent(checks:SnpCheck[],e:EquivalentEvidence):SnpCheck[]{
  return checks.map(c=>c.candidate?.id===e.id&&c.candidate.marker===e.marker?{...c,target:e.overlap.length?e.marker:'',issue:e.overlap.length?'':'两站节点SNP列表没有共同标记，未确认对应',evidence:e}:c);
}
export function disambiguate(checks:SnpCheck[],primary:string):SnpCheck[]{
  if(checks.some(c=>c.issue&&!c.evidence))return checks;
  const evidence=[...new Map(checks.filter(c=>c.evidence).map(c=>[c.evidence!.id,c.evidence!])).values()];
  const anchored=evidence.filter(e=>e.overlap.includes(snp(primary)||'')&&e.groups.filter(g=>g.split('/').some(v=>e.overlap.includes(snp(v)||''))).length>=2);
  if(anchored.length!==1)return checks;
  const winner=anchored[0];
  // A shared/reused name alone cannot compete with an explicit primary-name
  // alias corroborated by a second mutation. Never resolve disjoint support or
  // two candidates that both contain the current primary name.
  const other=checks.filter(c=>c.candidate&&c.candidate.id!==winner.id);
  if(other.some(c=>!c.evidence||c.evidence.overlap.length>=winner.overlap.length||c.evidence.overlap.some(s=>!winner.overlap.includes(s))))return checks;
  return checks.map(c=>c.candidate&&c.candidate.id!==winner.id?{...c,target:'',issue:'',note:`搜索歧义：${c.candidate.marker} 的共同SNP不足以建立本节点对应；已按主标记别名及第二个共同突变对应 ${winner.marker}，未合并该候选样本`}:c);
}
export function dialogGroups(doc:Document,c:EquivalentCandidate):string[]|null {
  const modal=doc.querySelector<HTMLElement>('#equivalentMutationsModal');
  if(!modal||modal.style.display==='none'||modal.querySelector('#equivalentMutationsModalTitle')?.textContent?.trim()!==c.marker)return null;
  const list=modal.querySelector('#equivalentMutationsList');if(!list)return null;
  return list.textContent?.split(/[,，]/).map(s=>s.trim()).filter(Boolean)||[];
}
