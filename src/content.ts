import * as echarts from 'echarts/core';
import {GeoComponent,TooltipComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {CHANNEL,copyRegions,copySelections,flatten,flattenCities,matchCounties,percentText,quantiles,colorFor,NO_DATA,routeNode,type Snapshot,type Atlas,type Matched,type GeoFeature} from './model';
import {CSS} from './style';
import {prepareAtlas} from './geography';
import {findMapMount,insertMapHost} from './layout';
import {hideOriginalMap,showOriginalMap} from './original-visibility';
echarts.use([GeoComponent,TooltipComponent,CanvasRenderer]);

let host:HTMLElement|null=null, shadow:ShadowRoot|null=null, original:HTMLElement|null=null;
let chart:echarts.ECharts|null=null;let observer:ResizeObserver|null=null;
type Detail='county'|'city';
type Mode=Detail|'province';
let snapshot:Snapshot|null=null;const atlasPromises:Partial<Record<Detail,Promise<Atlas>>>={};let generation=0;
let mode:Mode='county';let detail:Detail='county';let currentNode='';let boundTo:Element|null=null;let lastRoute=location.pathname+location.search;
let lastSnapshotKey='';let startup=Date.now();let matched:Matched[]=[];let atlas:Atlas|null=null;
let originalResizeGeneration=0;
const q=<T extends HTMLElement=HTMLElement>(selector:string)=>shadow!.querySelector<T>(selector)!;
function text(selector:string,value:string){q(selector).textContent=value;}
function requestOriginalResize(container:HTMLElement){
  const token=++originalResizeGeneration;
  const route=location.pathname+location.search;
  const notify=()=>{
    if(token!==originalResizeGeneration||!container.isConnected||container.style.display==='none'||route!==location.pathname+location.search)return;
    window.postMessage({channel:CHANNEL,type:'resize-original',route},location.origin);
    // Also notify the site's normal responsive listeners.
    window.dispatchEvent(new Event('resize'));
  };
  requestAnimationFrame(()=>requestAnimationFrame(notify));
  setTimeout(notify,300);
}
function showOriginal(){if(original){showOriginalMap(original);requestOriginalResize(original);}}
function restoreOriginal(){showOriginal();original=null;}
function cleanup(){generation++;chart?.dispose();chart=null;observer?.disconnect();observer=null;restoreOriginal();host?.remove();host=null;shadow=null;boundTo=null;matched=[];}
function unit(){return detail==='city'?'市级':'区县';}
function updateVisibility(){
  if(!shadow)return;
  const value=mode!=='province';
  q('.map-wrap').hidden=!value||!chart;
  q('.unmatched').hidden=!value||!q('tbody').children.length;
  for(const tab of ['county','city','province'])q(`.${tab}-tab`).setAttribute('aria-selected',String(mode===tab));
  if(original){if(value&&snapshot?.status==='ready'&&chart){originalResizeGeneration++;hideOriginalMap(original);}else showOriginal();}
  if(value)requestAnimationFrame(()=>chart?.resize());
}
function setMode(next:Mode){
  const previous=detail;mode=next;if(next!=='province')detail=next;
  updateVisibility();
  if(detail!==previous)void render();
}
function mount():boolean {
  const target=findMapMount(document,snapshot?.status==='empty'||snapshot?.status==='error');
  if(!target)return false;
  const {container,anchor}=target;
  if(host?.isConnected&&boundTo===anchor&&original===container)return true;
  cleanup();boundTo=anchor;host=document.createElement('section');host.id='mofang-county-map';host.setAttribute('aria-label','全国区县频率地图');
  shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>${CSS}</style><div class="card">
  <header class="header"><div><div class="eyebrow">23魔方 · 地域分布</div><div class="title">全国区县频率</div><div class="sub">细看每一处支系分布</div></div><div class="tabs" role="tablist" aria-label="地图层级"><button class="county-tab" role="tab" aria-selected="true">全国区县</button><button class="city-tab" role="tab" aria-selected="false">全国市级</button><button class="province-tab" role="tab" aria-selected="false">原省级图</button></div></header>
  <div class="notice" role="status">正在读取当前支系的区县频率…</div>
  <div class="map-wrap" hidden><div class="tools"><div class="search"><input aria-label="搜索区县" placeholder="搜索省、市或区县名称" autocomplete="off"><div class="results" aria-label="搜索结果"></div></div><button class="reset">恢复全国</button><button class="fullscreen">全屏查看</button><span class="hint">滚轮缩放 · 拖动平移 · 点击查看</span></div><div class="selection" aria-live="polite"></div><div class="map" role="img" aria-label="全国区县频率着色图，支持搜索地名查看数值"></div><div class="legend"></div></div>
  <div class="status" role="status"></div><details class="unmatched" hidden><summary></summary><div class="scroll"><table><thead><tr><th>网站区县</th><th>频率</th><th>未匹配原因</th></tr></thead><tbody></tbody></table></div></details><div class="foot">频率口径沿用23魔方：该支系（包含下游）在当地人口中的比例。灰色表示未提供区县频率或未匹配，非 0%。</div></div><dialog class="fullscreen-dialog" aria-label="全国区县频率地图全屏视图"></dialog>`;
  if(container)original=container;
  insertMapHost(host,target);
  q('.county-tab').onclick=()=>setMode('county');q('.city-tab').onclick=()=>setMode('city');q('.province-tab').onclick=()=>setMode('province');
  q('.reset').onclick=()=>{chart?.setOption({geo:{center:null,zoom:1}});text('.selection','');q<HTMLInputElement>('input').value='';q('.results').replaceChildren();chart?.dispatchAction({type:'downplay'});};
  const dialog=q<HTMLDialogElement>('dialog');
  dialog.onclose=()=>{if(shadow){q('.notice').after(q('.map-wrap'));text('.fullscreen','全屏查看');requestAnimationFrame(()=>chart?.resize());}};
  q('.fullscreen').onclick=async()=>{
    if(dialog.open){dialog.close();return;}
    if(document.fullscreenElement){await document.exitFullscreen();return;}
    try{await q('.map-wrap').requestFullscreen();text('.fullscreen','退出全屏');}
    catch{dialog.append(q('.map-wrap'));dialog.showModal();text('.fullscreen','退出全屏');requestAnimationFrame(()=>chart?.resize());}
  };
  q<HTMLInputElement>('input').oninput=search;
  q<HTMLInputElement>('input').onkeydown=e=>{if(e.key==='Escape')q('.results').replaceChildren();if(e.key==='Enter')q<HTMLButtonElement>('.results button')?.click();};
  return true;
}
function search(){
  const needle=q<HTMLInputElement>('input').value.trim();const box=q('.results');box.replaceChildren();if(!needle||!atlas)return;
  const values=new Map(matched.map(m=>[m.feature.properties.code,m.record]));
  const results=atlas.features.filter(f=>f.properties.level===(detail==='city'?'city':'district')&&f.properties.path.join('').includes(needle)).slice(0,40);
  for(const f of results){const b=document.createElement('button');const r=values.get(f.properties.code);b.textContent=`${f.properties.path.join(' / ')} · ${r?percentText(r.percent):'未提供 / 未匹配'}`;b.onclick=()=>{focus(f);box.replaceChildren();};box.append(b);}
  if(!results.length){const p=document.createElement('p');p.textContent=`没有匹配的${unit()}地区；旧区划请查看下方未匹配明细。`;box.append(p);}
}
function describe(code:string){
  const value=matched.find(m=>m.feature.properties.code===code);
  if(value)return `${value.record.path.join(' / ')}\n${snapshot?.node} · ${percentText(value.record.percent)}${value.feature.properties.boundaryNote?'\n'+value.feature.properties.boundaryNote:''}`;
  const f=atlas?.features.find(f=>f.properties.code===code);
  return `${f?.properties.path.join(' / ')||'区域'}\n未提供${unit()}频率 / 未匹配`;
}
function focus(f:GeoFeature){
  const center=f.properties.center;
  if(center)chart?.setOption({geo:{center,zoom:detail==='city'?4:8}});
  chart?.dispatchAction({type:'downplay'});chart?.dispatchAction({type:'highlight',geoIndex:0,name:f.properties.code});
  text('.selection',describe(f.properties.code).replace('\n','　'));
}
async function loadAtlas(level:Detail){
  if(!atlasPromises[level])atlasPromises[level]=(async()=>{const file=level==='city'?'cities':'counties';const r=await fetch(chrome.runtime.getURL(`assets/${file}.geo.json`));if(!r.ok)throw Error('无法加载离线地图');const a=await r.json();if(a.type!=='FeatureCollection'||!a.features?.length)throw Error('地图文件损坏');return a as Atlas;})().catch(e=>{delete atlasPromises[level];throw e;});
  return atlasPromises[level]!;
}
async function render(){
  const s=snapshot;if(!s||!routeNode(location.pathname)){cleanup();return;}
  if(!mount()){cleanup();return;}
  const token=++generation;
  const level=detail;const name=unit();const mapName=`mofang-${level}`;
  chart?.dispose();chart=null;observer?.disconnect();observer=null;matched=[];
  atlas=null;
  showOriginal();
  q('.map-wrap').hidden=true;q('.notice').hidden=false;q('.unmatched').hidden=true;q('tbody').replaceChildren();
  text('.title',`${s.node} · 全国${name}频率`);text('.sub',s.label?'当前显示所选籍贯范围，频率沿用网站原值':'全国视图 · 与当前支系数据同步');text('.status','');text('.selection','');q('.results').replaceChildren();
  host!.setAttribute('aria-label',`全国${name}频率地图`);
  q('.map').setAttribute('aria-label',`全国${name}频率着色图，支持搜索地名查看数值`);
  q('dialog').setAttribute('aria-label',`全国${name}频率地图全屏视图`);
  q<HTMLInputElement>('input').value='';
  q('input').setAttribute('aria-label',`搜索${name}地区`);
  q('input').setAttribute('placeholder',level==='city'?'搜索省或城市名称':'搜索省、市或区县名称');
  text('th',`网站${name}地区`);
  text('.foot',`频率口径沿用23魔方：该支系（包含下游）在当地人口中的比例。${level==='city'?'市级直接使用网站市级原值，直辖市按全市显示，不汇总区县。':''}灰色表示未提供${name}频率或未匹配，非 0%。`);
  updateVisibility();
  if(s.status!=='ready'){
    text('.notice',s.status==='loading'?`正在读取当前支系的${name}频率…`:s.status==='empty'?'本页未提供可用的地域分布数据。':s.error||'数据读取失败，原页面仍可正常使用。');return;
  }
  text('.notice',`正在载入离线${name}地图…`);
  try{
    const loaded=await loadAtlas(level);if(token!==generation||!host?.isConnected)return;
    const extract=level==='city'?flattenCities:flatten;
    const geometryLevel=level==='city'?'city':'district';
    atlas=level==='county'?prepareAtlas(extract(s.items),loaded):loaded;
    const records=extract(s.items,s.birthplace);const result=matchCounties(records,atlas,geometryLevel);matched=result.matched;
    // Keep the same nationwide thresholds when birthplace filters change.
    const scaleRecords=s.birthplace.length?matchCounties(extract(s.items),atlas,geometryLevel).matched:matched;
    const bins=quantiles(scaleRecords.map(m=>m.record.percent!));
    echarts.registerMap(mapName,atlas as any);
    q('.notice').hidden=true;q('.map-wrap').hidden=false;
    chart=echarts.init(q('.map'),undefined,{renderer:'canvas',devicePixelRatio:Math.min(devicePixelRatio,2)});
    const values=new Map(matched.map(m=>[m.feature.properties.code,m.record.percent!]));
    chart.setOption({animation:false,tooltip:{trigger:'item',renderMode:'richText',confine:true,formatter:(p:any)=>describe(p.name),backgroundColor:'#ffffff',borderColor:'#d6e3eb',textStyle:{color:'#244559',fontSize:12}},
      geo:{map:mapName,nameProperty:'code',roam:true,zoom:1,scaleLimit:{min:1,max:35},layoutCenter:['50%','50%'],layoutSize:'96%',silent:false,label:{show:false},tooltip:{show:true,formatter:(p:any)=>describe(p.name)},itemStyle:{areaColor:NO_DATA,borderColor:'#becdd7',borderWidth:.35},emphasis:{label:{show:false},itemStyle:{areaColor:'#f0c977',borderColor:'#9a7332',borderWidth:1}},selectedMode:false,
        regions:atlas.features.map(f=>{const v=values.get(f.properties.code);const color=v===undefined?NO_DATA:colorFor(v,bins);return {name:f.properties.code,itemStyle:{areaColor:color},emphasis:{itemStyle:{areaColor:color}}};})}
    });
    chart.on('click',(p:any)=>{if(p.name)text('.selection',describe(p.name).replace('\n','　'));});
    observer=new ResizeObserver(()=>chart?.resize());observer.observe(q('.map'));
    const legend=q('.legend');legend.replaceChildren();
    const label=document.createElement('span');label.className='legend-label';label.textContent='低频（绿）→ 高频（红） · 全国分位数';legend.append(label);
    for(const bin of [...bins,{color:NO_DATA,label:'未提供 / 未匹配'}]){const key=document.createElement('span');key.className='key';const swatch=document.createElement('i');swatch.className='swatch';swatch.style.background=bin.color;key.append(swatch,document.createTextNode(bin.label));legend.append(key);}
    text('.status',`已匹配 ${matched.length} / ${records.length} 条${name}数据 · 未匹配 ${result.unmatched.length} 条${matched.some(m=>m.feature.properties.group)?` · 其中 ${matched.filter(m=>m.feature.properties.group).length} 条使用旧版边界`:''}${s.label?' · 籍贯筛选：'+s.label:''}${atlas.metadata?.failures?.length?' · 部分地图边界下载失败':''}`);
    text('.sub',s.label?'当前显示所选籍贯范围，频率沿用网站原值':'全国视图 · 与当前支系数据同步');
    for(const u of result.unmatched){const tr=document.createElement('tr');for(const value of [u.record.path.join(' / '),percentText(u.record.percent),u.reason]){const td=document.createElement('td');td.textContent=value;tr.append(td);}q('tbody').append(tr);}
    text('summary',`${result.unmatched.length} 条${name}数据未能着色 · 查看明细`);
    updateVisibility();
  }catch(e){if(token!==generation)return;chart?.dispose();chart=null;q('.map-wrap').hidden=true;q('.notice').hidden=false;text('.notice',`${e instanceof Error?e.message:'地图加载失败'}。请重新加载扩展并刷新网页，原地图已保留。`);showOriginal();}
}
function request(){window.postMessage({channel:CHANNEL,type:'request'},location.origin);}
document.addEventListener('fullscreenchange',()=>{if(shadow){text('.fullscreen',document.fullscreenElement?'退出全屏':'全屏查看');requestAnimationFrame(()=>chart?.resize());}});
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.channel!==CHANNEL||event.data?.type!=='snapshot')return;
  const s=event.data.snapshot;
  if(!s||s.route!==location.pathname+location.search||s.node!==routeNode(location.pathname)||!['ready','loading','empty','error'].includes(s.status))return;
  const clean:Snapshot={route:s.route,node:s.node,status:s.status,items:copyRegions(s.items),birthplace:copySelections(s.birthplace),label:typeof s.label==='string'?s.label.slice(0,2000):'',error:typeof s.error==='string'?s.error.slice(0,300):undefined};
  if(currentNode!==clean.node){mode='county';detail='county';currentNode=clean.node;}
  const key=JSON.stringify(clean);if(key===lastSnapshotKey&&host?.isConnected)return;
  lastSnapshotKey=key;snapshot=clean;void render();
});
setInterval(()=>{
  const route=location.pathname+location.search;
  if(route!==lastRoute){lastRoute=route;lastSnapshotKey='';snapshot=null;cleanup();startup=Date.now();request();}
  if(!routeNode(location.pathname)){if(host)cleanup();return;}
  const target=snapshot?findMapMount(document,snapshot.status==='empty'||snapshot.status==='error'):null;
  if(snapshot&&(!host?.isConnected||boundTo!==target?.anchor||original!==target?.container))void render();
  else if(!snapshot){request();if(Date.now()-startup>15000){snapshot={route,node:routeNode(location.pathname)!,status:'error',items:[],birthplace:[],label:'',error:'无法连接页面数据，请刷新网页或重新加载扩展。'};void render();}}
},400);
request();
