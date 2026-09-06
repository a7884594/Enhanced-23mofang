import {marker,paperUrl} from './model';
export interface VerifiedAlias {target:string;evidenceUrl:string;verified:true}
// Deliberately empty until an equivalence is documented. No prefix stripping,
// fuzzy matching, or automatic substitution by a common ancestor.
export const VERIFIED_ALIASES:Record<string,VerifiedAlias>={};
export function resolveTarget(name:string,aliases=VERIFIED_ALIASES){const a=aliases[name];return a?.verified===true&&marker(a.target)&&paperUrl(a.evidenceUrl)?{target:marker(a.target)!,mapping:`已核实别名对应（依据：${a.evidenceUrl}），挂载关系以TheYtree为准`}:{target:name,mapping:'同名标记对应，挂载关系以TheYtree为准'};}
