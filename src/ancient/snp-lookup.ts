import {snp,snps} from './snps';

/** A plain user-submitted GET form. No fetch, cache lookup or background message. */
export function createSnpLookup(doc:Document,read?:(name:string)=>Promise<string[]>){
  const section=doc.createElement('details');section.className='snp-lookup';
  const summary=doc.createElement('summary');summary.textContent='SNP查询（TheYtree）';section.append(summary);
  const form=doc.createElement('form');form.action='https://www.theytree.com/user/ysnp/snps';form.method='get';form.target='_blank';form.setAttribute('rel','noopener noreferrer');
  const input=doc.createElement('input');input.name='snpname';input.required=true;input.maxLength=100;input.placeholder='例如 FGC7600';input.setAttribute('aria-label','要查询的SNP名称');
  const button=doc.createElement('button');button.type='submit';button.textContent='打开查询 ↗';
  form.append(input,button);
  for(const name of ['hg38','t2t2']){const field=doc.createElement('input');field.type='hidden';field.name=name;field.value='';form.append(field);}
  const status=doc.createElement('p');status.setAttribute('role','status');
  const list=doc.createElement('div');list.className='snp-options';list.setAttribute('aria-label','本节点全部SNP');
  const retry=doc.createElement('button');retry.type='button';retry.textContent='重新读取本节点SNP';retry.hidden=true;
  let owner='',generation=0,loaded=false,loading=false;
  function select(){for(const tag of list.querySelectorAll('button'))tag.setAttribute('aria-pressed',String(tag.textContent===snp(input.value)));}
  input.oninput=()=>{input.setCustomValidity('');select();};
  async function load(){
    if(!read||!owner||loaded||loading)return;
    const token=generation,name=owner;loading=true;retry.hidden=true;status.textContent=`正在读取 ${name} 的本节点SNP…`;
    try{
      const values=snps(await read(name));if(token!==generation)return;
      if(!values.length)throw Error('页面尚未提供本节点SNP，请等待树加载后重新读取。');
      for(const value of values){const tag=doc.createElement('button');tag.type='button';tag.textContent=value;tag.title='点击填入查询框';tag.onclick=()=>{input.value=value;input.setCustomValidity('');select();};list.append(tag);}
      loaded=true;status.textContent=`来自 ${name} · 全部 ${values.length} 个SNP · 点击名称填入`;select();
    }catch(error){if(token===generation){status.textContent=error instanceof Error?error.message:'读取失败，请重试';retry.hidden=false;}}
    finally{if(token===generation)loading=false;}
  }
  section.ontoggle=()=>{if(section.open)void load();};retry.onclick=()=>void load();
  form.onsubmit=event=>{const value=snp(input.value);if(!value){event.preventDefault();input.setCustomValidity('请输入SNP名称，例如 FGC7600；单独字母不是SNP。');input.reportValidity();return;}input.value=value;};
  const note=doc.createElement('p');note.textContent='仅点击后打开源站查询页；可能需要登录TheYtree。';
  section.append(form,status,list,retry,note);
  return {element:section,setMarker(name:string){generation++;owner=name;loaded=false;loading=false;list.replaceChildren();retry.hidden=true;status.textContent=`来自 ${name} · 展开后读取本节点全部SNP`;input.value=snp(name)||'';input.setCustomValidity('');section.open=false;}};
}
