import {snp} from './snps';

/** A plain user-submitted GET form. No fetch, cache lookup or background message. */
export function createSnpLookup(doc:Document){
  const section=doc.createElement('details');section.className='snp-lookup';
  const summary=doc.createElement('summary');summary.textContent='SNP查询（TheYtree）';section.append(summary);
  const form=doc.createElement('form');form.action='https://www.theytree.com/user/ysnp/snps';form.method='get';form.target='_blank';form.setAttribute('rel','noopener noreferrer');
  const input=doc.createElement('input');input.name='snpname';input.required=true;input.maxLength=100;input.placeholder='例如 FGC7600';input.setAttribute('aria-label','要查询的SNP名称');
  const button=doc.createElement('button');button.type='submit';button.textContent='打开查询 ↗';
  form.append(input,button);
  for(const name of ['hg38','t2t2']){const field=doc.createElement('input');field.type='hidden';field.name=name;field.value='';form.append(field);}
  input.oninput=()=>input.setCustomValidity('');
  form.onsubmit=event=>{const value=snp(input.value);if(!value){event.preventDefault();input.setCustomValidity('请输入SNP名称，例如 FGC7600；单独字母不是SNP。');input.reportValidity();return;}input.value=value;};
  const note=doc.createElement('p');note.textContent='仅点击后打开源站查询页；可能需要登录TheYtree。';
  section.append(form,note);
  return {element:section,setMarker(name:string){input.value=snp(name)||'';input.setCustomValidity('');section.open=false;}};
}
