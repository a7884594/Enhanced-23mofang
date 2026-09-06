import {formationAge,showAncientEntry,analysisAge} from './age';
import {paintAncientBadge,paintAnalysisEntry} from './badge';
import {snps} from './snps';
import {A_CHANNEL,marker,treeMarker,treeUrl,TY,dated,sourceUrl,paperUrl,type Scope,type QueryResult,type AncientSample} from './model';
const STYLE=`:host{font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#3e362a;color-scheme:light}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #a9854b;outline-offset:2px}.panel{position:fixed;right:18px;top:64px;bottom:18px;width:440px;max-width:calc(100vw - 24px);z-index:2147483600;background:#fffdf9;border:1px solid #e0d5c4;border-radius:16px;box-shadow:0 12px 50px #3b2b2333;display:flex;flex-direction:column;overflow:hidden}.head{background:linear-gradient(110deg,#f6eedf,#fbf7ef);padding:20px 20px 14px}.top{display:flex;align-items:center;justify-content:space-between}.tag{font-size:10px;letter-spacing:2px;color:#997448;font-weight:700}.title{font-size:21px;font-weight:650;margin:5px 0}.close{border:0;background:transparent;font-size:13px;color:#796b57;padding:5px}.mapping{font-size:11px;color:#867764}.tabs{display:flex;gap:6px;margin-top:14px}.tabs button,.actions button{border:1px solid #d8c9af;background:white;border-radius:7px;padding:6px 12px;color:#725937}.tabs button[aria-selected=true]{background:#795c34;color:white}.filters{padding:12px 18px;border-bottom:1px solid #eee6d8;display:flex;flex-wrap:wrap;gap:8px}.filters input{width:100%;padding:8px 10px;background:white;border:1px solid #ddd4c5;border-radius:7px}.filters select{border:1px solid #ddd4c5;border-radius:6px;padding:5px;background:white;max-width:52%}.actions{padding:8px 18px;display:flex;gap:6px;flex-wrap:wrap}.body{flex:1;min-height:0;overflow:auto;padding:0 18px 16px}.empty{padding:25px 8px;color:#8d806f}.card{border:1px solid #e5dccd;background:white;border-radius:10px;padding:13px;margin:10px 0}.name{font-weight:650;color:#443624;font-size:13px;overflow-wrap:anywhere}.au{color:#9b733a;font-size:11px;margin-bottom:4px}.meta{color:#807361;font-size:12px;margin-top:7px;white-space:pre-line}.path{font-size:11px;background:#f7f3ec;color:#806646;border-radius:4px;padding:5px 7px;margin-top:8px;overflow-wrap:anywhere}.links{display:flex;gap:14px;margin-top:8px;font-size:12px}.links a{color:#3d728e}.issue{font-size:11px;color:#a56832;margin-top:6px}.foot{padding:12px 18px;border-top:1px solid #e6ddcd;background:#faf7f0;color:#887761;font-size:11px;white-space:pre-line}.progress{font-weight:600;color:#735634}.caution{font-size:11px;color:#9c8e7a;margin-top:8px}details summary{cursor:pointer;color:#946c3b;padding:10px 0}a{color:#426f85}button:disabled{opacity:.55;cursor:default}[hidden]{display:none!important}@media(max-width:700px){.panel{inset:0;width:100vw;max-width:none;border-radius:0}}`;
const RESPONSIVE=`.caution summary{padding:0;color:#988775}.caution p{margin:5px 0}.head,.filters,.actions,.foot{flex-shrink:0}@media(max-width:700px){.head{padding:10px 12px}.title{font-size:18px;margin:3px 0}.tag{font-size:9px;letter-spacing:1px}.mapping{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px}.tabs{margin-top:8px}.tabs button,.actions button{padding:4px 9px;font-size:12px}.filters{padding:8px 12px;gap:6px}.filters input{padding:6px 8px}.filters select{max-width:calc(50% - 3px);font-size:11px;padding:3px}.actions{padding:6px 12px}.body{padding:0 12px 8px}.foot{padding:8px 12px;font-size:10px;line-height:1.4}.caution{margin-top:4px;font-size:10px}.close{padding:2px}.card{padding:10px}}`;
async function api(message:any){const response=await chrome.runtime.sendMessage(message);if(!response?.ok)throw Error(response?.error||'扩展通信失败，请重新加载扩展并刷新页面');return response.value;}
async function readSnps(name:string):Promise<string[]>{
  const request=crypto.randomUUID(),route=location.href;
  return new Promise((resolve,reject)=>{
    const done=(e:MessageEvent)=>{if(e.source!==window||e.origin!==location.origin||e.data?.channel!==A_CHANNEL||e.data.type!=='node-snps'||e.data.request!==request||e.data.marker!==name||e.data.route!==route||location.href!==route)return;
      clearTimeout(timer);window.removeEventListener('message',done);const values=snps(e.data.snps);if(!values.length)reject(Error('尚未读取到本节点SNP，请在父系树加载完成后重试'));else resolve(values);
    };
    const timer=setTimeout(()=>{window.removeEventListener('message',done);reject(Error('读取节点SNP超时，请重新加载扩展并刷新网页'));},18000);
    window.addEventListener('message',done);window.postMessage({channel:A_CHANNEL,type:'read-snps',marker:name,request},location.origin);
  });
}
export function formalNodes(doc:Document):{node:SVGGElement;name:string}[]{return [...doc.querySelectorAll<SVGGElement>('.tree-wrapper g.node')].flatMap(node=>{if(node.querySelector(':scope > .person-container'))return [];const name=marker(node.querySelector(':scope > text.label')?.textContent);return name&&showAncientEntry(formationAge(node.querySelector(':scope > .time')?.textContent))?[{node,name}]:[];});}
export function bootAncientUI(){
  if(document.getElementById('mofang-ancient-panel'))return;
  const host=document.createElement('div');host.id='mofang-ancient-panel';const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>${STYLE}</style><aside class="panel" role="dialog" aria-label="古DNA查询" hidden><header class="head"><div class="top"><span class="tag">THEYTREE · ANCIENT DNA</span><button class="close">关闭</button></div><div class="title">古DNA</div><div class="mapping">来源：TheYtree</div><div class="tabs" role="tablist"><button data-scope="direct" role="tab">本节点</button><button data-scope="downstream" role="tab">包含下游</button></div></header><div class="filters"><input aria-label="搜索古DNA" placeholder="搜索编号、遗址、文化"><select aria-label="地区筛选"><option value="">全部地区</option></select><select aria-label="年代排序"><option value="source">源站顺序</option><option value="cal BP">cal BP：由早到晚</option><option value="BP">BP：由早到晚</option></select></div><div class="actions"><button class="refresh">刷新</button><button class="pause">暂停</button><button class="resume">继续查询</button><button class="sync">打开TheYtree同步</button></div><div class="body"><div class="empty">点击节点查询古DNA</div><div class="records"></div><details class="unknown"><summary></summary><div class="pending"></div></details><details class="snp-evidence"><summary>节点SNP对应依据</summary><div></div></details><details class="failures"><summary>查询问题</summary><div></div></details></div><footer class="foot"><div class="progress"></div><div class="time"></div><div class="caution">本节点指源站直接挂载，并非已排除所有下游。古样本不代表你的直接祖先；不同年代口径不混排。</div></footer></aside>`;
  document.body.append(host);
  const q=<T extends HTMLElement=HTMLElement>(s:string)=>shadow.querySelector<T>(s)!;
  const responsive=document.createElement('style');responsive.textContent=RESPONSIVE;shadow.append(responsive);
  const note=q('.caution');const noteText=note.textContent;const notes=document.createElement('details');notes.className='caution';const noteTitle=document.createElement('summary');noteTitle.textContent='口径说明';const noteBody=document.createElement('p');noteBody.textContent=noteText;notes.append(noteTitle,noteBody);note.replaceWith(notes);
  let selected='';let scope:Scope='direct';let job:QueryResult|null=null;let serial=0;let busy=false;let lastState='';let priorFocus:Element|null=null;const counts=new Map<string,number>();
  const set=(selector:string,value:string)=>{q(selector).textContent=value;};
  function link(parent:Element,label:string,url:string){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
  function card(s:AncientSample,pending=false){const e=document.createElement('article');e.className='card';
    const au=document.createElement('div');au.className='au';au.textContent=`${s.au} · ${pending?'待核对':'已确认古人'}`;
    const name=document.createElement('div');name.className='name';name.textContent=s.name||'类型未确认的候选样本';
    const meta=document.createElement('div');meta.className='meta';meta.textContent=[s.place||s.country||'地点未提供',s.culture&&`文化：${s.culture}`,`年代：${s.period||'未提供'}`,`覆盖率：${s.coverage==null?'未提供':(s.coverage*100).toFixed(2)+'%'} · 平均深度：${s.depth??'未提供'}`,s.paper&&`来源：${s.paper}`].filter(Boolean).join('\n');
    const path=document.createElement('div');path.className='path';path.textContent=`${s.path.length<=1?'本节点':'下游'} · ${s.path.join(' → ')||s.marker} · ${s.typeEvidence}`;
    e.append(au,name,meta,path);if(s.issue){const issue=document.createElement('div');issue.className='issue';issue.textContent=s.issue;e.append(issue);}
    const links=document.createElement('div');links.className='links';if(sourceUrl(s.url))link(links,'样本原页',s.url);if(paperUrl(s.paperUrl))link(links,'来源论文',s.paperUrl);e.append(links);return e;
  }
  function renderRows(){if(!job)return;const needle=q<HTMLInputElement>('input').value.trim().toLowerCase();const region=q<HTMLSelectElement>('select[aria-label="地区筛选"]').value;const order=q<HTMLSelectElement>('select[aria-label="年代排序"]').value;
    const filter=(s:AncientSample)=>(!region||s.country===region)&&(!needle||[s.au,s.name,s.place,s.culture,s.period,s.marker].join(' ').toLowerCase().includes(needle));
    const rows=job.samples.filter(filter).slice();if(order!=='source')rows.sort((a,b)=>{const x=dated(a.period),y=dated(b.period);return (y?.basis===order?y.midpoint:-Infinity)-(x?.basis===order?x.midpoint:-Infinity)||0;});
    q('.records').replaceChildren(...rows.map(s=>card(s)));const pending=job.unknown.filter(filter);q('.pending').replaceChildren(...pending.map(s=>card(s,true)));q('.unknown').hidden=!pending.length;set('.unknown summary',`待核对 ${pending.length} 条（不计入已确认数量）`);
    q('.empty').hidden=!!rows.length||!!pending.length;q('.empty').textContent=job.complete?'当前条件下没有古样本':job.message;
  }
  function update(j:QueryResult){if(j.status==='unmatched'&&!j.nodeSnps){void query(!!j.forceRefresh,true);return;}job=j;set('.title',`${selected} · 古DNA`);set('.mapping',`来源：TheYtree · ${j.mapping}`);
    for(const b of shadow.querySelectorAll<HTMLButtonElement>('[data-scope]'))b.setAttribute('aria-selected',String(b.dataset.scope===scope));
    q('.pause').hidden=!['running','sync'].includes(j.status);q('.resume').hidden=!['paused','partial','error'].includes(j.status);q('.sync').hidden=j.complete||j.status==='running';
    const regions=q<HTMLSelectElement>('select[aria-label="地区筛选"]');const previous=regions.value;regions.replaceChildren(new Option('全部地区',''),...[...new Set([...j.samples,...j.unknown].map(s=>s.country).filter(Boolean))].sort().map(r=>new Option(r,r)));regions.value=previous;
    set('.progress',`已确认 ${j.samples.length} 条 · 待核对 ${j.unknown.length} 条\n已检查 ${j.checked.length} 个节点 · 失败 ${j.failures.length} 项\n${j.message}${j.cachedChildren!=null?'\n已同步 '+j.cachedChildren+' 个下游节点的本节点缓存':''}`);
    set('.time',`${j.cached?'使用缓存 · ':''}更新于 ${new Date(j.updatedAt).toLocaleString()}`);
    q('.snp-evidence').hidden=!j.nodeSnps;
    const evidence=q('.snp-evidence > div');evidence.replaceChildren();
    const info=document.createElement('p');info.textContent=`23魔方本节点SNP：${j.nodeSnps?.join(', ')||'尚未读取'}（已核对 ${j.snpChecks?.length??0} / ${j.nodeSnps?.length??0}）`;evidence.append(info);
    for(const c of j.snpChecks||[]){const row=document.createElement('p');row.textContent=`${c.snp} → ${c.target||c.candidate?.marker&&('候选 '+c.candidate.marker)||'未确认对应'}${c.issue?' · '+c.issue:''} `;link(row,'查询依据',`${TY}/tree/${encodeURIComponent(c.target||j.marker)}?snp=${encodeURIComponent(c.snp)}`);evidence.append(row);
      if(c.evidence){const detail=document.createElement('p');detail.textContent=`TheYtree等价SNP：${c.evidence.groups.join(', ')}；共同SNP：${c.evidence.overlap.join(', ')||'无'}；读取时间：${new Date(c.evidence.capturedAt).toLocaleString()}`;evidence.append(detail);}
      if(c.note){const note=document.createElement('p');note.className='issue';note.textContent=c.note;evidence.append(note);}
    }
    const failures=q('.failures > div');failures.replaceChildren();for(const f of j.failures){const row=document.createElement('p');row.textContent=`${f.key}：${f.message}`;failures.append(row);}q('.failures').hidden=!j.failures.length;
    if(j.status==='unmatched'){const row=document.createElement('p');link(row,'到TheYtree搜索支系',`${TY}/`);failures.append(row);q('.failures').hidden=false;}
    if(j.complete){invalidateCounts();if(j.scope==='direct')counts.set(j.marker,j.samples.length);updateBadges();}renderRows();
  }
  async function query(refresh=false,useSnps=false){const token=++serial;busy=true;job=null;set('.title',`${selected} · 古DNA`);set('.progress','正在查询…');q('.records').replaceChildren();q('.pending').replaceChildren();q('.unknown').hidden=true;q('.failures').hidden=true;q('.empty').hidden=false;set('.empty','正在读取TheYtree公开古DNA信息…');
    set('.time','');set('.mapping','来源：TheYtree');q('.snp-evidence > div').replaceChildren();q('.snp-evidence').hidden=true;
    q('.resume').hidden=true;q('.sync').hidden=true;q('.pause').hidden=true;
    for(const b of shadow.querySelectorAll<HTMLButtonElement>('[data-scope]'))b.setAttribute('aria-selected',String(b.dataset.scope===scope));
    try{const name=selected,range=scope;const values=useSnps?await readSnps(name):undefined;if(token!==serial)return;const j=await api({type:'anc.start',marker:name,scope:range,refresh,snps:values});if(token===serial)update(j);else void api({type:'anc.cancel',id:j.id}).catch(()=>{});}catch(e){if(token===serial){set('.empty',String(e));set('.progress','查询失败，不代表没有古样本');}}finally{if(token===serial)busy=false;}
  }
  function open(name:string){const m=marker(name);if(!m)return;priorFocus=document.activeElement;selected=m;scope='direct';q('.panel').hidden=false;q<HTMLInputElement>('input').value='';void query();q('.close').focus();}
  function close(){q('.panel').hidden=true;serial++;if(job&&['running','sync'].includes(job.status))void api({type:'anc.cancel',id:job.id}).catch(()=>{});if(priorFocus instanceof HTMLElement||priorFocus instanceof SVGElement)(priorFocus as HTMLElement).focus?.();}
  q('.close').onclick=close;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!q('.panel').hidden)close();});
  for(const b of shadow.querySelectorAll<HTMLButtonElement>('[data-scope]'))b.onclick=()=>{scope=b.dataset.scope as Scope;void query();};
  q('.refresh').onclick=()=>void query(true);
  for(const [selector,type]of [['.pause','anc.cancel'],['.resume','anc.resume'],['.sync','anc.sync']])q(selector).onclick=async()=>{if(!job)return;const id=job.id,token=serial;try{const r=await api({type,id});if(token!==serial||job?.id!==id)return;if(r?.id)update(r);else set('.progress','已打开TheYtree，请在正常网页完成同步后回到这里');}catch(e){if(token===serial)set('.progress',String(e));}};
  q('input').oninput=renderRows;for(const s of shadow.querySelectorAll('select'))s.onchange=renderRows;
  const svgNS='http://www.w3.org/2000/svg';let lastCountRequest='';let countGeneration=0;
  function invalidateCounts(){lastCountRequest='';countGeneration++;}
  chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes['anc.cacheRevision'])invalidateCounts();});
  function updateBadges(){for(const e of document.querySelectorAll<SVGGElement>('[data-mofang-ancient]'))paintAncientBadge(e,counts.get(e.dataset.marker||''));const entry=document.querySelector<HTMLButtonElement>('#mofang-ancient-entry');if(entry)paintAnalysisEntry(entry,counts.get(entry.dataset.marker||''));}
  function scan(){
    const route=treeMarker(location.pathname);if(!route){document.querySelectorAll('[data-mofang-ancient],#mofang-ancient-entry').forEach(e=>e.remove());if(!q('.panel').hidden)close();return;}
    const eligible=formalNodes(document);const eligibleNodes=new Set(eligible.map(n=>n.node));
    for(const b of document.querySelectorAll('[data-mofang-ancient]'))if(!eligibleNodes.has(b.parentElement as unknown as SVGGElement))b.remove();
    const branchPage=location.pathname.includes('/branch');const youngBranch=branchPage&&!showAncientEntry(analysisAge(document));
    if(!branchPage||youngBranch)document.getElementById('mofang-ancient-entry')?.remove();
    const selectedYoung=!q('.panel').hidden&&(branchPage?youngBranch:[...document.querySelectorAll('.tree-wrapper g.node')].some(n=>marker(n.querySelector(':scope > text.label')?.textContent)===selected&&!showAncientEntry(formationAge(n.querySelector(':scope > .time')?.textContent))));
    if(selectedYoung&&!q('.panel').hidden)close();
    const nodes=eligible.filter(({node})=>{const b=node.getBoundingClientRect();return b.bottom>=0&&b.top<=innerHeight;});
    for(const {node,name}of nodes){
      let button=node.querySelector<SVGGElement>(':scope > [data-mofang-ancient]');
      if(!button){button=document.createElementNS(svgNS,'g');button.dataset.mofangAncient='1';button.dataset.marker=name;button.setAttribute('role','button');button.setAttribute('tabindex','0');button.setAttribute('aria-label',`${name} 古DNA`);button.style.cursor='pointer';
        const rect=document.createElementNS(svgNS,'rect');for(const[k,v]of Object.entries({width:'20',height:'20',rx:'4',fill:'#f5f3ee',stroke:'#ded7ca'}))rect.setAttribute(k,v);
        const text=document.createElementNS(svgNS,'text');for(const[k,v]of Object.entries({x:'7',y:'16',fill:'#866134','font-size':'11','font-family':'sans-serif'}))text.setAttribute(k,v);text.textContent='古DNA';button.append(rect,text);node.append(button);
        button.onclick=e=>{e.stopPropagation();open(button!.dataset.marker!);};button.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();open(button!.dataset.marker!);}};
      }
      button.dataset.marker=name;
      button.setAttribute('aria-label',`${name} 古DNA`);
      const matrix=node.getScreenCTM();if(!matrix?.a)continue;
      const right=Math.max(...[...node.children].filter(e=>e!==button).map(e=>e.getBoundingClientRect().right));
      const x=(right-matrix.e)/matrix.a+8;const transform=`translate(${x},3)`;if(button.getAttribute('transform')!==transform)button.setAttribute('transform',transform);
    }
    if(!nodes.length&&branchPage&&!youngBranch){
      const heading=document.querySelector('h1');if(heading&&!document.getElementById('mofang-ancient-entry')){const b=document.createElement('button');b.id='mofang-ancient-entry';b.dataset.marker=route;paintAnalysisEntry(b,counts.get(route));b.onclick=()=>{const m=treeMarker(location.pathname);if(m)open(m);};heading.after(b);}
    }
    const entry=document.querySelector<HTMLButtonElement>('#mofang-ancient-entry');if(entry)entry.dataset.marker=route;
    const names=[...new Set([...nodes.map(n=>n.name),...(entry?[route]:[])])].slice(0,600);const key=names.join('|');if(key&&key!==lastCountRequest){lastCountRequest=key;const generation=++countGeneration;void api({type:'anc.counts',markers:names}).then(result=>{if(generation!==countGeneration)return;for(const name of names)counts.delete(name);for(const [m,v]of Object.entries<any>(result))counts.set(m,v.count);updateBadges();}).catch(()=>{if(generation===countGeneration)lastCountRequest='';});}updateBadges();
  }
  let priorRoute=location.pathname;
  setInterval(()=>{
    if(document.hidden)return;
    if(location.pathname!==priorRoute){priorRoute=location.pathname;if(!q('.panel').hidden)close();}
    scan();
    if(job&&!q('.panel').hidden&&!busy){const id=job.id;const token=serial;busy=true;void api({type:'anc.get',id}).then(j=>{if(token===serial&&j?.id===id){const key=JSON.stringify(j);if(key!==lastState){lastState=key;update(j);}}}).catch(e=>{if(token===serial)set('.progress',String(e));}).finally(()=>{if(token===serial)busy=false;});}
  },700);
  scan();
}
if(typeof document!=='undefined'){if(document.body)bootAncientUI();else document.addEventListener('DOMContentLoaded',bootAncientUI,{once:true});}
