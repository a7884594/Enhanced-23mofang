import {SAMPLE_KIND} from './profile';
import {TTL,type QueryResult} from './model';
export interface BadgeCount {count:number;complete:boolean;updatedAt:number}
export function knownDirectCount(j:QueryResult,now=Date.now()):BadgeCount|null {
  if(!j||j.status==='unmatched'||(j.nodeSnps&&!j.mappingReady)||now-j.updatedAt>=TTL)return null;
  const root=j.branches?.find(b=>b.marker===j.target&&!b.tentative);
  const rows=(j.samples||[]).filter(s=>s.type===SAMPLE_KIND&&!s.tentative&&(j.scope==='direct'||!!root&&s.parentId===root.id));
  const count=new Set(rows.map(s=>s.au)).size;
  if(!count&&!j.complete)return null;
  return {count,complete:j.complete,updatedAt:j.updatedAt};
}
