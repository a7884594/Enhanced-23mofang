import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import * as echarts from 'echarts';
import {copyRegions,flatten,flattenCities,matchCounties,naturalBreaks,colorFor,NO_DATA,type Bin,type Atlas} from '../src/model';
import {prepareAtlas} from '../src/geography';

// Frozen baseline from the previous five-quantile renderer, for same-data comparisons only.
function oldQuantiles(values:number[]):Bin[]{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),cuts:number[]=[];
  if(!sorted.length)return [];
  const last=sorted.at(-1)!;
  for(let i=1;i<5;i++){
    const pos=(sorted.length-1)*i/5,low=Math.floor(pos);
    const value=sorted[low]+(sorted[Math.ceil(pos)]-sorted[low])*(pos-low);
    if(value<last&&!cuts.includes(value))cuts.push(value);
  }
  cuts.push(last);
  const colors=['#1a9850','#91cf60','#fee08b','#fc8d59','#d73027'];
  return cuts.map((max,i)=>({min:i===0?sorted[0]:cuts[i-1],max,color:colors[cuts.length===1?2:Math.round(i*4/(cuts.length-1))],label:''}));
}
const out='reports/color-scale';await mkdir(out,{recursive:true});
const escape=(value:unknown)=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const pct=(v:number)=>Number((v*100).toPrecision(6))+'%';
const reports:any[]=[];const sections:string[]=[];
for(const node of ['O-F2758','O-F2890']){
  const fixture=JSON.parse(await readFile('tests/fixtures/'+node+'.json','utf8'));
  const capturedLabel=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(new Date(fixture.capturedAt))+' 北京时间';
  const items=copyRegions(fixture.geographicDistribution.chartItems);
  for(const level of ['county','city'] as const){
    const extract=level==='city'?flattenCities:flatten;
    const records=extract(items);
    const raw:Atlas=JSON.parse(await readFile('assets/'+(level==='city'?'cities':'counties')+'.geo.json','utf8'));
    const atlas=level==='county'?prepareAtlas(records,raw):raw;
    const {matched,unmatched}=matchCounties(records,atlas,level==='city'?'city':'district');
    const values=matched.map(m=>m.record.percent!);
    const old=oldQuantiles(values),bins=naturalBreaks(values);
    const timings:number[]=[];
    for(let i=0;i<31;i++){const start=performance.now();naturalBreaks(values);if(i)timings.push(performance.now()-start);}
    timings.sort((a,b)=>a-b);
    const count=(bin:Bin,index:number)=>values.filter(v=>(index===0?v>=bin.min:v>bin.min)&&v<=bin.max).length;
    const describe=(list:Bin[])=>list.map((b,i)=>({...b,count:count(b,i)}));
    const oldTop=old.at(-1)!;
    const topValues=values.filter(v=>v>oldTop.min&&v<=oldTop.max);
    const topColors=new Set(topValues.map(v=>colorFor(v,bins)));
    const entry={node,level,source:fixture.source,capturedAt:fixture.capturedAt,matched:matched.length,unmatched:unmatched.length,
      old:describe(old),natural:describe(bins),oldTopNewColors:topColors.size,
      timingMs:{median:timings[15],p95:timings[28],max:timings.at(-1)}};
    reports.push(entry);
    const title=node+' · '+(level==='city'?'市级':'县级');
    const mapName=node+'-'+level;echarts.registerMap(mapName,atlas as any);
    function map(list:Bin[]){
      const chart=echarts.init(null,undefined,{renderer:'svg',ssr:true,width:840,height:650});
      const data=new Map(matched.map(m=>[m.feature.properties.code,m.record.percent!]));
      chart.setOption({animation:false,geo:{map:mapName,nameProperty:'code',layoutCenter:['50%','50%'],layoutSize:'96%',silent:true,
        itemStyle:{areaColor:NO_DATA,borderColor:'#becdd7',borderWidth:.35},label:{show:false},
        regions:atlas.features.map(f=>({name:f.properties.code,itemStyle:{areaColor:data.has(f.properties.code)?colorFor(data.get(f.properties.code)!,list):NO_DATA}}))}});
      const svg=chart.renderToSVGString();chart.dispose();return svg;
    }
    const legend=(list:Bin[],x:number)=>list.map((b,i)=>{
      const left=x+(i%2)*405,top=785+Math.floor(i/2)*25;
      const label=(i?'>'+pct(b.min):pct(b.min))+' – '+pct(b.max)+' · '+count(b,i)+' 地区';
      return '<rect x="'+left+'" y="'+(top-13)+'" width="20" height="12" rx="2" fill="'+b.color+'"/><text x="'+(left+28)+'" y="'+top+'" font-size="14">'+escape(label)+'</text>';
    }).join('');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1760" height="960" viewBox="0 0 1760 960" style="max-width:100%;height:auto"><rect width="1760" height="960" fill="white"/><g font-family="Microsoft YaHei, sans-serif" fill="#244559">'+
      '<text x="40" y="42" font-size="26" font-weight="bold">'+title+' · 同一份频率数据，染色前后对照</text>'+
      '<text x="40" y="72" font-size="15">匹配 '+matched.length+' 地区 · 原最高红档在新版中分为 '+topColors.size+' 档 · 数据采集 '+escape(capturedLabel)+'</text>'+
      '<text x="40" y="108" font-size="20">旧版：5 档全国分位数</text><text x="920" y="108" font-size="20">新版：9 档自然分组</text>'+
      '<g transform="translate(20 115)">'+map(old)+'</g><g transform="translate(900 115)">'+map(bins)+'</g>'+legend(old,40)+legend(bins,920)+
      '<text x="40" y="930" font-size="14">灰色：未提供 / 未匹配；0 为有效值。频率、地图边界和匹配口径完全相同。图中区间为简写，完整数值见报告表格。</text></g></svg>';
    await writeFile(out+'/'+mapName+'.svg',svg);
    await writeFile(out+'/'+mapName+'.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' · 染色对照</title><style>body{margin:0;background:white}img{display:block;width:100%;height:auto}</style><img src="'+mapName+'.svg" alt="'+title+'：左为旧版，右为新版"></html>');
    const table=(list:ReturnType<typeof describe>)=>'<table><tr><th>档位</th><th>原始频率区间（百分数）</th><th>地区数</th></tr>'+list.map((b,i)=>'<tr><td><i style="background:'+b.color+'"></i>'+(i+1)+'</td><td>'+(i?'(':'[')+(b.min*100)+', '+(b.max*100)+']%</td><td>'+b.count+'</td></tr>').join('')+'</table>';
    sections.push('<section><h2>'+title+'</h2><p>旧最高红档 '+escape(pct(oldTop.min))+'–'+escape(pct(oldTop.max))+' 在新版分为 <b>'+topColors.size+' 档</b>；分档耗时中位数 '+timings[15].toFixed(2)+' ms。</p><img src="'+mapName+'.svg" alt="'+title+'前后对照"/><p><a href="'+mapName+'.svg" download>下载 SVG 对照图</a> · <a href="/ancestry/ytree/'+node+'/branch">打开交互预览</a></p><details><summary>查看完整区间及地区数</summary><div class="tables"><div><h3>旧版</h3>'+table(entry.old)+'</div><div><h3>新版</h3>'+table(entry.natural)+'</div></div></details><p class="source">来源：<a href="'+escape(fixture.source)+'">23魔方公开地域汇总</a> · '+escape(capturedLabel)+' · 未匹配 '+unmatched.length+' 条</p></section>');
    console.log(JSON.stringify({node,level,matched:matched.length,oldTopNewColors:topColors.size,medianMs:timings[15]}));
  }
}
await writeFile(out+'/summary.json',JSON.stringify(reports,null,2));
await writeFile(out+'/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>市县地图染色 · 同源对照报告</title><style>body{font:15px/1.6 "Microsoft YaHei",sans-serif;color:#244559;background:#f2f5f7;margin:0}main{max-width:1760px;margin:auto;padding:24px}section{background:white;padding:24px;margin:24px 0;border-radius:14px}h1{margin:0}img{width:100%;height:auto}.tables{display:flex;gap:32px;flex-wrap:wrap}table{border-collapse:collapse}td,th{padding:8px 12px;border-bottom:1px solid #dde5eb;text-align:left}i{display:inline-block;width:18px;height:12px;margin-right:8px}.source{font-size:12px;color:#6d7e8a}a{color:#205f7e}summary{cursor:pointer}</style><main><h1>市县地图染色：绿 → 黄 → 红</h1><p>同一份全国数据对比 5 档分位数与最多 9 档自然分组。颜色表示本支系内相对高低，跨支系请比较频率数值。保留原始值、重复观测权重及极端值；全国阈值不随籍贯筛选变化。</p>'+sections.join('')+'</main></html>');
