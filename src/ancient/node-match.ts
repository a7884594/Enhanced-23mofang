import {marker,type QueryResult} from './model';
import {snps,mappingTarget} from './snps';
import type {IO} from './engine';
export const matchKey=(name:string)=>`mofang.node-match.v1.${name}`;
export type NodeMatch=Pick<QueryResult,'marker'|'target'|'mapping'|'nodeSnps'|'snpChecks'> & {verifiedAt:number};
export function confirmedMatch(j:QueryResult):NodeMatch|null {
  if(!j?.mappingReady||!marker(j.marker)||!marker(j.target)||!j.nodeSnps?.length||!j.snpChecks?.length)return null;
  const values=snps(j.nodeSnps);
  if(!values.length||!values.every(s=>j.snpChecks!.some(c=>c.snp===s))||j.snpChecks.some(c=>c.issue)||mappingTarget(j.snpChecks)!==j.target)return null;
  return {marker:j.marker,target:j.target,mapping:j.mapping,nodeSnps:values,snpChecks:j.snpChecks,verifiedAt:j.mappingVerifiedAt??j.updatedAt};
}
/** Node identity is independent of sample category, sample completeness and scope. */
export async function loadMatch(io:IO,name:string):Promise<NodeMatch|null>{
  const saved=await io.get(matchKey(name));
  if(saved&&confirmedMatch({...saved,mappingReady:true,updatedAt:saved.verifiedAt} as QueryResult))return saved;
  // Reuse previously verified local checkpoints, including a still-running or
  // paused detail query. Do not migrate samples or task ownership between modes.
  const matches:NodeMatch[]=[];
  for(const prefix of ['anc','res'])for(const scope of ['direct','downstream']){
    const cached=await io.get(`${prefix}.cache.fast4.${name}.${scope}`);
    const id=await io.get(`${prefix}.pending.fast4.${name}.${scope}`);
    for(const job of [cached,id?await io.get(`${prefix}.job.${id}`):null]){
      const value=confirmedMatch(job);if(value&&value.marker===name)matches.push(value);
    }
  }
  if(!matches.length||new Set(matches.map(m=>m.target)).size!==1)return null;
  const value=matches.sort((a,b)=>b.verifiedAt-a.verifiedAt)[0];await io.set(matchKey(name),value);return value;
}
