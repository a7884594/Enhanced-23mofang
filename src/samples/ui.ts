import {marker,treeMarker} from '../ancient/model';
import {formationAge} from '../ancient/age';
import {labels,providers,select,treeLink,type Provider,type Result,type Kind} from './model';
const NS='http://www.w3.org/2000/svg';
const style=`:host{font:13px/1.6 system-ui,'Microsoft Yahei';color:#493e30}*{box-sizing:border-box}.panel{position:fixed;right:18px;top:64px;bottom:18px;width:460px;max-width:calc(100vw - 24px);background:#fffdf9;border:1px solid #dbcdb8;border-radius:14px;box-shadow:0 10px 40px #0002;z-index:2147483601;display:flex;flex-direction:column;overflow:hidden}header{padding:16px;background:#f7efe1}h2{font-size:19px;margin:0}button,select,input{font:inherit;color:inherit;border:1px solid #d9c7aa;border-radius:5px;background:white;padding:5px 8px}button{cursor:pointer}.close{float:right}.controls{padding:10px 16px;display:flex;gap:6px;flex-wrap:wrap}.body{overflow:auto;flex:1;padding:0 16px 16px;min-height:0}section{border-top:1px solid #e7ddce;padding-top:8px;margin-top:8px}h3{font-size:15px;margin:5px 0}.note{font-size:11px;color:#88785e;white-space:pre-line}.card{border:1px solid #e6ddce;padding:9px;margin:8px 0;border-radius:7px;overflow-wrap:anywhere}.links{display:flex;gap:10px}a{color:#35738a}.error{color:#a45836}footer{padding:8px 16px;border-top:1px solid #e7ddce;font-size:11px}input{width:100%}[hidden]{display:none!important}@media(max-width:700px){.panel{inset:0;width:100%;max-width:none;border-radius:0}}`;
async function api(m:any){const r=await chrome.runtime.sendMessage(m);if(!r?.ok)throw Error(String(r?.error||'扩展后台未响应').replace(/^(?:Error:\s*)+/,''));return r.value;}
export function bootSamples(){
  if(document.getElementById('mofang-samples-panel'))return;
  const host=document.createElement('div');host.id='mofang-samples-panel';const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>${style}</style><aside class="panel" role="dialog" aria-label="多源样本查询" hidden><header><button class="close">关闭</button><h2>多源样本</h2><div class="note">TheYtree · YFull · FTDNA</div></header><div class="controls"><select aria-label="样本类别"><option value="all">全部类型</option><option value="ancient">古DNA</option><option value="scientific">科研样本</option><option value="personal">个人／公开现代样本</option></select><select aria-label="范围"><option value="direct">本节点</option><option value="downstream">包含下游</option></select><button class="refresh">刷新</button><button class="cancel">取消</button><input aria-label="搜索样本" placeholder="搜索公开编号、地区、支系"></div><div class="body"></div><footer>各来源独立计数，不合计为去重人数。地区为源站公开地区，不代表当前住址。未确认类型与挂载不确定的记录单独注明。</footer></aside>`;
  document.body.append(host);const q=<T extends HTMLElement=HTMLElement>(s:string)=>shadow.querySelector<T>(s)!;
  let current='',route='',serial=0,token='',results=new Map<Provider,Result>(),errors=new Map<Provider,string>(),loading=new Set<Provider>();
  const pages=new Map<Provider,number>();
  function el(tag:string,value:string,cls=''){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
  function link(parent:Element,value:string,url:string){const a=el('a',value) as HTMLAnchorElement;a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
  function render(){
    const kind=q<HTMLSelectElement>('[aria-label="样本类别"]').value;const downstream=q<HTMLSelectElement>('[aria-label="范围"]').value==='downstream';const needle=q<HTMLInputElement>('input').value.trim().toLowerCase();
    q('.body').replaceChildren();
    for(const provider of providers){
      const section=document.createElement('section');section.append(el('h3',labels[provider]));q('.body').append(section);const result=results.get(provider);
      if(loading.has(provider)){section.append(el('p','正在读取公开数据…','note'));continue;}
      if(!result){section.append(el('p',errors.get(provider)||'尚未查询','error'));link(section,'打开来源页面',treeLink(provider,current));continue;}
      link(section,`${labels[provider]}：${result.target} ↗`,result.url);section.append(el('div',result.mapping,'note'));
      if(result.status!=='ready'){section.append(el('p',result.message,'error'));continue;}
      const data=select(result,downstream),matches=(v:string)=>!needle||v.toLowerCase().includes(needle);
      const rows=data.rows.filter(s=>(kind==='all'||s.kind===kind||kind==='personal'&&s.kind==='modern')&&matches([s.id,s.name,s.region,s.node].join(' ')));
      const confirmed=rows.filter(s=>!s.uncertain&&s.kind!=='unknown'&&s.kind!=='modern').length;
      section.append(el('p',`${data.complete?'公开树范围已读取':'结果尚不完整'} · 当前筛选${rows.length}条（明确类型与挂载${confirmed}条）\n${result.cached?'使用缓存 · ':''}${new Date(result.updatedAt).toLocaleString()}`,'note'));
      section.append(el('div',result.message,'note'));
      if(result.ancientAvailable===false)section.append(el('p','源站未公开此范围的古样本明细，不代表0条。','note'));
      if(!data.complete&&result.nodes.some(n=>n.pending&&!n.loadBlocked)){const more=el('button','继续加载下游') as HTMLButtonElement;more.disabled=!token;more.onclick=async()=>{q<HTMLSelectElement>('[aria-label="范围"]').value='downstream';const version=serial;loading.add(provider);render();try{const next=await api({type:'samples.query',token,provider,marker:current,more:true});if(version===serial)results.set(provider,next);}catch(e){if(version===serial){errors.set(provider,String(e));results.delete(provider);}}finally{if(version===serial){loading.delete(provider);render();}}};section.append(more);}
      if(!downstream){const count=select(result,true).rows.length-data.rows.length;if(count>0){const show=el('button',`查看已加载的${count}条下游记录`) as HTMLButtonElement;show.onclick=()=>{q<HTMLSelectElement>('[aria-label="范围"]').value='downstream';pages.clear();render();};section.append(show);}}
      const limit=(pages.get(provider)||1)*50;
      for(const s of rows.slice(0,limit)){
        const card=el('article','', 'card');const names:Record<Kind,string>={ancient:'古DNA',scientific:'科研',personal:'个人',modern:'现代（个人/科研未细分）',unknown:'类型待核对'};
        card.append(el('strong',`${s.id} · ${names[s.kind]}${s.uncertain?' · 挂载待核对':''}`));
        if(s.name)card.append(el('div',s.name));card.append(el('div',`${s.region||'地区未公开'}\n挂载：${s.node}${s.period?'\n年代：'+s.period:''}${s.culture?'\n文化：'+s.culture:''}\n${s.evidence}`,'note'));link(card,'源站记录',s.url);section.append(card);
      }
      if(rows.length>limit){const more=el('button',`继续显示（剩余${rows.length-limit}条）`) as HTMLButtonElement;more.onclick=()=>{pages.set(provider,(pages.get(provider)||1)+1);render();};section.append(more);}
      if(provider==='ftdna'&&(kind==='all'||kind==='personal')){
        const groups=data.groups.filter(g=>matches(g.region+' '+g.node));section.append(el('p',result.modernAvailable===false?'源站未公开此范围的现代记录，不能记为0条。':`公开现代测试者汇总：${groups.reduce((a,g)=>a+g.count,0)}条；源站未提供稳定样本编号，不能跨站去重，个人/科研未细分。`,'note'));
        const details=document.createElement('details');details.append(el('summary','按挂载支系与地区查看'));for(const g of groups.slice(0,limit))details.append(el('div',`${g.node} · ${g.region} · ${g.count}`,'note'));if(groups.length>limit){const more=el('button','显示更多汇总') as HTMLButtonElement;more.onclick=()=>{pages.set(provider,(pages.get(provider)||1)+1);render();};details.append(more);}section.append(details);
      }
      if(!rows.length)section.append(el('p',data.complete?'当前公开数据没有符合筛选的编号记录；未细分类别不等于0个样本。':'尚未取得符合筛选的记录，不能认定没有样本。','note'));
    }
  }
  async function run(refresh=false){
    const version=++serial;const name=current;results=new Map();errors=new Map();loading=new Set(providers);pages.clear();render();
    try{const begun=await api({type:'samples.begin'});if(version!==serial){void api({type:'samples.cancel',token:begun.token}).catch(()=>{});return;}token=begun.token;
      await Promise.all(providers.map(async provider=>{try{const result=await api({type:'samples.query',token,provider,marker:name,refresh});if(version===serial)results.set(provider,result);}catch(e){if(version===serial)errors.set(provider,String(e));}finally{if(version===serial){loading.delete(provider);render();}}}));
    }catch(e){if(version===serial){for(const p of providers)errors.set(p,String(e));loading.clear();render();}}
  }
  function cancel(){serial++;if(token)void api({type:'samples.cancel',token}).catch(()=>{});token='';for(const p of loading)errors.set(p,'已取消，未记为0条');loading.clear();render();}
  function close(){cancel();q('.panel').hidden=true;}
  function open(value:string,kind='all'){const name=marker(value);if(!name)return;current=name;route=location.href;document.dispatchEvent(new CustomEvent('mofang-sample-panel-open',{detail:'multi'}));q('h2').textContent=name+' · 多源样本';q<HTMLSelectElement>('[aria-label="样本类别"]').value=['ancient','scientific','personal'].includes(kind)?kind:'all';q('.panel').hidden=false;q<HTMLInputElement>('input').value='';void run();q('.close').focus();}
  q('.close').onclick=close;q('.cancel').onclick=cancel;q('.refresh').onclick=()=>void run(true);q('input').oninput=render;for(const s of shadow.querySelectorAll('select'))s.onchange=()=>{pages.clear();render();};
  document.addEventListener('mofang-multi-open',e=>{const d=(e as CustomEvent).detail;open(d?.marker,d?.kind);});
  document.addEventListener('mofang-sample-panel-open',e=>{if((e as CustomEvent).detail!=='multi'&&!q('.panel').hidden)close();});shadow.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Escape')close();});
  function scan(){
    const m=treeMarker(location.pathname);if(!q('.panel').hidden&&location.href!==route)close();
    const eligible=new Set<Element>();
    if(m)for(const n of [...document.querySelectorAll<SVGGElement>('.tree-wrapper g.node')].slice(0,1000)){
      if(n.querySelector(':scope > .person-container')||formationAge(n.querySelector(':scope > .time')?.textContent)==null)continue;const name=marker(n.querySelector(':scope > text.label')?.textContent);if(!name)continue;eligible.add(n);
      let b=n.querySelector<SVGGElement>(':scope > [data-mofang-multi]');if(!b){b=document.createElementNS(NS,'g');b.setAttribute('data-mofang-multi','1');b.setAttribute('role','button');b.setAttribute('tabindex','0');const rect=document.createElementNS(NS,'rect');for(const [k,v]of Object.entries({width:'24',height:'21',rx:'3',fill:'#f7f3eb',stroke:'#dbcdb5'}))rect.setAttribute(k,v);const title=document.createElementNS(NS,'title');title.textContent='多源公开样本 · TheYtree / YFull / FTDNA';const lines=document.createElementNS(NS,'path');for(const [k,v]of Object.entries({d:'M7 7 L17 7 L12 15 Z',fill:'none',stroke:'#99794b','stroke-width':'1.2','stroke-linejoin':'round'}))lines.setAttribute(k,v);b.append(title,rect,lines);for(const [cx,cy] of [[7,7],[17,7],[12,15]]){const dot=document.createElementNS(NS,'circle');for(const [k,v]of Object.entries({cx:String(cx),cy:String(cy),r:'2.2',fill:'#99794b',stroke:'#f7f3eb','stroke-width':'0.8'}))dot.setAttribute(k,v);b.append(dot);}n.append(b);b.onclick=()=>open(b!.dataset.marker!);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(b!.dataset.marker!);}};}
      b.dataset.marker=name;b.setAttribute('aria-label',`${name} 多源公开样本（TheYtree、YFull、FTDNA）`);
      const matrix=n.getScreenCTM();if(!matrix?.a)continue;const snp=n.querySelector(':scope > .snp-wrapper')?.getBoundingClientRect();const center=snp?.height?snp.top+snp.height/2:matrix.f+13;let right=snp?.right||matrix.e;
      for(const c of n.children){if(c===b||c.getAttribute('aria-hidden')==='true')continue;const box=c.getBoundingClientRect();if(box.width&&box.height&&box.top<center+10&&box.bottom>center-10)right=Math.max(right,box.right);}
      b.setAttribute('transform',`translate(${(right-matrix.e)/matrix.a+3},${matrix.d?(center-matrix.f)/matrix.d-10:3})`);
    }
    for(const b of document.querySelectorAll('[data-mofang-multi]'))if(!eligible.has(b.parentElement!))b.remove();
    const existing=document.getElementById('mofang-multi-entry');if(!m||!location.pathname.includes('/branch')||formationAge(document.querySelector('h1')?.parentElement?.textContent)==null)existing?.remove();
    else if(!existing){const h=document.querySelector('h1');if(h){const b=el('button','多源样本') as HTMLButtonElement;b.id='mofang-multi-entry';b.style.cssText='margin:6px;padding:5px 8px;border:1px solid #dbcdb5;border-radius:5px;background:#fffdf9;color:#795c34';b.onclick=()=>open(treeMarker(location.pathname)!);h.after(b);}}
  }
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;scan();},350);};new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.addEventListener('popstate',schedule);document.addEventListener('mofang-badges-layout',schedule);scan();
}
if(typeof document!=='undefined'){if(document.body)bootSamples();else document.addEventListener('DOMContentLoaded',bootSamples,{once:true});}
