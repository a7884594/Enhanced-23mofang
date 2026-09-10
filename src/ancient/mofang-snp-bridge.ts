import {lookupMofang,MOFANG_SNP_CHANNEL,matchingMofangNodes,reportTreeSnps,type MofangNode} from './mofang-snp-result';import {snp} from './snps';import {marker} from './model';
let busy=false;
export function reportScope(state:any){
  const barcode=typeof state?.sct?.currentReportBarcode==='string'?state.sct.currentReportBarcode:'';
  const loggedIn=state?.authed===true;
  const accountId=typeof state?.user?.user?.id==='string'||typeof state?.user?.user?.id==='number'?String(state.user.user.id):'';
  return {barcode,accountId,loggedIn,allowed:loggedIn&&!!barcode&&!state?.sct?.sampleFlag&&!state?.share?.isShareUrl};
}
export function collectMofangContext(doc:Document,nuxt:any,allowReport:boolean,query:string,owner?:unknown){
  const nodes:MofangNode[]=[],details:{id:string;values:unknown[]}[]=[];
  const add=(data:any,label?:string|null)=>{const id=marker(data?.id);if(!id||label!==undefined&&marker(label)!==id)return;nodes.push({id,rsids:Array.isArray(data.rsids)?data.rsids.slice(0,5000):[]});};
  const selector=allowReport?'.tree-wrapper g.node, .gene-origin-tree g.node':'.tree-wrapper g.node';
  for(const n of doc.querySelectorAll(selector)){
    if(n.querySelector(':scope > .person-container'))continue;
    add((n as any).__data__?.data,n.querySelector(':scope > text.label, :scope > text.nodeText')?.textContent);
  }
  const queue=[nuxt],seen=new Set();
  while(queue.length&&seen.size<600){const vm=queue.shift();if(!vm||seen.has(vm))continue;seen.add(vm);
    if(vm.$el?.isConnected&&!vm._isDestroyed){
      const pending=[vm.$data?.treeData,vm.$data?.branchData],visited=new Set();
      while(pending.length&&visited.size<150000){const n=pending.pop();if(!n||visited.has(n))continue;visited.add(n);add(n);if(Array.isArray(n.children))pending.push(...n.children);}
      if(allowReport){const d=vm.$data?.haploidDetail;const id=marker(d?.haplogroup)||marker(vm.$data?.haploidDetailPoint?.data?.id)||'';
        details.push({id,values:[...(Array.isArray(d?.nodeRsIds)?d.nodeRsIds.slice(0,5000):[]),...(Array.isArray(d?.matchList)?d.matchList.slice(0,5000):[])]});}
    }
    if(Array.isArray(vm.$children))queue.push(...vm.$children);
  }
  const matches=matchingMofangNodes(nodes,query,owner);
  // A selected node must not consume a similarly named SNP from another detail panel.
  const values=[...matches.flatMap(n=>n.rsids),...details.filter(d=>!matches.length||matches.length===1&&(!d.id||d.id===matches[0].id)).flatMap(d=>d.values)];
  return {nodes,values};
}
if(typeof window!=='undefined')window.addEventListener('message',async e=>{
  const d=e.data;if(e.source!==window||e.origin!==location.origin||d?.channel!==MOFANG_SNP_CHANNEL||d.type!=='query'||typeof d.request!=='string')return;
  const query=snp(d.query);if(!query)return;const route=location.href;
  const send=(data:object)=>{if(location.href===route)window.postMessage({channel:MOFANG_SNP_CHANNEL,type:'result',query,request:d.request,route,...data},location.origin);};
  if(busy){send({error:'前一个23魔方查询仍在进行，请稍后重试'});return;}busy=true;
  const scope=reportScope((window as any).$nuxt?.$store?.state);
  const unchanged=()=>JSON.stringify(reportScope((window as any).$nuxt?.$store?.state))===JSON.stringify(scope)&&location.href===route;
  try{
    const api=(window as any).$nuxt?.$api?.ancestry;
    const report=scope.allowed&&typeof api?.postHaploidDetail==='function'?async(node:string)=>{
      if(!unchanged())throw Error('报告已切换');
      // Use only the currently selected report through the site's own client.
      // The barcode stays in MAIN and goes only to 23mofang; no family/relative request.
      const value=await api.postHaploidDetail({haplogroup:node,barcode:scope.barcode,show_clan_relation:false});
      if(!unchanged())throw Error('报告已切换');return value;
    }:undefined;
    const context=collectMofangContext(document,(window as any).$nuxt,scope.allowed,query,d.owner);
    const reportTree=scope.allowed&&typeof api?.getSimpleTree==='function'?async(node:string)=>{
      if(!unchanged())throw Error('报告已切换');
      // Same current-report tree used by the native report page. No to_barcode,
      // relative lookup, persistent cache, or report object crosses the bridge.
      const response=await api.getSimpleTree(scope.barcode);
      if(!unchanged())throw Error('报告已切换');
      return reportTreeSnps(response,node,query);
    }:undefined;
    const result=await lookupMofang(query,api,context.values,report,{nodes:context.nodes,owner:d.owner,reportTree});
    if(!unchanged()){send({error:'账号或检测报告已切换，请重新查询'});return;}
    if(result.status==='unsupported'&&!scope.loggedIn){result.status='login';result.message='请先登录23魔方并选择当前检测报告，再尝试位置查询；也可切换到TheYtree。';}
    if(result.status==='unsupported'&&scope.loggedIn&&!scope.allowed)result.message=scope.barcode?'当前是示例或分享报告，未进行账号位置补查；请切换到自己的当前检测报告。':'请先在23魔方选择当前检测报告，再返回这里查询；未自动选择其他人的报告。';
    send({result});
  }catch{send({error:unchanged()?'23魔方后台查询失败，可能需要登录、服务不支持或网络暂时异常；不会自动打开网页':'账号或检测报告已切换，请重新查询'});}finally{busy=false;}
});
