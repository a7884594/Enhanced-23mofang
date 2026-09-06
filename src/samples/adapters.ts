import {parseHTML} from 'linkedom';
import {marker,sourceUrl} from '../ancient/model';
import {type Node,type Sample,rootName,snpTokens,text,treeLink} from './model';
const node=(name:string,parent=''):Node=>({name,parent,snps:[],pending:false,samples:[],groups:[]});
const sample=(id:string,url:string):Sample=>({id,url,kind:'unknown',name:'',region:'',period:'',culture:'',evidence:'类型未明确',uncertain:false});

/** Parse only visible tree fields; never execute scripts or infer personal status from an ID prefix. */
export function yfull(html:string):Node[]{
  const d=parseHTML(html).document,tree=d.querySelector('ul#tree');if(!tree)throw Error('YFull树内容缺失，可能需要打开原页或稍后重试');
  const nodes:Node[]=[];
  for(const li of tree.querySelectorAll('li[id]')){
    const a=li.querySelector(':scope > a');const name=text(a?.textContent,100);if(!rootName(name))continue;
    const parent=li.parentElement?.closest('li[id]')?.querySelector(':scope > a')?.textContent||'';
    const n=node(name,parent);n.snps=snpTokens([li.querySelector(':scope > .yf-snpforhg')?.textContent,li.querySelector(':scope > .yf-plus-snps')?.getAttribute('title')].join(' '));
    const lists=li.querySelectorAll(':scope > ul');
    for(const list of lists)for(const row of list.children){
      const label=row.querySelector(':scope > .yf-s-name');const id=text(label?.textContent,100).replace(/^id:/,'');if(!label||!id)continue;
      const s=sample(id,treeLink('yfull',name));
      const ancient=label.getAttribute('title')==='Ancient DNA';s.kind=ancient?'ancient':'modern';s.evidence=ancient?'YFull明确标记Ancient DNA':'公开现代样本，个人/科研未细分';
      s.region=text(row.querySelector(':scope > .yf-geo')?.getAttribute('title')||row.querySelector(':scope > .yf-geo')?.textContent);
      s.period=text(row.querySelector(':scope > .yf-a-age')?.getAttribute('title')).replace(/^Ancient DNA\s*\|\s*/,'');
      const note=text(row.querySelector(':scope > .yf-sinf')?.getAttribute('title'));if(note){s.evidence+='；源站注释：'+note;s.uncertain=/^[=<>?]|\?/.test(note);}
      n.samples.push(s);
    }
    n.pending=!!li.querySelector(':scope > a[href]')&&!n.samples.length&&!li.querySelector(':scope > ul > li');nodes.push(n);
  }
  return nodes;
}

/** The public classic tree has anonymous modern rows without stable IDs: aggregate, never invent IDs. */
export function ftdna(raw:any):Node[]{
  if(!raw?.node||!marker(raw.node.name))throw Error('FTDNA未返回可识别的公开树');
  const nodes:Node[]=[];const seen=new Set<string>();
  function walk(r:any,parent:string){
    const name=marker(r?.name);if(!name||seen.has(name)||nodes.length>=15000)throw Error('FTDNA树结构重复、无效或过大');seen.add(name);
    const n=node(name,parent);n.snps=snpTokens([...(Array.isArray(r.variants)?r.variants:[]),...(Array.isArray(r.synonyms)?r.synonyms:[])].join(' '));
    for(const a of Array.isArray(r.ancient)?r.ancient:[]){
      const id=text(a.code,100);if(!id)continue;const s=sample(id,treeLink('ftdna',name));s.kind='ancient';s.name=text(a.name);s.region=[text(a.site),text(a.geography),text(a.country)].filter(Boolean).join(' · ');s.culture=text(a.culture);s.period=text(a.time_period);s.evidence='FTDNA公开ancient记录';s.uncertain=a.uncertain_placement===true||a.preview===true;
      if(s.uncertain)s.evidence+='；源站标记挂载不确定或预览';
      if(Array.isArray(a.studies))s.evidence+='；'+a.studies.map((x:unknown)=>text(x)).filter(Boolean).join('；');n.samples.push(s);
    }
    const regions=new Map<string,number>();for(const m of Array.isArray(r.modern)?r.modern:[]){const place=text(m.country_name)||'地区未公开';regions.set(place,(regions.get(place)||0)+1);}
    n.groups=[...regions].map(([region,count])=>({region,count}));
    const children=Array.isArray(r.children)?r.children:[];n.pending=typeof r.subclades==='number'&&r.subclades>0&&!children.length;nodes.push(n);for(const c of children)walk(c,name);
  }walk(raw.node,'');
  if(typeof raw.branch_count==='number'&&nodes.length<raw.branch_count)nodes[0].pending=true;
  return nodes;
}

/** Personal names, free text, coverage and contact fields are discarded at the adapter boundary. */
export function theytree(raw:any):Node[]{
  const rows=raw?.data?.ytree;if(raw?.code!==1||!Array.isArray(rows))throw Error('TheYtree未返回公开树，可能需要登录或源站同步');
  const nodes:Node[]=[],ids=new Map<string,Node>();if(rows.length>150000)throw Error('支系过大，请选择更小节点');
  for(const r of rows){if(r.hid==null||r.sid!=null)continue;const name=marker(r.name);if(!name)continue;const n=node(name,String(r.parent??''));n.sourceId=/^\d+$/.test(String(r.hid))?String(r.hid):undefined;ids.set(String(r.hid),n);nodes.push(n);n.pending=Number(r.isParent)===1;}
  for(const n of nodes)n.parent=ids.get(n.parent)?.name||'';
  // Re-evaluate after all parent IDs have been resolved.
  const parents=new Set(nodes.map(n=>n.parent));for(const n of nodes)if(parents.has(n.name))n.pending=false;
  for(const r of rows){if(r.sid==null||!/^\d+$/.test(String(r.sid)))continue;const n=ids.get(String(r.parent));if(!n)continue;
    if(r.stype==null||!['0','1','2'].includes(String(r.stype)))continue;
    const kind=String(r.stype)==='0'?'personal':String(r.stype)==='1'?'scientific':'ancient';
    const s=sample('AU'+r.sid,sourceUrl(`/sample/${r.sid_encrypted}.html`)||treeLink('theytree',n.name));s.kind=kind;s.evidence=`TheYtree明确stype=${r.stype}`;s.region=text(r.country);if(kind!=='personal'){s.name=text(r.name);s.period=text(r.period);}n.samples.push(s);
  }
  return nodes;
}
