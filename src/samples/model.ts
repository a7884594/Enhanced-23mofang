import {marker} from '../ancient/model';
export type Provider='theytree'|'yfull'|'ftdna';
export type Kind='ancient'|'scientific'|'personal'|'modern'|'unknown';
export interface Sample {id:string;kind:Kind;name:string;region:string;period:string;culture:string;evidence:string;uncertain:boolean;url:string}
export interface Node {name:string;parent:string;sourceId?:string;snps:string[];pending:boolean;samples:Sample[];groups:{region:string;count:number}[]}
export interface Result {provider:Provider;marker:string;target:string;url:string;mapping:string;nodes:Node[];updatedAt:number;complete:boolean;status:'ready'|'unmatched'|'error';message:string;cached?:boolean;modernAvailable?:boolean;ancientAvailable?:boolean}
export const providers:Provider[]=['theytree','yfull','ftdna'];
export const labels:Record<Provider,string>={theytree:'TheYtree',yfull:'YFull',ftdna:'FTDNA'};
export const text=(v:unknown,max=250)=>typeof v==='string'?v.trim().slice(0,max):'';
export const treeLink=(p:Provider,m:string)=>p==='theytree'?`https://www.theytree.com/tree/${encodeURIComponent(m)}`:p==='yfull'?`https://www.yfull.com/tree/${encodeURIComponent(m)}/`:`https://discover.familytreedna.com/y-dna/${encodeURIComponent(m)}/classic`;
export function rootName(v:unknown){return marker(text(v).replace(/\*$/,''));}
export function snpTokens(v:string):string[]{return [...new Set(v.toUpperCase().split(/[\s*/,+]+/).filter(x=>/^[A-Z][A-Z0-9._-]*\d[A-Z0-9._-]*$/.test(x)))];}
export function select(result:Result,downstream:boolean){
  const index=new Map(result.nodes.map(n=>[n.name,n]));
  const included=result.nodes.filter(n=>{
    if(rootName(n.name)===result.target)return true;if(!downstream)return false;
    const seen=new Set<string>();let p=n.parent;
    while(p&&!seen.has(p)){if(p===result.target)return true;seen.add(p);p=index.get(p)?.parent||'';}return false;
  });
  const seen=new Set<string>();const rows=included.flatMap(n=>n.samples.flatMap(s=>{const key=JSON.stringify([n.name,s.id]);if(seen.has(key))return [];seen.add(key);return [{...s,node:n.name}];}));
  return {rows,groups:included.flatMap(n=>n.groups.map(g=>({...g,node:n.name}))),complete:result.status==='ready'&&included.every(n=>!n.pending)};
}
