import {SAMPLE_KIND} from './profile';
import {TTL,type QueryResult} from './model';
import {graph} from './projection';
export interface BadgeCount {count:number;complete:boolean;updatedAt:number}
/** Direct counts only: never treat an unfinished subtree as a complete child cache. */
export function downstreamCounts(j:QueryResult,now=Date.now()):Map<string,BadgeCount>{
  const out=new Map<string,BadgeCount>();
  if(j.scope!=='downstream'||j.status==='unmatched'||j.nodeSnps&&!j.mappingReady||j.target!==j.marker&&!j.mappingReady||now-j.updatedAt>=TTL)return out;
  const branches=graph(j),names=new Map<string,number>(),rows=new Map<string,Set<string>>();
  for(const b of branches)names.set(b.marker,(names.get(b.marker)||0)+1);
  for(const s of j.samples||[]){if(s.type!==SAMPLE_KIND||s.tentative)continue;const ids=rows.get(s.parentId)||new Set<string>();ids.add(s.au);rows.set(s.parentId,ids);}
  for(const b of branches){if(names.get(b.marker)!==1)continue;const count=rows.get(b.id)?.size||0;
    if(count)out.set(b.marker,{count,complete:false,updatedAt:j.updatedAt});
  }
  return out;
}
export function knownDirectCount(j:QueryResult,now=Date.now()):BadgeCount|null {
  if(!j||j.status==='unmatched'||(j.nodeSnps&&!j.mappingReady)||now-j.updatedAt>=TTL)return null;
  const root=j.branches?.find(b=>b.marker===j.target&&!b.tentative);
  const rows=(j.samples||[]).filter(s=>s.type===SAMPLE_KIND&&!s.tentative&&(j.scope==='direct'||!!root&&s.parentId===root.id));
  const count=new Set(rows.map(s=>s.au)).size;
  if(!count&&!j.complete)return null;
  return {count,complete:j.complete,updatedAt:j.updatedAt};
}
