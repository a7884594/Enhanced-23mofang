interface Store {get(key:string):Promise<any>;set(key:string,value:any):Promise<unknown>;remove(key:string):Promise<unknown>}
type Task={token:string;owner:string;controls:Set<AbortController>};

/** Session storage survives MV3 worker suspension; cancelled tokens stay cancelled. */
export class SampleSessions {
  private tasks=new Map<number,Task>();
  private pending:Promise<unknown>=Promise.resolve();
  constructor(private store:Store,private id:()=>string=()=>crypto.randomUUID()){}
  private key(tab:number){return `samples.session.v1.${tab}`;}
  private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.pending.catch(()=>{}).then(work);this.pending=next;return next;}
  private async current(tab:number,owner:string,token:string):Promise<Task>{
    const saved=await this.store.get(this.key(tab));
    if(!token||saved?.token!==token||saved?.owner!==owner)throw Error('查询已切换或取消，请刷新多源样本后重试');
    let task=this.tasks.get(tab);
    if(!task||task.token!==token||task.owner!==owner){
      for(const c of task?.controls||[])c.abort();
      task={token,owner,controls:new Set()};this.tasks.set(tab,task);
    }
    return task;
  }
  begin(tab:number,owner:string){return this.serial(async()=>{
    const token=this.id();await this.store.set(this.key(tab),{token,owner});
    for(const c of this.tasks.get(tab)?.controls||[])c.abort();
    this.tasks.set(tab,{token,owner,controls:new Set()});return {token};
  });}
  acquire(tab:number,owner:string,token:string){return this.serial(async()=>{
    const task=await this.current(tab,owner,token);
    if(task.controls.size>=3)throw Error('当前请求尚未完成，请稍后重试');
    const control=new AbortController();task.controls.add(control);
    return {signal:control.signal,release:()=>{task.controls.delete(control);}};
  });}
  cancel(tab:number,owner:string,token:string){return this.serial(async()=>{
    const task=await this.current(tab,owner,token);await this.store.remove(this.key(tab));
    for(const c of task.controls)c.abort();this.tasks.delete(tab);return true;
  });}
  remove(tab:number){return this.serial(async()=>{
    await this.store.remove(this.key(tab));for(const c of this.tasks.get(tab)?.controls||[])c.abort();this.tasks.delete(tab);
  });}
}
