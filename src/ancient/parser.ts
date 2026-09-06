import {parseHTML} from 'linkedom';
import {TY,safeText,sourceUrl,paperUrl,marker,type AncientSample,type TreePage} from './model';
function field(doc:Document,key:string):Element|null {const label=doc.querySelector(`label[for="input-${key}"]`);return label?.parentElement?.querySelector(':scope > div')||null;}
export function parseDetail(html:string,url:string):{sample:Partial<AncientSample>|null;type:'ancient'|'modern'|'unknown'}{
  if(!sourceUrl(url)||html.length>4_000_000)return {sample:null,type:'unknown'};
  const {document}=parseHTML(html);const doc=document as unknown as Document;
  const kind=safeText(field(doc,'stype')?.textContent).toLowerCase();
  if(!kind)return {sample:null,type:'unknown'};
  if(!['古人','ancient'].includes(kind))return {sample:null,type:['科研','个人','会员','scientific','personal','modern','现代','现代人','个人样本','科研样本'].includes(kind)?'modern':'unknown'};
  const au=safeText(field(doc,'sid')?.textContent,30).match(/\bAU\d+\b/)?.[0];
  if(!au)return {sample:null,type:'unknown'};
  const read=(key:string)=>safeText(field(doc,key)?.textContent);
  const quality=read('quality');const cov=quality.match(/(?:覆盖度?|Coverage\s*:?)[\s]*(\d+(?:\.\d+)?)\s*[%％]/i);const depth=quality.match(/(?:平均深度|Average\s+Depth\s*:?)\s*(\d+(?:\.\d+)?)/i);
  const source=field(doc,'data_source');const href=source?.querySelector('a[href]')?.getAttribute('href');
  const hap=read('haplogroup');
  return {type:'ancient',sample:{au,name:read('name'),type:'ancient',typeEvidence:`详情页样本类型：${kind}`,marker:marker(hap)||safeText(hap,100),country:read('country'),place:read('nativeplace'),culture:read('culture'),period:read('period'),coverage:cov?Number(cov[1])/100:null,depth:depth?Number(depth[1]):null,paper:safeText(source?.textContent),paperUrl:href?paperUrl(new URL(href,TY).href):'',url,detail:true,issue:''}};
}
/** Normal-page fallback reads rendered category classes and exact DOM hierarchy.
 * Modern sample rows are discarded before any text is copied.
 */
export function parseTreeDOM(doc:Document):TreePage {
  const branches:TreePage['branches']=[],samples:AncientSample[]=[],unclassified:AncientSample[]=[];
  const nodes=[...doc.querySelectorAll('li[treenode]')];let excluded=0;
  for(const li of nodes){
    const a=li.querySelector(':scope > a[treenode_a]');if(!a)continue;
    const parent=li.parentElement?.closest('li[treenode]')?.id||'';
    const name=a.querySelector('.chrom,.chrom_snp')?.textContent?.trim();
    if(name){const sw=li.querySelector(':scope > [treenode_switch]');branches.push({id:li.id,parent,marker:name.toUpperCase(),tentative:name.endsWith('?'),pending:!!sw?.className.includes('_close')&&!li.querySelector(':scope > ul > li')});continue;}
    const ancient=a.querySelector('.user_anc,.user_anc_csv');const au=a.querySelector('.user_sid')?.textContent?.trim();
    if(!ancient){excluded++;continue;}if(!au||!/^AU\d+$/.test(au))continue;
    const own=[...li.children].filter(c=>c.tagName!=='UL').map(c=>c.textContent||'').join(' ');
    const cov=own.match(/COV:\s*(\d+(?:\.\d+)?)%/);
    samples.push({au,name:safeText(ancient.textContent),parentId:parent,marker:'',path:[],tentative:false,type:'ancient',typeEvidence:'源站古人类别 user_anc/user_anc_csv',url:sourceUrl(a.getAttribute('href')||''),country:safeText(li.querySelector(`[id^="diyBtnB1_"]`)?.textContent,150),place:'',culture:'',period:safeText(li.querySelector('[id^="diyBtnS10_"]')?.textContent,250),coverage:cov?Number(cov[1])/100:null,depth:null,paper:'',paperUrl:'',detail:false,issue:''});
  }
  const byId=new Map(branches.map(b=>[b.id,b]));for(const s of samples)s.marker=byId.get(s.parentId)?.marker||'';
  return {branches,samples,unclassified,excluded,valid:branches.length>0,reason:branches.length?'':'树尚未加载'};
}
