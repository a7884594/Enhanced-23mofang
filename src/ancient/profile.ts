declare const __RESEARCH__: boolean;
export const RESEARCH=typeof __RESEARCH__!=='undefined'&&__RESEARCH__;
export const SAMPLE_KIND:'ancient'|'scientific'=RESEARCH?'scientific':'ancient';
export const STYPE=RESEARCH?1:2;
/** Shared engine and UI, isolated channels/storage/DOM for each sample category. */
export function profileText(text:string):string {
  if(!RESEARCH)return text;
  if(text==='古')return '研';
  return text.replaceAll('mofang-ancient','mofang-research').replaceAll('anc.','res.')
    .replaceAll('ANCIENT DNA','RESEARCH SAMPLES').replaceAll('古DNA','科研')
    .replaceAll('古样本','科研样本').replaceAll('古人','科研样本');
}
