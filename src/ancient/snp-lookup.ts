import {snp} from './snps';
import {orderedSnpGroups} from './snp-order';
import type {SnpResult} from './snp-result';

/** Query only on explicit submit; names merely fill the input. Results are text-only. */
export function createSnpLookup(doc:Document,read?:(name:string)=>Promise<string[]>,query?:(value:string,provider?:'theytree'|'mofang',owner?:string)=>Promise<SnpResult>){
  const section=doc.createElement('details');section.className='snp-lookup';
  const summary=doc.createElement('summary');summary.textContent='SNP查询（TheYtree / 23魔方）';section.append(summary);
  const form=doc.createElement('form');form.action='https://www.theytree.com/user/ysnp/snps';form.method='get';form.target='_blank';form.setAttribute('rel','noopener noreferrer');
  const input=doc.createElement('input');input.name='snpname';input.required=true;input.maxLength=100;input.placeholder='例如 FGC7600';input.setAttribute('aria-label','要查询的SNP名称');
  const button=doc.createElement('button');button.type='submit';button.textContent='查询';
  const provider=doc.createElement('select');provider.setAttribute('aria-label','SNP查询来源');for(const [value,label]of [['theytree','TheYtree'],['mofang','23魔方']]){const option=doc.createElement('option');option.value=value;option.textContent=label;provider.append(option);}form.append(provider,input,button);
  for(const name of ['hg38','t2t2']){const field=doc.createElement('input');field.type='hidden';field.name=name;field.value='';form.append(field);}
  const status=doc.createElement('p');status.setAttribute('role','status');
  const list=doc.createElement('div');list.className='snp-options';list.setAttribute('aria-label','本节点全部SNP');
  const retry=doc.createElement('button');retry.type='button';retry.textContent='重新读取本节点SNP';retry.hidden=true;
  let owner='',generation=0,loaded=false,loading=false;
  let queryGeneration=0;const output=doc.createElement('div');output.className='snp-result';output.setAttribute('aria-live','polite');
  function clearResult(){queryGeneration++;output.replaceChildren();button.disabled=false;}
  function select(){for(const tag of list.querySelectorAll('button'))tag.setAttribute('aria-pressed',String(tag.textContent===snp(input.value)));}
  provider.onchange=()=>clearResult();
  input.oninput=()=>{input.setCustomValidity('');clearResult();select();};
  async function load(){
    if(!read||!owner||loaded||loading)return;
    const token=generation,name=owner;loading=true;retry.hidden=true;status.textContent=`正在读取 ${name} 的本节点SNP…`;
    try{
      const values=orderedSnpGroups(await read(name));if(token!==generation)return;
      if(!values.length)throw Error('页面尚未提供本节点SNP，请等待树加载后重新读取。');
      for(const group of values){const row=doc.createElement('span');row.className='snp-group';const aliases=group.split('/');
        aliases.forEach((value,index)=>{if(index)row.append(doc.createTextNode('/'));const tag=doc.createElement('button');tag.type='button';tag.textContent=value;tag.title='点击填入查询框';tag.onclick=()=>{input.value=value;input.setCustomValidity('');clearResult();select();};row.append(tag);});list.append(row);}
      loaded=true;status.textContent=`${name} · ${values.length} 组 SNP · 保留23魔方原有顺序与同义分组`;select();
    }catch(error){if(token===generation){status.textContent=error instanceof Error?error.message:'读取失败，请重试';retry.hidden=false;}}
    finally{if(token===generation)loading=false;}
  }
  section.ontoggle=()=>{if(section.open)void load();};retry.onclick=()=>void load();
  function original(value:string,url?:string){
    const append=(href:string,label:string)=>{const line=doc.createElement('p'),link=doc.createElement('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;line.append(link);output.append(line);};
    if(provider.value==='theytree'){
      append(form.action+'?'+new URLSearchParams({snpname:value,hg38:'',t2t2:''}),'打开 TheYtree SNP 查询页 ↗');
      return;
    }
    try{const u=new URL(url||'');if(u.origin==='https://www.23mofang.com'&&/^\/ancestry\/ytree\/[^/]+\/?$/.test(u.pathname))append(u.href,'查看23魔方支系页 ↗');}catch{}
    append('https://www.23mofang.com/report/gene-origin/my-origin','打开23魔方报告／登录 ↗');
  }
  form.onsubmit=async event=>{event.preventDefault();const value=snp(input.value);if(!value){input.setCustomValidity('请输入SNP名称，例如 FGC7600；单独字母不是SNP。');input.reportValidity();return;}input.value=value;select();
    const token=++queryGeneration;button.disabled=true;output.textContent=`正在查询 ${value}…`;
    try{if(!query)throw Error('请重新加载扩展后重试');const result=await query(value,provider.value==='mofang'?'mofang':'theytree',owner||undefined);if(token!==queryGeneration)return;
      output.replaceChildren();const message=doc.createElement('p');message.textContent=result.message;output.append(message);
      if(result.status==='ok')for(const row of result.rows){const card=doc.createElement('article');const name=doc.createElement('strong');name.textContent=row.name;const fields=doc.createElement('p');fields.textContent=`${row.position}\n突变：${row.mutation||'未提供'}\n时间：${row.time||'未提供'}`;fields.style.whiteSpace='pre-line';card.append(name,fields);output.append(card);}
      original(value,result.url);
    }catch(error){if(token!==queryGeneration)return;output.textContent=`查询失败：${error instanceof Error?error.message:'请稍后重试'}`;original(value);}
    finally{if(token===queryGeneration)button.disabled=false;}
  };
  const note=doc.createElement('p');note.textContent='仅点击“查询”后读取SNP结果；不会自动打开网页。';
  const layout=doc.createElement('div');layout.className='snp-layout';layout.append(form,output,status,list,retry,note);section.append(layout);
  return {element:section,reset(){generation++;clearResult();provider.value='theytree';owner='';loaded=false;loading=false;list.replaceChildren();status.textContent='';},setMarker(name:string){generation++;clearResult();provider.value='theytree';owner=name;loaded=false;loading=false;list.replaceChildren();retry.hidden=true;status.textContent=name?`来自 ${name} · 展开后读取本节点全部SNP`:'输入SNP名称，选择来源后查询';input.value=snp(name)||'';input.setCustomValidity('');section.open=false;}};
}
