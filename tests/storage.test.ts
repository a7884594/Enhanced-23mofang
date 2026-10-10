import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ManagedLocalStore,storageBytes,STORAGE_LIMITS} from '../src/storage';
import {AncientEngine,cacheKey} from '../src/ancient/engine';
import type {QueryResult} from '../src/ancient/model';

class FakeArea{
  values=new Map<string,any>();
  constructor(private quota=Infinity,seed:Record<string,any>={}){for(const [key,value] of Object.entries(seed))this.values.set(key,structuredClone(value));}
  async get(keys:any=null){
    if(keys==null)return Object.fromEntries([...this.values].map(([key,value])=>[key,structuredClone(value)]));
    const list=Array.isArray(keys)?keys:[keys];return Object.fromEntries(list.filter((key:string)=>this.values.has(key)).map((key:string)=>[key,structuredClone(this.values.get(key))]));
  }
  async set(values:Record<string,unknown>){
    const next=new Map(this.values);for(const [key,value] of Object.entries(values))next.set(key,structuredClone(value));
    const bytes=[...next].reduce((sum,[key,value])=>sum+storageBytes(key,value),0);
    if(bytes>this.quota)throw Error('Error: Resource::kQuotaBytes quota exceeded');
    this.values=next;
  }
  async remove(keys:string|string[]){for(const key of Array.isArray(keys)?keys:[keys])this.values.delete(key);}
  async getBytesInUse(){return [...this.values].reduce((sum,[key,value])=>sum+storageBytes(key,value),0);}
}

const match=(descendants=0)=>({marker:'O-MF10031',target:'O-CTS5308',mapping:'O-MF10031 → O-CTS5308',nodeSnps:['MF10031'],snpChecks:[{snp:'MF10031',target:'O-CTS5308',issue:'',url:'https://www.theytree.com/api/ysnp/theytree/?snp=MF10031',descendants:Array.from({length:descendants},(_,i)=>`O-X${i}`),candidate:{id:'5308',marker:'O-CTS5308'},evidence:{id:'5308',marker:'O-CTS5308',groups:Array.from({length:200},(_,i)=>`MF${i}/TYT${i}`),snps:['MF10031'],overlap:['MF10031'],url:'https://www.theytree.com/',capturedAt:1000,method:'authenticated-page'}}],verifiedAt:1000});

test('near-quota legacy storage self-heals, retries the critical write and preserves settings and compact identity',async()=>{
  const area=new FakeArea(10*1024*1024,{
    'mofang.features.samples':true,
    'mofang.nodeFilter.v1':{minSamples:3},
    'mofang.node-match.v1.O-MF10031':match(3000),
    'anc.detail.AU-OLD':{at:1,value:'x'.repeat(10_200_000)}
  });
  const store=new ManagedLocalStore(area as any,()=>20_000_000_000,true);
  await store.set('anc.job.current',{id:'current',marker:'O-MF10031',target:'O-CTS5308',mappingReady:true,snpChecks:match(3000).snpChecks,updatedAt:20_000_000_000,payload:'y'.repeat(4_000_000)});
  assert.equal(await store.get('mofang.features.samples'),true);assert.deepEqual(await store.get('mofang.nodeFilter.v1'),{minSamples:3});
  assert.equal(area.values.has('anc.detail.AU-OLD'),false);
  const compact=await store.get('mofang.node-match.v2.O-MF10031');assert.equal(compact.target,'O-CTS5308');assert.equal(compact.snpChecks[0].descendants,undefined);assert.equal(compact.snpChecks[0].evidence,undefined);assert.deepEqual(compact.snpChecks[0].proof.overlap,['MF10031']);
  const job=await store.get('anc.job.current');assert.ok(job);assert.equal(job.snpChecks[0].descendants,undefined);assert.equal(job.snpChecks[0].candidate.marker,'O-CTS5308');assert.ok((await area.getBytesInUse())<10*1024*1024);
});

test('oversized optional evidence is not persisted and soft limits are exported exactly',async()=>{
  const area=new FakeArea(),store=new ManagedLocalStore(area as any,()=>1000,false);
  await store.set('anc.equivalent3.1.O-X1',{capturedAt:1000,payload:'x'.repeat(600*1024)});
  assert.equal(await store.get('anc.equivalent3.1.O-X1'),undefined);
  assert.deepEqual(STORAGE_LIMITS,{HIGH_WATER:32*1024*1024,LOW_WATER:24*1024*1024,OPTIONAL_ITEM_LIMIT:512*1024});
});

test('maintenance keeps only eight recovery checkpoints per mode, active jobs and two thousand compact matches',async()=>{
  const seed:Record<string,any>={};
  for(const prefix of ['anc','res'])for(let i=0;i<10;i++){seed[`${prefix}.pending.fast4.O-X${i}.direct`]=`${prefix}-${i}`;seed[`${prefix}.job.${prefix}-${i}`]={id:`${prefix}-${i}`,updatedAt:i};}
  seed['anc.job.orphan']={id:'orphan',updatedAt:999};seed['anc.job.active']={id:'active',updatedAt:999};
  for(let i=0;i<2005;i++)seed[`mofang.node-match.v2.O-X${i}`]={...match(),marker:`O-X${i}`,verifiedAt:i};
  const area=new FakeArea(Infinity,seed),store=new ManagedLocalStore(area as any,()=>3000,false);await store.maintain(['active','anc-0']);
  const all=await area.get(null);assert.equal(Object.keys(all).filter(k=>k.startsWith('anc.pending.')).length,8);assert.equal(Object.keys(all).filter(k=>k.startsWith('res.pending.')).length,8);
  assert.equal(all['anc.job.orphan'],undefined);assert.ok(all['anc.job.active']);assert.ok(all['anc.pending.fast4.O-X0.direct']);assert.equal(Object.keys(all).filter(k=>k.startsWith('mofang.node-match.v2.')).length,2000);
});

test('evictable caches trim from the 32 MiB high-water mark to the 24 MiB low-water mark',async()=>{
  const area=new FakeArea(),store=new ManagedLocalStore(area as any,()=>1000,false);
  for(let i=0;i<34;i++)await store.set(`samples.v2.theytree.O-X${i}.O-X${i}`,{updatedAt:i,payload:'x'.repeat(1024*1024)});
  assert.ok((await area.getBytesInUse())<27*1024*1024);assert.equal(area.values.has('samples.v2.theytree.O-X0.O-X0'),false);assert.equal(area.values.has('samples.v2.theytree.O-X33.O-X33'),true);
});

test('one hundred cached opens and releases do not accumulate UUID job snapshots',async()=>{
  const area=new FakeArea(),store=new ManagedLocalStore(area as any,()=>10_000,false);let id=0;
  const io={get:(key:string)=>store.get(key),set:(key:string,value:any)=>store.set(key,value),remove:(key:string|string[])=>store.remove(key),now:()=>10_000,id:()=>`open-${++id}`,request:async()=>{throw Error('cache reuse must not fetch');}};
  const cached:QueryResult={id:'cache',marker:'O-MF10031',target:'O-CTS5308',mappingReady:true,mapping:'verified',scope:'direct',status:'complete',complete:true,cached:false,createdAt:9000,updatedAt:9000,samples:[],unknown:[],branches:[{id:'5308',parent:'0',marker:'O-CTS5308',pending:false,tentative:false}],checked:['5308'],queue:[],details:[],failures:[],excluded:0,message:'done'};
  await store.set(cacheKey('O-MF10031','direct'),cached);
  const engine=new AncientEngine(io);
  for(let i=0;i<100;i++){const job=await engine.start('O-MF10031','direct');assert.equal(job.cached,true);await engine.release(job.id);}
  const all=await area.get(null);assert.equal(Object.keys(all).filter(k=>k.startsWith('anc.job.')).length,0);assert.ok(all[cacheKey('O-MF10031','direct')]);
});

test('a direct query persists only the connected target branch from a broad source response',async()=>{
  const area=new FakeArea(),store=new ManagedLocalStore(area as any,()=>10_000,false);let id=0;
  const body=JSON.stringify({code:1,data:{ytree:[{hid:1,parent:0,name:'O-MF10031'},{hid:2,parent:1,name:'O-CTS5308'},{hid:3,parent:0,name:'R-Y82825'}]}});
  const engine=new AncientEngine({get:key=>store.get(key),set:(key,value)=>store.set(key,value),remove:key=>store.remove(key),now:()=>10_000,id:()=>`tree-${++id}`,request:async url=>({status:200,url,body})});
  const started=await engine.start('O-MF10031','direct');let job:any;for(let i=0;i<50;i++){job=await engine.get(started.id);if(job.status!=='running')break;await new Promise(r=>setTimeout(r,1));}
  assert.equal(job.complete,true);assert.deepEqual(job.branches.map((b:any)=>b.marker),['O-MF10031']);assert.equal(JSON.stringify(job).includes('R-Y82825'),false);
});
