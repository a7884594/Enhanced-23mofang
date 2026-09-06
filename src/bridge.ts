import {CHANNEL,copyRegions,copySelections,routeNode,type Snapshot} from './model';

// This MAIN-world script only reads the current page's public geographic summary.
// Never serialize Vue, Nuxt state, account information, or authentication values.
const w=window as any;
if(!w.__mofangCountyBridgeV1) {
  w.__mofangCountyBridgeV1=true;
  let fingerprint=''; let router:any; let component:any; let lastBranch:any;
  let previousNode:string|null=null; let blockedBranch:any; let navigating=false;
  let started=Date.now(); const firstURL=location.pathname+location.search;
  let hasNavigated=false;
  function send(snapshot:Snapshot,force=false) {
    const key=JSON.stringify(snapshot);
    if(force||key!==fingerprint) {fingerprint=key;window.postMessage({channel:CHANNEL,type:'snapshot',snapshot},location.origin);}
  }
  function status(kind:Snapshot['status'],error?:string,force=false) {
    send({route:location.pathname+location.search,node:routeNode(location.pathname)||'',status:kind,items:[],birthplace:[],label:'',error},force);
  }
  function findComponent(root:any) {
    const queue=[root];const seen=new Set();
    while(queue.length&&seen.size<600) {
      const vm=queue.shift();if(!vm||seen.has(vm))continue;seen.add(vm);
      if(!vm._isDestroyed && vm.$data?.branchData && vm.$el?.isConnected && routeNode(vm.$route?.path||'')===routeNode(location.pathname))return vm;
      if(Array.isArray(vm.$children))queue.push(...vm.$children);
    }
    return null;
  }
  function read(force=false) {
    try {
      const root=w.$nuxt;
      if(root?.$router&&router!==root.$router) {
        router=root.$router;
        router.beforeEach((to:any,from:any,next:()=>void)=>{
          try {
            hasNavigated=true;started=Date.now();navigating=true;
            if(routeNode(to.path)!==routeNode(from.path)) blockedBranch=component?.branchData||lastBranch;
            // Clear immediately, even while the browser still shows the previous URL.
            status('loading');
          } finally {next();}
        });
        router.afterEach(()=>{navigating=false;queueMicrotask(()=>read());});
        router.onError?.(()=>{navigating=false;read();});
      }
      const node=routeNode(location.pathname);
      if(!node) {previousNode=null;component=null;lastBranch=null;status('empty',undefined,force);return;}
      if(previousNode!==node) {if(previousNode)blockedBranch=lastBranch;previousNode=node;started=Date.now();}
      if(navigating) {status(Date.now()-started>15000?'error':'loading','页面切换耗时过长，请刷新网页。',force);return;}
      component=findComponent(root);
      let branch=component?.branchData;
      let filters=component?.filterParams;
      if(!branch&&!hasNavigated&&location.pathname+location.search===firstURL) {
        branch=w.__NUXT__?.data?.find((v:any)=>v?.branchData)?.branchData;
        if(!filters)filters=w.__NUXT__?.data?.find((v:any)=>v?.branchData)?.filterParams;
      }
      if(!branch||branch.id!==node||branch===blockedBranch|| (component && component.$route.fullPath.split('#')[0]!==location.pathname+location.search)) {
        status(Date.now()-started>15000?'error':'loading','未能读取当前支系数据，请刷新页面。',force);return;
      }
      lastBranch=branch;
      const items=copyRegions(branch.geographicDistribution?.chartItems);
      const birthplace=copySelections(filters?.birthplace);
      const label=birthplace.map(row=>row.filter(v=>v.code!=='0').map(v=>v.name).filter(Boolean).join(' / ')).join('；');
      send({route:location.pathname+location.search,node,status:items.length?'ready':'empty',items,birthplace,label},force);
    }catch {status('error','页面数据结构发生变化，已保留原地图。',force);}
  }
  window.addEventListener('message',event=>{
    if(event.source===window&&event.origin===location.origin&&event.data?.channel===CHANNEL&&event.data?.type==='request') read(true);
  });
  window.addEventListener('popstate',()=>{started=Date.now();read();});
  window.addEventListener('pageshow',()=>read(true));
  setInterval(()=>{if(!document.hidden)read();},400);
  read();
}
