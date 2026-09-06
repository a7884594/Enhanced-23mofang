import {marker} from '../ancient/model';
import {loadMatch} from '../ancient/node-match';
import {resolveTarget} from '../ancient/aliases';
import type {IO} from '../ancient/engine';
import {yfull,ftdna,theytree} from './adapters';
import {providers,rootName,treeLink,type Provider,type Result} from './model';
const TTL=7*86400000;
export async function query(io:IO,provider:Provider,value:string,refresh:boolean,signal:AbortSignal,more=false):Promise<Result>{
  const name=marker(value);if(!name||!providers.includes(provider))throw Error('无效支系或来源');
  let target=name,mapping='同名标记对应；挂载关系以该来源为准';
  if(provider==='theytree'){const known=await loadMatch(io,name);target=known?.target||resolveTarget(name).target;if(target!==name)mapping='复用TheYtree已核实对应；不推及其他来源';}
  const key=`samples.v1.${provider}.${name}.${target}`;const cached=await io.get(key);
  if(!refresh&&cached?.status==='ready'&&cached.updatedAt<=io.now()&&io.now()-cached.updatedAt<TTL){
    if(!more)return {...cached,cached:true};
    const result:Result=structuredClone(cached);result.cached=false;
    for(const pending of result.nodes.filter(n=>n.pending).slice(0,8)){
      if(provider==='theytree'&&!pending.sourceId)continue;
      const url=provider==='theytree'?`https://www.theytree.com/api/ysnp/theytree/node/?hid=${pending.sourceId}`:provider==='yfull'?treeLink(provider,pending.name):`https://discover.familytreedna.com/resources/classictree-y/${encodeURIComponent(pending.name)}.json`;
      try{
        const r=await io.request(url,signal);if(signal.aborted)throw Error('已取消');if(r.status!==200)throw Error(`HTTP ${r.status}`);if(r.body.length>8_000_000||new URL(r.url).origin!==new URL(url).origin)throw Error('响应范围或大小异常');
        const children=provider==='yfull'?yfull(r.body):provider==='ftdna'?ftdna(JSON.parse(r.body)):theytree(JSON.parse(r.body));const own=children.find(n=>n.name===pending.name);if(!own)throw Error('子树未确认节点');
        if(children.length===1&&own.pending)throw Error('源站未提供更多可读下游');
        const merged=new Map(result.nodes.map(n=>[n.name,n]));for(const n of children){const old=merged.get(n.name);merged.set(n.name,{...n,parent:n.parent||old?.parent||''});}if(merged.size>15000)throw Error('支系过大，请缩小范围');result.nodes=[...merged.values()];
        result.message='已继续加载最多8个子树；可再次继续';
      }catch(e){if(signal.aborted)throw e;result.message=`部分读取停止：${String(e)}。保留已取得数据`;break;}
    }
    result.complete=result.nodes.every(n=>!n.pending);result.updatedAt=io.now();if(signal.aborted)throw Error('已取消');await io.set(key,result);return result;
  }
  const url=treeLink(provider,target),base:Result={provider,marker:name,target,url,mapping,nodes:[],updatedAt:io.now(),complete:false,status:'error',message:''};
  const request=provider==='ftdna'?`https://discover.familytreedna.com/resources/classictree-y/${encodeURIComponent(target)}.json`:provider==='theytree'?`https://www.theytree.com/api/ysnp/theytree/?haplogroup=${encodeURIComponent(target)}`:url;
  const response=await io.request(request,signal);if(signal.aborted)throw Error('已取消');
  if(response.status===404)return {...base,status:'unmatched',message:'该来源未找到同名节点，不代表没有样本'};
  if(response.status!==200)throw Error(`来源访问失败（HTTP ${response.status}），未记为0条`);
  if(new URL(response.url).origin!==new URL(request).origin)throw Error('源站跳转到其他域名，未读取数据');
  if(response.body.length>8_000_000)throw Error('树页面过大，请查询更小支系');
  const raw=provider==='yfull'?null:JSON.parse(response.body);
  const nodes=provider==='yfull'?yfull(response.body):provider==='ftdna'?ftdna(raw):theytree(raw);
  let root=nodes.find(n=>n.name===target);
  if(!root){
    const snp=target.includes('-')?target.slice(target.indexOf('-')+1):'';
    const candidates=snp?nodes.filter(n=>!n.name.endsWith('*')&&n.name.split('-')[0]===target.split('-')[0]&&n.snps.includes(snp)):[];
    if(candidates.length===1){root=candidates[0];target=root.name;mapping=`源站本节点SNP列表包含${snp}；${name} → ${target}`;}
  }
  if(!root)return {...base,status:'unmatched',message:'返回页面未确认当前节点；不能套用其他节点的样本'};
  const result:Result={...base,target,url:treeLink(provider,target),mapping,nodes,updatedAt:io.now(),status:'ready',complete:nodes.every(n=>!n.pending),message:'已读取源站公开树；未跨站合并人数',modernAvailable:provider==='ftdna'?raw.modern_display!==false:undefined,ancientAvailable:provider==='ftdna'?raw.ancient_display!==false:undefined};
  if(signal.aborted)throw Error('已取消');await io.set(key,result);return result;
}
