import {parseHTML} from 'linkedom';
import {snp} from './snps';
export interface SnpResult {status:'ok'|'empty'|'login'|'error';query:string;url:string;message:string;rows:{name:string;position:string;mutation:string;time:string}[]}
export function snpLookupUrl(query:string){const u=new URL('https://www.theytree.com/user/ysnp/snps');u.search=new URLSearchParams({snpname:query,hg38:'',t2t2:''}).toString();return u.href;}
export function parseSnpResult(html:string,query:string):SnpResult {
  const result:SnpResult={status:'error',query,url:snpLookupUrl(query),message:'未识别到SNP结果表，请登录源站后重试，或查看原页。',rows:[]};
  if(html.length>4_000_000)return {...result,message:'返回页面过大，未读取结果。'};
  const {document}=parseHTML(html);
  if(document.querySelector('input[type=password]'))return {...result,status:'login',message:'请先登录TheYtree，再返回这里重试查询。'};
  const table=[...document.querySelectorAll('table')].find(t=>['SNP|位置|突变|时间','SNP|Position|Mutation|Time'].includes([...t.querySelectorAll('thead th')].map(c=>c.textContent.trim()).join('|')));
  if(!table)return result;
  const rows=[...table.querySelectorAll('tbody tr')];
  if(rows.length>200)return {...result,message:'源站返回超过200条，请输入更精确的SNP名称或查看原页。'};
  const text=(cell:Element)=>{const copy=cell.cloneNode(true) as Element;for(const br of copy.querySelectorAll('br'))br.replaceWith(document.createTextNode('\n'));return (copy.textContent||'').split('\n').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).join('\n').slice(0,1000);};
  for(const row of rows){const cells=[...row.querySelectorAll(':scope > td')];if(cells.length!==4)return result;
    const name=text(cells[0]);if(!name)return result;
    result.rows.push({name,position:text(cells[1]),mutation:text(cells[2]),time:text(cells[3])});
  }
  return {...result,status:result.rows.length?'ok':'empty',message:result.rows.length?`TheYtree · ${query} · ${result.rows.length} 条结果`:`TheYtree未返回 ${query} 的记录。`};
}
export async function fetchSnpResult(value:unknown):Promise<SnpResult>{
  const query=snp(value);if(!query||query.length>100)throw Error('请输入有效的SNP名称');
  const url=snpLookupUrl(query);
  const r=await fetch(url,{credentials:'include',redirect:'follow',signal:AbortSignal.timeout(20000)});
  const final=new URL(r.url);
  const empty={query,url,rows:[]};
  if(final.origin!=='https://www.theytree.com')return {...empty,status:'error',message:'源站重定向到其他网站，已停止读取。'};
  if([401,403].includes(r.status)||/login/i.test(final.pathname))return {...empty,status:'login',message:'源站要求登录或拒绝访问，请登录TheYtree后重试。'};
  if(!r.ok)return {...empty,status:'error',message:`源站返回 HTTP ${r.status}，请稍后重试。`};
  if(!/^\/user\/ysnp\/snps(?:\.html)?$/.test(final.pathname))return {...empty,status:'error',message:'源站未返回SNP查询页，请登录后重试。'};
  return parseSnpResult(await r.text(),query);
}
