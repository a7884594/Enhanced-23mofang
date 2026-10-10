import {NODE_FILTER_CHANNEL,NODE_FILTER_PARAM,normalizeThreshold,routeThreshold,isTreePath,type NodeFilterState} from './node-filter-shared';

type VM=any;
interface Binding {vm:VM;owner:VM;content:HTMLElement;id:string;restore:()=>void}
const routeKey=(w:Window)=>w.location.pathname+w.location.search+w.location.hash;
const treePath=(path:string)=>isTreePath(path.split(/[?#]/)[0]);
function descriptor(object:any,name:string):PropertyDescriptor|undefined {
  for(let current=object;current;current=Object.getPrototypeOf(current)){
    const found=Object.getOwnPropertyDescriptor(current,name);if(found)return found;
  }
}
function findComponent(content:HTMLElement):{vm:VM;owner:VM}|null {
  const queue:VM[]=[],seen=new Set<VM>();
  for(let el:HTMLElement|null=content;el;el=el.parentElement)if((el as any).__vue__)queue.push((el as any).__vue__);
  while(queue.length&&seen.size<300){
    const vm=queue.shift();if(!vm||seen.has(vm))continue;seen.add(vm);
    if(vm.$el?.contains(content)&&typeof vm.$emit==='function'&&typeof vm.handleSubmit==='function'&&typeof vm.handleReset==='function'&&typeof vm.handleClose==='function'&&typeof vm.$forceUpdate==='function'&&
      ['surnames','birthplace','nations','provinces'].every(key=>Array.isArray(vm[key]))&&descriptor(vm,'canSubmit')?.get){
      let owner=vm.$parent;
      while(owner){
        if(typeof owner.handleFilter==='function'&&typeof owner.handleFilterReset==='function'&&typeof owner.handleResetNode==='function'&&typeof owner.$router?.beforeEach==='function'&&typeof owner.$router?.afterEach==='function')return {vm,owner};
        owner=owner.$parent;
      }
    }
    if(Array.isArray(vm.$children))queue.push(...vm.$children);
  }
  return null;
}

/** Page-local Vue adapter. Only an enabled isolated script can activate it. */
export function installNodeFilterController(w:Window,apply:(value:number)=>void):()=>void {
  let enabled=false,disposed=false,binding:Binding|null=null,router:VM=null;
  let unregister:Array<()=>void>=[],serial=0,commandSequence=0,navigating=false;
  const unsupported=new WeakSet<object>();
  let state:NodeFilterState={route:routeKey(w),epoch:0,revision:0,componentId:'',draft:0,applied:0,status:'inactive',error:''};
  let lastPublished='';
  function publish(force=false){
    const key=JSON.stringify({...state,revision:0});if(!force&&key===lastPublished)return;
    lastPublished=key;state.revision++;
    w.postMessage({channel:NODE_FILTER_CHANNEL,type:'state',state:{...state}},w.location.origin);
  }
  function invalidate(){state.epoch++;commandSequence=0;state.error='';}
  function deactivate(status:NodeFilterState['status']){
    state.applied=0;state.status=status;apply(0);
  }
  function detach(){binding?.restore();binding=null;state.componentId='';}
  function syncRoute(){
    const next=routeKey(w);
    if(next!==state.route){invalidate();state.route=next;state.draft=routeThreshold(new URL(w.location.href));}
    if(navigating)return;
    if(!isTreePath(w.location.pathname)){detach();state.draft=0;deactivate('inactive');publish();return;}
    scan();
  }
  function connectRouter(next:VM){
    if(router===next)return;
    unregister.forEach(off=>off());unregister=[];router=next;
    const before=router.beforeEach((to:VM,from:VM,proceed:Function)=>{
      if(enabled&&to.fullPath!==from.fullPath){navigating=true;invalidate();state.draft=0;deactivate('navigating');publish();}
      proceed();
    });
    const after=router.afterEach(()=>{
      if(!enabled)return;navigating=false;invalidate();state.route=routeKey(w);state.draft=routeThreshold(new URL(w.location.href));
      detach();syncRoute();
    });
    if(typeof before==='function')unregister.push(before);
    if(typeof after==='function')unregister.push(after);
  }
  function destination(query:Record<string,unknown>,value:number){
    const next={...query};delete next[NODE_FILTER_PARAM];
    if(value>0)next[NODE_FILTER_PARAM]=String(value);
    return {path:w.location.pathname,query:next,hash:w.location.hash};
  }
  function navigate(target:VM,replace:boolean){
    const active=binding;if(!active)return;
    invalidate();let epoch=state.epoch;
    const recover=(error?:unknown)=>{
      if(disposed||epoch!==state.epoch)return;
      navigating=false;state.route=routeKey(w);state.draft=routeThreshold(new URL(w.location.href));
      if(error&&(error as any)?.name!=='NavigationDuplicated')state.error='筛选网址更新失败，请重试。';
      syncRoute();
    };
    try{
      const result=active.owner.$router[replace?'replace':'push'](target);
      epoch=state.epoch;
      Promise.resolve(result).then(()=>{
        if(disposed)return;
        if(state.epoch===epoch){recover();active.owner.$nuxt?.refresh?.();}
      },recover);
    }catch(error){recover(error);}
  }
  function readDraft(active:Binding){
    const input=active.content.querySelector<HTMLInputElement>('[data-mofang-node-filter] input');
    if(input)state.draft=normalizeThreshold(input.value);
    return state.draft;
  }
  function intercept(active:Binding,event:string,args:any[],original:Function){
    if(binding!==active||navigating||state.route!==routeKey(w)||!enabled)return original.apply(active.vm,[event,...args]);
    if(event==='submit'){
      const value=readDraft(active),payload=args[0];
      if(!payload||!['surnames','birthplace','nations'].every(key=>Array.isArray(payload[key]))){
        unsupported.add(active.vm);deactivate('unavailable');state.error='人数筛选暂不可用，官方筛选仍可使用。';publish();return original.apply(active.vm,[event,...args]);
      }
      if(!value&&!new URL(w.location.href).searchParams.has(NODE_FILTER_PARAM))return original.apply(active.vm,[event,...args]);
      const native={surnames:payload.surnames,birthplace:payload.birthplace,nations:payload.nations};
      const query={...active.owner.$route.query};
      if(Object.values(native).some(list=>list.length))query.filterParams=JSON.stringify(native);else delete query.filterParams;
      navigate(destination(query,value),!!active.owner.$route.query.filterParams||routeThreshold(new URL(w.location.href))>0);
      return active.vm;
    }
    if(event==='reset'){
      const hadParameter=new URL(w.location.href).searchParams.has(NODE_FILTER_PARAM);
      invalidate();state.draft=0;state.applied=0;apply(0);publish();active.vm.$forceUpdate();
      if(hadParameter){const query={...active.owner.$route.query};delete query.filterParams;navigate(destination(query,0),true);return active.vm;}
    }
    return original.apply(active.vm,[event,...args]);
  }
  function bind(vm:VM,owner:VM,content:HTMLElement){
    detach();invalidate();state.draft=routeThreshold(new URL(w.location.href));
    const id=String(++serial),originalEmit=vm.$emit,own=Object.getOwnPropertyDescriptor(vm,'canSubmit'),native=descriptor(vm,'canSubmit')!;
    const active:Binding={vm,owner,content,id,restore:()=>{}};
    const emit=function(this:VM,event:string,...args:any[]){return intercept(active,event,args,originalEmit);};
    Object.defineProperty(vm,'canSubmit',{configurable:true,enumerable:true,get:()=>native.get!.call(vm)||(binding===active&&(state.draft>0||state.draft!==state.applied))});
    vm.$emit=emit;content.dataset.mofangFilterOwner=id;
    // Official breadcrumb/subtree navigation intentionally carries native filters.
    // Carry our independent query in those actions only, not in arbitrary router navigation.
    const originalResetNode=owner.handleResetNode;
    const resetNode=function(this:VM,node:string,query=''){
      if(binding!==active||!state.applied||!treePath(w.location.pathname))return originalResetNode.call(this,node,query);
      const params=new URLSearchParams(query.replace(/^\?/,''));params.set(NODE_FILTER_PARAM,String(state.applied));
      return originalResetNode.call(this,node,'?'+params.toString());
    };
    owner.handleResetNode=resetNode;
    active.restore=()=>{
      if(vm.$emit===emit)vm.$emit=originalEmit;
      if(own)Object.defineProperty(vm,'canSubmit',own);else delete vm.canSubmit;
      if(owner.handleResetNode===resetNode)owner.handleResetNode=originalResetNode;
      delete content.dataset.mofangFilterOwner;
      if(trigger?.dataset.mofangFilterTrigger===id)delete trigger.dataset.mofangFilterTrigger;
      if(!vm._isDestroyed)vm.$forceUpdate();
    };
    binding=active;state.componentId=id;
    const trigger=Array.from(owner.$el?.querySelectorAll('button')||[]).find((button:any)=>button.textContent?.trim().startsWith('筛选')) as HTMLElement|undefined;
    if(trigger)trigger.dataset.mofangFilterTrigger=id;
    connectRouter(owner.$router);vm.$forceUpdate();
  }
  function scan(){
    if(!enabled||disposed||navigating)return;
    if(state.route!==routeKey(w)||!isTreePath(w.location.pathname)){syncRoute();return;}
    const content=w.document.querySelector<HTMLElement>('.node-filter-content');
    const found=content?findComponent(content):null;
    if(!content||!found||found.vm._isDestroyed||unsupported.has(found.vm)){detach();deactivate('unavailable');publish();return;}
    if(binding?.vm!==found.vm||binding?.content!==content||found.vm._isDestroyed)bind(found.vm,found.owner,content);
    const next=routeThreshold(new URL(w.location.href));
    if(state.applied!==next||state.status!=='ready'){state.applied=next;state.status='ready';apply(next);}
    publish();
  }
  const onMessage=(event:MessageEvent)=>{
    if(event.source!==w||event.origin!==w.location.origin||event.data?.channel!==NODE_FILTER_CHANNEL)return;
    const message=event.data;
    if(message.type==='request'){
      if(!enabled){enabled=true;state.draft=routeThreshold(new URL(w.location.href));}
      syncRoute();publish(true);return;
    }
    if(!enabled||navigating||state.status!=='ready'||!binding||message.route!==state.route||state.route!==routeKey(w)||message.epoch!==state.epoch||message.componentId!==binding.id||!Number.isSafeInteger(message.sequence)||message.sequence<=commandSequence)return;
    commandSequence=message.sequence;
    if(message.type==='draft'){state.draft=normalizeThreshold(message.value);binding.vm.$forceUpdate();publish();}
    if(message.type==='clear')navigate(destination(binding.owner.$route.query,0),true);
  };
  w.addEventListener('message',onMessage);
  const Observer=(w as Window&{MutationObserver:typeof MutationObserver}).MutationObserver;
  let scheduled=false;
  const observer=new Observer(()=>{if(!enabled||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;scan();});});
  observer.observe(w.document,{childList:true,subtree:true});
  const timer=w.setInterval(()=>{if(enabled)syncRoute();},300);
  const dispose=()=>{if(disposed)return;disposed=true;enabled=false;observer.disconnect();w.clearInterval(timer);w.removeEventListener('message',onMessage);w.removeEventListener('pagehide',onHide);unregister.forEach(off=>off());detach();apply(0);};
  const onHide=(event:PageTransitionEvent)=>{if(!event.persisted)dispose();};
  w.addEventListener('pagehide',onHide);
  return dispose;
}
