export interface Region {code:string; name:string; percent:number|null; childItems:Region[]}
export interface Selection {code:string; name?:string}
export interface Snapshot {route:string; node:string; status:'ready'|'loading'|'empty'|'error'; items:Region[]; birthplace:Selection[][]; label:string; error?:string}
export interface County {code:string; name:string; province:string; city:string; path:string[]; percent:number|null}
export interface GeoFeature {type:'Feature'; properties:{code:string;name:string;level:string;path:string[];center?:number[]}; geometry:any}
export interface Atlas {type:'FeatureCollection'; features:GeoFeature[]; metadata?:{countyCount:number;createdAt:string;failures:unknown[]}}
export interface Matched {record:County; feature:GeoFeature}
export interface Unmatched {record:County; reason:string}
export const CHANNEL='mofang-county-map/v1';
export const COLORS=['#1a9850','#91cf60','#fee08b','#fc8d59','#d73027'];
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
export function matchCounties(records:County[], atlas:Atlas) {
  const byCode=new Map(atlas.features.filter(f=>f.properties.level==='district').map(f=>[f.properties.code,f]));
  const counts=new Map<string,number>(); records.forEach(r=>counts.set(r.code,(counts.get(r.code)||0)+1));
  const matched:Matched[]=[]; const unmatched:Unmatched[]=[];
  for(const record of records) {
    const feature=byCode.get(record.code);
    let reason='';
    if(counts.get(record.code)!==1)reason='重复区县代码，无法确定唯一频率';
    else if(!feature)reason='地图缺少该代码，可能涉及旧区划';
    else if(feature.properties.name!==record.name)reason=`同代码地名不一致（地图：${feature.properties.name}），待核对边界`;
    else if(record.percent===null)reason='网站未提供有效频率';
    if(reason)unmatched.push({record,reason}); else matched.push({record,feature:feature!});
  }
  return {matched,unmatched};
}
export function percentText(value:number|null):string {
  if(value===null||!Number.isFinite(value))return '未提供';
  if(value===0)return '0.00%';
  // Same display threshold as the website (rounded to two percentage decimals).
  return Number((value*100).toFixed(2))<0.01?'<0.01%':`${(value*100).toFixed(2)}%`;
}
export interface Bin {min:number; max:number; color:string; label:string}
export function quantiles(values:number[]):Bin[] {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return [];
  const last=sorted.at(-1)!; const cuts:number[]=[];
  for(let i=1;i<5;i++) {
    const pos=(sorted.length-1)*i/5, low=Math.floor(pos);
    const value=sorted[low]+(sorted[Math.ceil(pos)]-sorted[low])*(pos-low);
    if(value<last && !cuts.includes(value))cuts.push(value);
  }
  cuts.push(last);
  const text=(v:number)=>`${Number((v*100).toPrecision(5))}%`;
  return cuts.map((max,i)=>({min:i===0?sorted[0]:cuts[i-1],max,color:COLORS[cuts.length===1?2:Math.round(i*4/(cuts.length-1))],label:i===0?(sorted[0]===max?text(max):`${text(sorted[0])}–${text(max)}`):`>${text(cuts[i-1])}–${text(max)}`}));
}
export function colorFor(value:number,bins:Bin[]):string {return bins.find((b,i)=>(i===0?value>=b.min:value>b.min)&&value<=b.max)?.color||NO_DATA;}
