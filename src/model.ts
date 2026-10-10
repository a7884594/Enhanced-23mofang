import {prepareAtlas,supplementaryFeature,missingBoundaryReason} from './geography';
import {ckmeans} from 'simple-statistics';
export interface Region {code:string; name:string; percent:number|null; childItems:Region[]}
export interface Selection {code:string; name?:string}
export interface Snapshot {route:string; node:string; status:'ready'|'loading'|'empty'|'error'; items:Region[]; birthplace:Selection[][]; label:string; error?:string}
export interface County {code:string; name:string; province:string; city:string; path:string[]; percent:number|null}
export interface GeoFeature {type:'Feature'; properties:{code:string;name:string;level:string;path:string[];center?:number[];group?:string;supplement?:string;source?:string;boundaryNote?:string}; geometry:any}
export interface Atlas {type:'FeatureCollection'; features:GeoFeature[]; metadata?:{countyCount:number;createdAt:string;failures:unknown[]}}
export interface Matched {record:County; feature:GeoFeature}
export interface Unmatched {record:County; reason:string}
export const CHANNEL='mofang-county-map/v1';
// Original five anchors, with one rounded RGB midpoint between each pair.
export const COLORS=['#1a9850','#56b458','#91cf60','#c8d876','#fee08b','#fdb772','#fc8d59','#ea5f40','#d73027'];
export const NO_DATA='#e9edf1';
export function routeNode(path:string):string|null {
  const match=/^\/ancestry\/ytree\/([^/]+)\/branch\/?$/.exec(path);
  try {return match?decodeURIComponent(match[1]):null;} catch {return null;}
}
export function copyRegions(input:unknown, depth=0, budget={n:0}):Region[] {
  if(!Array.isArray(input)||depth>3) return [];
  return input.slice(0,5000).flatMap((v:any)=>{
    if(++budget.n>12000 || !v || typeof v!=='object' || !/^\d{2,9}$/.test(String(v.code)) || typeof v.name!=='string') return [];
    return [{code:String(v.code),name:v.name.slice(0,100),percent:typeof v.percent==='number'&&Number.isFinite(v.percent)&&v.percent>=0&&v.percent<=1?v.percent:null,childItems:copyRegions(v.childItems,depth+1,budget)}];
  });
}
export function copySelections(input:unknown):Selection[][] {
  if(!Array.isArray(input))return [];
  return input.slice(0,500).filter(Array.isArray).map(row=>row.slice(0,3).filter(v=>v&&/^\d{1,9}$/.test(String(v.code))).map(v=>({code:String(v.code),name:typeof v.name==='string'?v.name.slice(0,100):''}))).filter(row=>row.length>0);
}
function sameCode(a:string,b:string) {return a===b || a.padEnd(6,'0')===b.padEnd(6,'0');}
export function flatten(items:Region[], selections:Selection[][]=[]):County[] {
  const result:County[]=[];
  function visit(list:Region[], parents:Region[]) {
    for(const region of list) {
      const chain=[...parents,region];
      if(region.childItems.length) visit(region.childItems,chain);
      else if(region.code.length===6 && !region.code.endsWith('00')) {
        const allowed=!selections.length || selections.some(sel=>sel.every((p,i)=>p.code==='0'||(chain[i]&&sameCode(p.code,chain[i].code))));
        if(allowed)result.push({code:region.code,name:region.name,province:parents[0]?.name||'',city:parents.length>1?parents[1].name:'',path:chain.map(r=>r.name),percent:region.percent});
      }
    }
  }
  visit(items,[]);return result;
}
export function flattenCities(items:Region[],selections:Selection[][]=[]):County[] {
  const result:County[]=[];
  const municipalities=new Set(['11','12','31','50']);
  for(const province of items){
    const provinceCode=province.code.slice(0,2);
    const relevant=selections.filter(row=>row[0]?.code==='0'||sameCode(row[0]?.code||'',province.code));
    if(selections.length&&!relevant.length)continue;
    if(municipalities.has(provinceCode)){
      // A municipality is one city. Its citywide value is already supplied by
      // the site; never combine the 市辖区/县 grouping or individual districts.
      result.push({code:provinceCode+'0000',name:province.name,province:province.name,city:province.name,path:[province.name],percent:province.percent});
      continue;
    }
    for(const city of province.childItems){
      if(!(city.code.length===4 || city.code.length===6&&city.code.endsWith('00')))continue;
      if(selections.length&&!relevant.some(row=>!row[1]||row[1].code==='0'||sameCode(row[1].code,city.code)))continue;
      result.push({code:city.code.padEnd(6,'0'),name:city.name,province:province.name,city:city.name,path:[province.name,city.name],percent:city.percent});
    }
  }
  return result;
}
export function matchCounties(records:County[], atlas:Atlas,level:'district'|'city'='district') {
  if(level==='district')atlas=prepareAtlas(records,atlas);
  const label=level==='city'?'市级地区':'区县';
  const features=atlas.features.filter(f=>f.properties.level===level);
  const byCode=new Map(features.map(f=>[f.properties.code,f]));
  const counts=new Map<string,number>(); records.forEach(r=>counts.set(r.code,(counts.get(r.code)||0)+1));
  const matched:Matched[]=[]; const unmatched:Unmatched[]=[];
  for(const record of records) {
    const feature=level==='district'?(supplementaryFeature(record,features)||byCode.get(record.code)):byCode.get(record.code);
    let reason='';
    if(counts.get(record.code)!==1)reason=`重复${label}代码，无法确定唯一频率`;
    else if(level==='city'&&record.name.includes('直辖县级'))reason='省直辖县级汇总，不对应独立的地级市边界';
    else if(!feature)reason=(level==='district'&&missingBoundaryReason(record))||`地图缺少该${label}代码，可能涉及旧区划${level==='city'?'或非市级汇总':''}`;
    else if(record.province&&feature.properties.path[0]!==record.province)reason='代码对应的省份不一致，不能确定边界';
    else if(feature.properties.name!==record.name)reason=`同代码地名不一致（地图：${feature.properties.name}），待核对边界`;
    else if(record.percent===null)reason='网站未提供有效频率';
    if(reason)unmatched.push({record,reason}); else matched.push({record,feature:feature!});
  }
  // Old/new codes or two code systems may point to one polygon. Never let the last value win.
  const targets=new Map<string,number>();for(const m of matched)targets.set(m.feature.properties.code,(targets.get(m.feature.properties.code)||0)+1);
  return {matched:matched.filter(m=>targets.get(m.feature.properties.code)===1),unmatched:[...unmatched,...matched.filter(m=>targets.get(m.feature.properties.code)!==1).map(m=>({record:m.record,reason:'多条网站数据对应同一边界，不能合并或覆盖频率'}))]};
}
export function percentText(value:number|null):string {
  if(value===null||!Number.isFinite(value))return '未提供';
  if(value===0)return '0.00%';
  // Same display threshold as the website (rounded to two percentage decimals).
  return Number((value*100).toFixed(2))<0.01?'<0.01%':`${(value*100).toFixed(2)}%`;
}
export interface Bin {min:number; max:number; color:string; label:string; title?:string}
export function naturalBreaks(values:number[]):Bin[] {
  const sorted=values.filter(v=>Number.isFinite(v)&&v>=0&&v<=1).sort((a,b)=>a-b);
  if(!sorted.length)return [];
  const count=Math.min(COLORS.length,new Set(sorted).size);
  // Preserve repeated observations: each matched administrative region has equal weight.
  const cuts=ckmeans(sorted,count).map(group=>group.at(-1)!);
  const boundaries=[...new Set([sorted[0],...cuts])];
  let decimals=2;
  while(decimals<20&&new Set(boundaries.map(v=>(v*100).toFixed(decimals))).size<boundaries.length)decimals++;
  const useFixed=new Set(boundaries.map(v=>(v*100).toFixed(decimals))).size===boundaries.length;
  const display=(v:number)=>{
    const percent=v*100;
    const formatted=percent.toFixed(decimals);
    // At floating-point limits use the round-trip representation, never collapse boundaries.
    const value=!useFixed||(Number(formatted)===0&&percent!==0)?String(percent):formatted;
    return `${Number(value)!==percent?'≈':''}${value}%`;
  };
  const range=(min:number,max:number,i:number,format:(v:number)=>string)=>
    min===max?format(max):`${i===0?'':'>'}${format(min)}–${format(max)}`;
  return cuts.map((max,i)=>{
    const min=i===0?sorted[0]:cuts[i-1];
    return {min,max,color:COLORS[count===1?4:Math.round(i*8/(count-1))],
      label:range(min,max,i,display),
      title:`${range(min,max,i,v=>`${v*100}%`)}；原始比例 ${i===0?'[':'('}${min}, ${max}]`};
  });
}
export function colorFor(value:number,bins:Bin[]):string {return bins.find((b,i)=>(i===0?value>=b.min:value>b.min)&&value<=b.max)?.color||NO_DATA;}
