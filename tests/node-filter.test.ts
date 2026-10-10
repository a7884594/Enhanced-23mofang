import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {normalizeThreshold,NODE_FILTER_CHANNEL,routeThreshold} from '../src/node-filter-shared';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const ui=(await build({entryPoints:['src/node-filter.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const bridge=(await build({entryPoints:['src/node-filter-bridge.ts'],bundle:true,write:false,format:'iife'})).outputFiles[0].text;
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));

function harness(query='',supported=true,cleanupFails=false,enabled=true){
  const dom=new JSDOM('<body><main><button id="trigger">筛选</button><div id="filter"><section class="node-filter-container"><div class="node-filter-content"></div><button id="reset">重置</button><button id="confirm">确定</button><button id="close">关闭</button></section></div><div class="tree-wrapper"><svg class="overlay" height="220"><g id="root" class="node" transform="translate(0,0)"></g><g id="small" class="node" transform="translate(50,50)"></g><g id="large" class="node" transform="translate(50,100)"></g></svg></div></main></body>',{url:'https://www.23mofang.com/ancestry/ytree/O-F2758'+query,runScripts:'outside-only'});
  const w=dom.window as any,d=w.document;
  const states:any[]=[],removed:string[]=[],requests:any[]=[],navigations:any[]=[];
  w.chrome={storage:{local:{get:async()=>{throw Error('must not read legacy state');},set:async()=>{throw Error('must not persist threshold');},remove:async(key:string)=>{removed.push(key);if(cleanupFails)throw Error('storage unavailable');}}}};
  w.postMessage=(data:any)=>queueMicrotask(()=>{if(!w.document)return;if(data.type==='state')states.push(data.state);w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data}));});
  const before:Function[]=[],after:Function[]=[];let pending:(()=>void)|null=null;
  const readRoute=()=>({path:w.location.pathname,query:Object.fromEntries(new URL(w.location.href).searchParams),hash:w.location.hash,fullPath:w.location.pathname+w.location.search+w.location.hash,params:{id:w.location.pathname.split('/').at(-1)}});
  const owner:any={$el:d.querySelector('main'),$route:readRoute(),$parent:null,$children:[],useFilter:false};
  const router:any={delay:false,fail:false,beforeEach:(f:Function)=>{before.push(f);return()=>before.splice(before.indexOf(f),1);},afterEach:(f:Function)=>{after.push(f);return()=>after.splice(after.indexOf(f),1);}};
  function navigate(target:any,replace=false){
    const dest=typeof target==='string'?new URL(target,w.location.origin):new URL(target.path,w.location.origin);
    if(typeof target!=='string'){for(const [key,value]of Object.entries(target.query||{}))if(value!=null)dest.searchParams.set(key,String(value));dest.hash=target.hash||'';}
    const to={fullPath:dest.pathname+dest.search+dest.hash},from=owner.$route;
    navigations.push({url:dest.href,replace});before.slice().forEach(f=>f(to,from,()=>{}));
    return new Promise<void>((resolve,reject)=>{
      const finish=()=>{
        if(router.fail){router.fail=false;reject(Error('navigation failed'));return;}
        w.history[replace?'replaceState':'pushState']({},'',dest.href);owner.$route=readRoute();owner.useFilter=!!owner.$route.query.filterParams;
        if(owner.$route.query.filterParams)requests.push(JSON.parse(owner.$route.query.filterParams));
        after.slice().forEach(f=>f(owner.$route,from));resolve();
      };
      if(router.delay)pending=finish;else queueMicrotask(finish);
    });
  }
  router.push=(target:any)=>navigate(target);router.replace=(target:any)=>navigate(target,true);owner.$router=router;
  owner.$nuxt={refresh:()=>{requests.push(owner.$route.query.filterParams?JSON.parse(owner.$route.query.filterParams):{});}};
  owner.handleFilter=(payload:any)=>router.push({path:w.location.pathname,query:{...owner.$route.query,filterParams:JSON.stringify(payload)}});
  owner.handleFilterReset=()=>{const query={...owner.$route.query};delete query.filterParams;return router.replace({path:w.location.pathname,query});};
  owner.handleResetNode=(node:string,query='')=>router.push('/ancestry/ytree/'+node+query);
  const vm:any={$el:d.querySelector('#filter'),$parent:owner,$children:[],surnames:[],birthplace:[],nations:[],provinces:[],visible:true,_isDestroyed:false};
  Object.defineProperty(vm,'canSubmit',{configurable:true,get:()=>vm.surnames.length>0||vm.provinces.length>0||vm.nations.length>0});
  vm.$forceUpdate=()=>{d.querySelector('#confirm').disabled=!vm.canSubmit;};
  vm.$emit=function(event:string,payload:any){if(event==='submit')owner.handleFilter(payload);if(event==='reset')owner.handleFilterReset();if(event==='close')vm.visible=false;return vm;};
  vm.handleSubmit=()=>{vm.$emit('submit',{surnames:vm.surnames,birthplace:vm.birthplace,nations:vm.nations});vm.handleClose();};
  vm.handleReset=()=>{vm.surnames=[];vm.birthplace=[];vm.nations=[];vm.provinces=[];vm.$emit('reset');};
  vm.handleClose=()=>vm.$emit('close');
  owner.$children=[vm];if(supported)d.querySelector('#filter').__vue__=vm;
  d.querySelector('#confirm').onclick=()=>vm.handleSubmit();d.querySelector('#reset').onclick=()=>vm.handleReset();d.querySelector('#close').onclick=()=>vm.handleClose();
  const root=d.querySelector('#root');root.__data__={x:0,y:0,data:{clanRelationCount:100},parent:null};
  d.querySelector('#small').__data__={x:50,y:50,data:{clanRelationCount:2},parent:root.__data__};
  d.querySelector('#large').__data__={x:50,y:100,data:{clanRelationCount:8},parent:root.__data__};
  w.addEventListener('popstate',()=>{const from=owner.$route,to=readRoute();before.slice().forEach(f=>f(to,from,()=>{}));owner.$route=to;after.slice().forEach(f=>f(to,from));});
  w.eval(bridge);if(enabled)w.eval(ui);
  return {w,d,vm,owner,router,states,removed,requests,navigations,close:()=>{w.dispatchEvent(new w.PageTransitionEvent('pagehide'));dom.window.close();},finish:()=>{pending?.();pending=null;},
    input:()=>d.querySelector('[data-mofang-node-filter] input') as HTMLInputElement,
    edit(value:string){const input=d.querySelector('[data-mofang-node-filter] input');input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));},
    hidden:()=>d.querySelector('#small').style.display==='none',
    message(data:any){w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{channel:NODE_FILTER_CHANNEL,...data}}));}
  };
}

test('threshold normalization rejects unsafe and malformed values',()=>{
  for(const value of ['',-1,'abc',Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert.equal(normalizeThreshold(value),0);
  assert.equal(normalizeThreshold('7.8'),7);assert.equal(normalizeThreshold('12'),12);
  assert.equal(routeThreshold(new URL('https://www.23mofang.com/ancestry/ytree/O-F8?mofangMinSamples=5&mofangMinSamples=8')),0);
  assert.equal(routeThreshold(new URL('https://www.23mofang.com/ancestry/ytree/O-F8/branch?mofangMinSamples=5')),0);
});
test('editing is draft-only, closing retains draft, and confirm commits one URL',async()=>{
  const h=harness();try{await tick();assert.equal(h.input().value,'0');h.edit('5');await tick();assert.equal(h.hidden(),false);assert.equal(h.navigations.length,0);assert.equal(h.d.querySelector('#confirm').disabled,false);
    h.vm.handleClose();h.vm.visible=true;assert.equal(h.input().value,'5');assert.equal(h.hidden(),false);
    h.d.querySelector('#confirm').click();await tick();assert.equal(h.hidden(),true);assert.equal(h.navigations.length,1);assert.equal(new URL(h.w.location.href).searchParams.get('mofangMinSamples'),'5');assert.equal(new URL(h.w.location.href).searchParams.has('filterParams'),false);assert.match(h.d.querySelector('[data-mofang-filter-chip]').textContent,/≥ 5/);assert.deepEqual(h.removed,['mofang.nodeFilter.v1']);
  }finally{h.close();}
});
test('URL-only hydration isolates tabs and ignores legacy storage even when cleanup fails',async()=>{
  const a=harness('?mofangMinSamples=5'),b=harness('',true,true),c=harness('?mofangMinSamples=5');try{await tick();assert.equal(a.hidden(),true);assert.equal(b.hidden(),false);assert.equal(c.hidden(),true);assert.equal(b.input().value,'0');}finally{a.close();b.close();c.close();}
});
test('native and extension conditions commit together without sending threshold to native API',async()=>{
  const h=harness('?end=O-F8');try{await tick();h.vm.surnames=['陈'];h.vm.nations=['汉族'];h.vm.birthplace=[[{code:'45',name:'广西'}]];h.edit('5');await tick();h.vm.handleSubmit();await tick();assert.equal(h.navigations.length,1);assert.equal(h.requests.length,1);assert.deepEqual(h.requests[0],{surnames:['陈'],birthplace:[[{code:'45',name:'广西'}]],nations:['汉族']});assert.equal(new URL(h.w.location.href).searchParams.get('end'),'O-F8');
    h.d.querySelector('[aria-label="清除宗亲人数筛选"]').click();await tick();assert.equal(h.hidden(),false);assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1],h.requests[0]);assert.equal(new URL(h.w.location.href).searchParams.has('mofangMinSamples'),false);
  }finally{h.close();}
});
test('reset clears both conditions immediately and old edits cannot reactivate after redraw',async()=>{
  const h=harness('?mofangMinSamples=5&filterParams='+encodeURIComponent(JSON.stringify({surnames:['陈'],birthplace:[],nations:[]})));try{await tick();const old=h.states.at(-1);assert.equal(h.hidden(),true);h.router.delay=true;h.vm.handleReset();assert.equal(h.hidden(),false);await tick();
    h.message({type:'draft',route:old.route,epoch:old.epoch,componentId:old.componentId,sequence:999,value:100});h.finish();await tick();
    const node=h.d.querySelector('#small');node.setAttribute('transform','translate(50,50)');h.d.querySelector('svg').setAttribute('height','220');await tick();assert.equal(h.hidden(),false);assert.equal(h.input().value,'0');assert.equal(h.w.location.search,'');assert.equal(h.d.querySelector('[data-mofang-filter-chip]'),null);assert.equal(node.getAttribute('transform'),'translate(50,50)');
  }finally{h.close();}
});
test('extension-only reset and zero submission remove URL condition',async()=>{
  for(const reset of [true,false]){const h=harness('?mofangMinSamples=5');try{await tick();if(reset)h.vm.handleReset();else{h.edit('0');await tick();assert.equal(h.d.querySelector('#confirm').disabled,false);h.vm.handleSubmit();}await tick();assert.equal(h.hidden(),false);assert.equal(h.w.location.search,'');assert.equal(h.input().value,'0');}finally{h.close();}}
});
test('tree navigation retains filter, plain route clears it, and browser history restores URL state',async()=>{
  const h=harness('?mofangMinSamples=5');try{await tick();await h.owner.handleResetNode('O-F2890','?end=O-F8');await tick();assert.equal(h.hidden(),true);assert.equal(new URL(h.w.location.href).searchParams.get('mofangMinSamples'),'5');
    await h.router.push('/ancestry/ytree/O-F8');await tick();assert.equal(h.hidden(),false);assert.equal(h.input().value,'0');
    await new Promise(resolve=>{h.w.addEventListener('popstate',resolve,{once:true});h.w.history.back();});await tick();assert.equal(h.hidden(),true);
    await new Promise(resolve=>{h.w.addEventListener('popstate',resolve,{once:true});h.w.history.forward();});await tick();assert.equal(h.hidden(),false);
  }finally{h.close();}
});
test('route transition restores old tree immediately and rejects stale route messages',async()=>{
  const h=harness('?mofangMinSamples=5');try{await tick();const old=h.states.at(-1);h.router.delay=true;const promise=h.router.push('/ancestry/ytree/O-F2890');assert.equal(h.hidden(),false);h.message({type:'draft',route:old.route,epoch:old.epoch,componentId:old.componentId,sequence:999,value:100});h.finish();await promise;await tick();assert.equal(h.input().value,'0');assert.equal(h.hidden(),false);
    h.message({type:'apply',filter:{minSamples:999}});await tick();assert.equal(h.hidden(),false);
  }finally{h.close();}
});
test('out-of-order drafts and disposed-component commands are ignored',async()=>{
  const h=harness();try{await tick();const old=h.states.at(-1);const base={type:'draft',route:old.route,epoch:old.epoch,componentId:old.componentId};h.message({...base,sequence:10,value:8});h.message({...base,sequence:9,value:100});await tick();assert.equal(h.input().value,'8');
    const content=h.d.querySelector('.node-filter-content'),replacement=content.cloneNode(false);content.replaceWith(replacement);await tick();h.message({...base,sequence:11,value:100});await tick();assert.equal(h.input().value,'0');
  }finally{h.close();}
});
test('unrecognized component leaves native controls working and shows unavailable hint',async()=>{
  const h=harness('?mofangMinSamples=5',false);try{await tick();assert.equal(h.hidden(),false);assert.equal(h.input(),null);assert.match(h.d.querySelector('[data-mofang-filter-notice]').textContent,/暂不可用/);h.vm.surnames=['陈'];h.vm.handleSubmit();await tick();assert.equal(h.requests.length,1);}finally{h.close();}
});
test('failed URL update restores applied URL state and reports the failure',async()=>{
  const h=harness('?mofangMinSamples=5');try{await tick();h.edit('8');await tick();h.router.fail=true;h.vm.handleSubmit();await tick();assert.equal(h.hidden(),true);assert.equal(h.input().value,'5');assert.match(h.d.querySelector('[data-mofang-filter-notice]').textContent,/更新失败/);}finally{h.close();}
});
test('whole tree replacement still applies the current threshold',async()=>{
  const h=harness('?mofangMinSamples=5');try{await tick();
    const old=h.d.querySelector('.tree-wrapper'),next=old.cloneNode(true);
    for(const node of next.querySelectorAll('g.node')){node.removeAttribute('style');node.__data__={data:{clanRelationCount:node.id==='small'?2:100},parent:null};}
    old.replaceWith(next);await tick();assert.equal(h.hidden(),true);
    h.vm.handleReset();await tick();assert.equal(h.hidden(),false);
  }finally{h.close();}
});
test('unexpected native submit contract disables this component without suppressing native submission',async()=>{
  const h=harness('?mofangMinSamples=5');try{await tick();h.vm.$emit('submit',{surnames:['陈']});await tick();
    assert.equal(h.hidden(),false);assert.equal(h.input(),null);assert.match(h.d.querySelector('[data-mofang-filter-notice]').textContent,/暂不可用/);assert.equal(h.requests.length,1);
  }finally{h.close();}
});
test('disabled feature leaves URL threshold dormant without an isolated activation request',async()=>{
  const h=harness('?mofangMinSamples=5',true,false,false);try{await tick();assert.equal(h.hidden(),false);assert.equal(h.input(),null);assert.equal(h.states.length,0);}finally{h.close();}
});
