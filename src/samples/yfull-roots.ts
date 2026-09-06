/** Independently checked against YFull root SNP headers, 2026-09-06.
 * A is a 23mofang navigation label; its actual A-P305 node corresponds to A1.
 * Never infer other root mappings by stripping the marker prefix.
 */
export const YFULL_ROOT_ALIASES:Record<string,{target:string;snp:string}>=Object.fromEntries([
  ['A-P305','A1','P305'],['B-M8720','B','M8720'],['C-M130','C','M130'],
  ['F-M89','F','M89'],['I-M170','I','M170'],['J-M304','J','M304'],
  ['K-L469','K','L469'],['N-M231','N','M231'],['O-F175','O','F175'],
].map(([name,target,snp])=>[name,{target,snp}]));
