import type {IO} from '../ancient/engine';
import {yfullSnpIndex} from './adapters';
import {treeLink} from './model';

const TTL=7*86400000;
type Resolution={target:string;snp:string}|{message:string};

/** Only an exact, unannotated primary SNP in one same-lineage node can resolve an alias.
 * Shared SNPs in ancestors or children are not a vote for node equivalence.
 */
export async function findYfullAlias(io:IO,name:string,refresh:boolean,signal:AbortSignal):Promise<Resolution>{
  const parts=name.match(/^([B-T])-([A-Z][A-Z0-9._]*\d[A-Z0-9._]*)$/);
  if(!parts)return {message:'YFull未找到同名节点；当前父系尚不支持自动SNP索引核对。'};
  const [,family,snp]=parts,key=`samples.v2.yfull-index.${family}`;
  const cached=await io.get(key);
  let entries:ReturnType<typeof yfullSnpIndex>;
  if(!refresh&&cached?.schema===1&&cached.family===family&&Array.isArray(cached.entries)&&cached.updatedAt<=io.now()&&io.now()-cached.updatedAt<TTL){
    entries=cached.entries;
  }else{
    const url=treeLink('yfull',family),r=await io.request(url,signal);
    if(signal.aborted)throw Error('已取消');
    if(r.status!==200)throw Error(`YFull异名核对暂时失败（HTTP ${r.status}），不能认定没有节点或样本`);
    if(new URL(r.url).origin!==new URL(url).origin||r.body.length>8_000_000)throw Error('YFull SNP索引响应范围或大小异常');
    entries=yfullSnpIndex(r.body);
    if(!entries.some(n=>n.name===family&&!n.parent))throw Error('YFull未返回预期的大支系根节点，未采用索引');
    const index={schema:1,family,entries,updatedAt:io.now()};
    if(new TextEncoder().encode(JSON.stringify(index)).length>3_000_000)throw Error('YFull SNP索引过大，未继续自动核对');
    if(signal.aborted)throw Error('已取消');await io.set(key,index);
  }
  if(signal.aborted)throw Error('已取消');
  const candidates=entries.filter(n=>n.name.startsWith(family+'-')&&!n.name.endsWith('*')&&n.snps.includes(snp));
  if(candidates.length>1)return {message:`YFull中${snp}出现在多个节点，存在歧义，未自动套用样本。`};
  if(!candidates.length)return {message:`YFull未找到同名节点，${family}支系索引也未找到明确包含${snp}的节点；不代表没有样本，可刷新后重新核对。`};
  return {target:candidates[0].name,snp};
}
