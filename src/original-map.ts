/** Resize only the website's map instance, after its container becomes measurable.
 * ECharts lives in the page's MAIN world; the extension's own instance cannot
 * retrieve it. The public site component exposes the instance as `myChart`.
 */
export function resizeOriginalMap(root:any,container:HTMLElement|null):boolean {
  if(!container?.isConnected || container.getBoundingClientRect().width<=0)return false;
  const queue=[root];const visited=new Set();const resized=new Set();
  while(queue.length&&visited.size<600){
    const vm=queue.shift();if(!vm||visited.has(vm))continue;visited.add(vm);
    if(Array.isArray(vm.$children))queue.push(...vm.$children);
    const instance=vm.myChart;
    if(vm._isDestroyed||!instance||resized.has(instance)||typeof instance.resize!=='function'||typeof instance.getDom!=='function')continue;
    try{
      const dom=instance.getDom();
      if(!dom?.isConnected||!container.contains(dom)||instance.isDisposed?.())continue;
      const bounds=dom.getBoundingClientRect();
      if(bounds.width<=0||bounds.height<=0)continue;
      // Explicit visible dimensions also recover instances initialized at 0 × 0.
      instance.resize({width:dom.clientWidth||bounds.width,height:dom.clientHeight||bounds.height});
      resized.add(instance);
    }catch{/* The site may dispose its chart during a route transition. */}
  }
  return resized.size>0;
}
