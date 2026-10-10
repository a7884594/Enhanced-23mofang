const HIGH_WATER=32*1024*1024;
const LOW_WATER=24*1024*1024;
const OPTIONAL_ITEM_LIMIT=512*1024;
const CACHE_TTL=7*24*60*60*1000;
const INDEX_KEY='mofang.storage-index.v1';

type StorageAreaLike={
  get(keys?:string|string[]|Record<string,unknown>|null):Promise<Record<string,any>>;
  set(values:Record<string,unknown>):Promise<void>;
  remove?(keys:string|string[]):Promise<void>;
  getBytesInUse?(keys?:string|string[]|null):Promise<number>;
};
type Meta={bytes:number;at:number;priority:number};

function utf8Length(value:string):number{
  let bytes=0;
  for(let i=0;i<value.length;i++){
    const code=value.charCodeAt(i);
    if(code<0x80)bytes++;
    else if(code<0x800)bytes+=2;
    else if(code>=0xd800&&code<=0xdbff&&i+1<value.length&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}
    else bytes+=3;
  }
  return bytes;
}
export function storageBytes(key:string,value:unknown):number{
  let json='null';try{json=JSON.stringify(value)??'null';}catch{return Number.MAX_SAFE_INTEGER;}
  return utf8Length(key)+utf8Length(json);
}
function timeOf(value:any,now:number):number{
  for(const key of ['lastAccessedAt','updatedAt','at','capturedAt','verifiedAt','createdAt'])if(Number.isFinite(value?.[key]))return Number(value[key]);
  return now;
}
function isRuntimeKey(key:string){return /^(?:anc|res)\.(?:owner|parentTab|syncTab|syncTarget)\./.test(key)||/^(?:anc|res)\.sync\.\d+$/.test(key);}
function isJob(key:string){return /^(?:anc|res)\.job\./.test(key);}
function isPending(key:string){return /^(?:anc|res)\.pending\.fast4\./.test(key);}
function isNodeMatch(key:string){return /^mofang\.node-match\.v[12]\./.test(key);}
function isSmallOptional(key:string){return /^mofang\.snp-search\./.test(key)||/^(?:anc|res)\.(?:detail|equivalent\d*)\./.test(key);}
function isOptional(key:string){return isSmallOptional(key)||/^samples\.v[12]\./.test(key)||/^(?:anc|res)\.cache\./.test(key)||/^(?:anc|res)\.badge-progress\./.test(key);}
function priorityOf(key:string):number{
  if(/^mofang\.snp-search\./.test(key)||/^(?:anc|res)\.(?:detail|equivalent\d*)\./.test(key)||/^(?:anc|res)\.badge-progress\./.test(key))return 1;
  if(/^samples\.v[12]\./.test(key))return 2;
  if(/^(?:anc|res)\.cache\..*\.direct$/.test(key))return 3;
  if(/^(?:anc|res)\.cache\./.test(key))return 4;
  if(/^mofang\.node-match\.v[12]\./.test(key))return 5;
  return 99;
}
function quotaError(error:unknown){return /quota(?:bytes)?|kQuotaBytes/i.test(error instanceof Error?`${error.name} ${error.message}`:String(error));}
function compactCheck(value:any){
  if(!value||typeof value!=='object')return value;
  const check:any={snp:value.snp,target:value.target||'',issue:value.issue||'',url:value.url||''};
  if(value.note)check.note=String(value.note).slice(0,500);
  if(value.candidate&&typeof value.candidate==='object')check.candidate={id:value.candidate.id,marker:value.candidate.marker,count:value.candidate.count};
  const evidence=value.evidence;
  if(evidence&&typeof evidence==='object')check.proof={id:evidence.id,marker:evidence.marker,overlap:Array.isArray(evidence.overlap)?evidence.overlap.slice(0,100):[],capturedAt:evidence.capturedAt,method:evidence.method,groupCount:Array.isArray(evidence.groups)?evidence.groups.length:undefined};
  else if(value.proof)check.proof=value.proof;
  return check;
}
function compactMatch(value:any){
  if(!value||typeof value!=='object')return value;
  return {marker:value.marker,target:value.target,mapping:value.mapping,nodeSnps:Array.isArray(value.nodeSnps)?value.nodeSnps.slice(0,5000):[],snpChecks:Array.isArray(value.snpChecks)?value.snpChecks.slice(0,5000).map(compactCheck):[],verifiedAt:value.verifiedAt,lastAccessedAt:value.lastAccessedAt??value.verifiedAt};
}
function compactStoredValue(key:string,value:any){
  if(/^mofang\.node-match\.v2\./.test(key))return compactMatch(value);
  if((isJob(key)||/^(?:anc|res)\.cache\./.test(key))&&value?.mappingReady&&Array.isArray(value.snpChecks))return {...value,snpChecks:value.snpChecks.map(compactCheck)};
  return value;
}

export class ManagedLocalStore{
  private initialized:Promise<void>|null=null;
  private tail:Promise<unknown>=Promise.resolve();
  private meta=new Map<string,Meta>();
  private usage=0;
  constructor(private area:StorageAreaLike,private now:()=>number=()=>Date.now(),private purgeRuntime=true){}
  private serial<T>(work:()=>Promise<T>):Promise<T>{const next=this.tail.catch(()=>{}).then(work);this.tail=next;return next;}
  private async rawRemove(keys:string[]){
    if(!keys.length)return;
    if(this.area.remove)await this.area.remove(keys);
    for(const key of keys){this.usage-=this.meta.get(key)?.bytes||0;this.meta.delete(key);}
    this.usage=Math.max(0,this.usage);
  }
  private async rawUsage(){return this.area.getBytesInUse?await this.area.getBytesInUse(null):this.usage;}
  private indexValue(){return {schema:1,updatedAt:this.now(),highWater:HIGH_WATER,lowWater:LOW_WATER,entries:[...this.meta].filter(([key])=>isOptional(key)||isNodeMatch(key)).sort((a,b)=>b[1].at-a[1].at).slice(0,5000).map(([key,m])=>[key,m.bytes,m.at,m.priority])};}
  private async persistIndex(){try{await this.area.set({[INDEX_KEY]:this.indexValue()});}catch{/* The index is rebuildable. */}}
  private async initialize(){
    let all:Record<string,any>={};try{all=await this.area.get(null)||{};}catch{}
    const now=this.now(),remove:string[]=[];
    for(const [key,value] of Object.entries(all)){
      if(value===undefined)continue;
      if(key===INDEX_KEY||key==='samples.cacheIndex'||this.purgeRuntime&&isRuntimeKey(key)){remove.push(key);continue;}
      const bytes=storageBytes(key,value);this.meta.set(key,{bytes,at:timeOf(value,now),priority:priorityOf(key)});this.usage+=bytes;
    }
    // Upgrade shared node matches before dropping their bulky v1 representation.
    for(const [key,value] of Object.entries(all))if(key.startsWith('mofang.node-match.v1.')&&value){
      const next=key.replace('.v1.','.v2.');
      if(all[next]){remove.push(key);continue;}
      const compact=compactMatch(value);
      try{await this.area.set({[next]:compact});const bytes=storageBytes(next,compact);this.meta.set(next,{bytes,at:timeOf(compact,now),priority:5});this.usage+=bytes;remove.push(key);}catch{/* Lazy migration remains available in node-match.ts. */}
    }
    await this.rawRemove([...new Set(remove)]);
    this.usage=await this.rawUsage();
    await this.trim(false,new Set());await this.persistIndex();
  }
  private ready(){return this.initialized??=(this.initialize());}
  async get(key:string){await this.ready();const value=(await this.area.get(key))[key];if(value!==undefined&&(isOptional(key)||isNodeMatch(key))){const saved=this.meta.get(key);if(saved)saved.at=this.now();}return value;}
  async set(key:string,value:any){
    await this.ready();return this.serial(async()=>{
      const stored=compactStoredValue(key,value),bytes=storageBytes(key,stored);
      if(isSmallOptional(key)&&bytes>OPTIONAL_ITEM_LIMIT)return;
      const old=this.meta.get(key)?.bytes||0;
      const write=()=>this.area.set({[key]:stored});
      try{await write();}
      catch(error){
        if(!quotaError(error)){if(isOptional(key))return;throw error;}
        await this.trim(true,new Set([key]),Math.max(0,bytes-old));
        try{await write();}catch(retry){if(isOptional(key))return;throw Error('本地缓存写入失败，已清理旧缓存，请重试');}
      }
      this.usage=Math.max(0,this.usage-old)+bytes;this.meta.set(key,{bytes,at:timeOf(stored,this.now()),priority:priorityOf(key)});
      if(this.usage>HIGH_WATER)await this.trim(false,new Set(isOptional(key)?[]:[key]));
    });
  }
  async remove(key:string|string[]){await this.ready();return this.serial(async()=>{await this.rawRemove(Array.isArray(key)?key:[key]);});}
  private async trim(emergency:boolean,preserve:Set<string>,needed=0){
    this.usage=await this.rawUsage();if(!emergency&&this.usage<=HIGH_WATER)return;
    const now=this.now();
    const candidates=[...this.meta].filter(([key,m])=>!preserve.has(key)&&!isJob(key)&&!isPending(key)&&m.priority<99).sort((a,b)=>{
      const ae=now-a[1].at>CACHE_TTL?0:a[1].priority,be=now-b[1].at>CACHE_TTL?0:b[1].priority;
      return ae-be||a[1].at-b[1].at;
    });
    const target=emergency?Math.min(LOW_WATER,Math.max(0,this.usage-Math.max(1024*1024,needed))):LOW_WATER;
    const remove:string[]=[];let remaining=this.usage;
    for(const [key,m] of candidates){if(remaining<=target)break;remove.push(key);remaining-=m.bytes;}
    await this.rawRemove(remove);this.usage=await this.rawUsage();await this.persistIndex();
  }
  async maintain(activeIds:Iterable<string>=[]){
    await this.ready();return this.serial(async()=>{
      const all=await this.area.get(null)||{},active=new Set(activeIds),remove:string[]=[];
      const pending=Object.entries(all).filter(([key,value])=>isPending(key)&&typeof value==='string').map(([key,value])=>({key,id:value as string,prefix:key.slice(0,3),at:timeOf(all[`${key.slice(0,3)}job.${value}`],0)}));
      const keepJobs=new Set([...active,...pending.map(p=>p.id)]);
      for(const prefix of ['anc','res']){
        const rows=pending.filter(p=>p.prefix===prefix).sort((a,b)=>b.at-a.at);
        const keep=new Set(rows.filter(row=>active.has(row.id)).map(row=>row.id));
        for(const row of rows)if(keep.size<8)keep.add(row.id);
        for(const old of rows.filter(row=>!keep.has(row.id))){remove.push(old.key,`${prefix}.job.${old.id}`);keepJobs.delete(old.id);}
      }
      for(const key of Object.keys(all))if(isJob(key)&&!keepJobs.has(key.slice(key.indexOf('.job.')+5)))remove.push(key);
      const matches=Object.entries(all).filter(([key])=>key.startsWith('mofang.node-match.v2.')).sort((a,b)=>timeOf(b[1],0)-timeOf(a[1],0));
      for(const [key] of matches.slice(2000))remove.push(key);
      await this.rawRemove([...new Set(remove)]);await this.trim(false,new Set());await this.persistIndex();
    });
  }
}

type KeyStore={get(key:string):Promise<any>;set(key:string,value:any):Promise<void>;remove(key:string|string[]):Promise<void>;all():Promise<Record<string,any>>};
const LOCAL_SINGLETON='__mofangManagedLocalStoreV1';
export function managedLocalStore():ManagedLocalStore{
  const root=globalThis as any;
  return root[LOCAL_SINGLETON]??=(new ManagedLocalStore(chrome.storage.local,()=>Date.now(),!!chrome.storage.session));
}
export function runtimeStore():KeyStore{
  const area:StorageAreaLike=chrome.storage.session||chrome.storage.local;
  return {get:async key=>(await area.get(key))[key],set:async(key,value)=>{await area.set({[key]:value});},remove:async key=>{if(area.remove)await area.remove(key);else await area.set(Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,null])));},all:async()=>area.get(null)};
}
export const STORAGE_LIMITS={HIGH_WATER,LOW_WATER,OPTIONAL_ITEM_LIMIT};
