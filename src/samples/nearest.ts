import {marker} from '../ancient/model';import type {IO} from '../ancient/engine';import {query} from './service';import type {Provider} from './model';
export interface Hint {found:boolean;ancestor?:string;target?:string;url?:string;distance?:number;checked:number;message:string}
export async function nearest(io:IO,provider:Provider,current:string,ancestors:unknown,signal:AbortSignal):Promise<Hint>{
  if(!Array.isArray(ancestors)||ancestors.length>80||!ancestors.every(a=>marker(a)===a)||ancestors.includes(current)||new Set(ancestors).size!==ancestors.length)throw Error('上游路径无效');
  if(!ancestors.length)return {found:false,checked:0,message:'当前页面未提供该节点的上游链，无法确认最近上游；请在包含父节点的树页面打开此入口。'};
  let checked=0;
  for(const ancestor of ancestors.slice(0,8)){
    if(signal.aborted)throw Error('已取消');checked++;
    try{const r=await query(io,provider,ancestor,false,signal);
      if(r.status==='ready')return {found:true,ancestor,target:r.target,url:r.url,distance:checked,checked,message:`最近已核实上游：${ancestor}${ancestor!==r.target?' → '+r.target:''}（沿23魔方页面路径向上${checked}级）。这是上游跳转参考，不是当前节点的等价对应；不导入其样本或数量。`};
      if(r.status==='error')return {found:false,checked,message:'较近上游查询失败，无法确认最近对应；未跳过它推定更远节点。'};
    }catch(e){if(signal.aborted)throw e;return {found:false,checked,message:`核查${ancestor}时停止：${String(e)}。无法确认最近上游。`};}
  }
  return {found:false,checked,message:`已核查最近${checked}级，尚未找到可确认对应的上游。${ancestors.length>8?'每次最多核查8级，以限制请求量。':''}`};
}
