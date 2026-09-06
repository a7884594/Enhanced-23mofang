import {marker,paperUrl} from './model';
export interface VerifiedAlias {target:string;evidenceUrl:string;verified:true;group?:string;verifiedAt?:string}
// Exact node names only. Confirmed in the normal logged-in TheYtree SNP dialogs.
// In particular, 23mofang's A navigation points to A-P305: never map that to A.
export const VERIFIED_ALIASES:Record<string,VerifiedAlias>=Object.fromEntries([
  ['O-MF190013','O-FT130664','TYT278842/MF190013; Y86790'],
  ['B-M8720','B','M8720/V2144'],
  ['C-M130','C','RPS4Y711/PAGES00051/M130/RPS4Y/Page51'],
  ['F-M89','F','M89/PF2746'],
  ['I-M170','I','M170/PF3715'],
  ['J-M304','J','PAGES00016/M304/PF4609/Page16'],
  ['K-L469','K','L469/PF5499/M2689'],
  ['N-M231','N','Page91/M231/PAGES00091'],
  ['O-F175','O','F175']
].map(([name,target,group])=>[name,{target,group,evidenceUrl:`https://www.theytree.com/tree/${target}`,verified:true,verifiedAt:'2026-09-06'}]));
export function resolveTarget(name:string,aliases=VERIFIED_ALIASES){const a=aliases[name];return a?.verified===true&&marker(a.target)&&paperUrl(a.evidenceUrl)?{target:marker(a.target)!,mapping:`已核实别名对应（依据：${a.evidenceUrl}），挂载关系以TheYtree为准`}:{target:name,mapping:'同名标记对应，挂载关系以TheYtree为准'};}
