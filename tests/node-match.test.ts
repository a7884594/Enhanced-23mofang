import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {AncientEngine,type IO} from '../src/ancient/engine';
import {matchKey,loadMatch,confirmedMatch} from '../src/ancient/node-match';
import {equivalentEvidence,applyEquivalent,disambiguate} from '../src/ancient/equivalent';
import {TTL,type QueryResult} from '../src/ancient/model';
const f=JSON.parse(readFileSync('tests/fixtures/ancient/MF15505-equivalent.json','utf8'));
const base=f.local.map((s:string)=>({snp:s,target:'',issue:['MF15505','MF170687','ZS3220'].includes(s)?'待核对':'',url:'',candidate:s==='ZS3220'?f.other.candidate:['MF15505','MF170687'].includes(s)?f.candidate:undefined}));
const checks=disambiguate(applyEquivalent(applyEquivalent(base,equivalentEvidence(f.candidate,f.groups,f.local,1000,'visible-dialog')),equivalentEvidence(f.other.candidate,f.other.groups,f.local,1000,'visible-dialog')),f.marker);
const seed=():QueryResult=>({id:'verified',marker:f.marker,target:'O-Z44059',scope:'direct',nodeSnps:f.local,snpChecks:checks,mappingReady:true,mapping:'已确认对应',status:'paused',complete:false,cached:false,createdAt:1000,updatedAt:1000,samples:[],unknown:[],branches:[],checked:[],queue:[],details:[],failures:[],excluded:0,message:'详情尚未完成'});
function harness(){const data=new Map<string,any>(),requests:string[]=[];let time=1000,id=0;
 const io:IO={get:async k=>structuredClone(data.get(k)),set:async(k,v)=>{data.set(k,structuredClone(v));},now:()=>time,id:()=>`new-${++id}`,request:async(url)=>{requests.push(url);return {status:200,url,body:JSON.stringify({code:1,data:{ytree:[{hid:34,parent:28,name:'O-Z44059'}]}})};}};
 return {data,requests,io,engine:new AncientEngine(io),advance:()=>{time+=100*TTL;}};
}
async function done(engine:any,id:string){for(let i=0;i<100;i++){const j=await engine.get(id);if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,5));}throw Error('timeout');}
test('verified match survives incomplete sample queries and is reused by research and new scopes',async()=>{
 const h=harness();await h.engine.save(seed());assert.ok(h.data.has(matchKey(f.marker)));
 const code=(await build({entryPoints:['src/ancient/engine.ts'],bundle:true,write:false,platform:'node',packages:'external',format:'cjs',define:{__RESEARCH__:'true'}})).outputFiles[0].text;
 const module={exports:{} as any};runInNewContext(code,{module,exports:module.exports,require:createRequire(import.meta.url),URL,Date,AbortController,AbortSignal,DOMException,setTimeout,clearTimeout});
 const research=new module.exports.AncientEngine(h.io);
 const first=await done(research,(await research.start(f.marker,'downstream')).id);assert.equal(first.target,'O-Z44059');assert.equal(first.matchReused,true);
 assert.ok(h.requests.every(u=>!u.includes('?snp=')));assert.ok(h.requests.every(u=>!u.includes('haplogroup=O-MF15505')));
 h.advance();h.requests.length=0;
 const restarted=new AncientEngine(h.io);const later=await done(restarted,(await restarted.start(f.marker,'downstream')).id);
 assert.equal(later.complete,true);assert.equal(later.target,'O-Z44059');assert.equal(later.matchReused,true);
 assert.ok(h.requests.every(u=>!u.includes('?snp=')));
});
test('explicit refresh and a supplied changed SNP list bypass the shared match',async()=>{
 const h=harness();await h.engine.save(seed());
 const refreshed=await done(h.engine,(await h.engine.start(f.marker,'downstream',true,f.local)).id);assert.equal(refreshed.matchReused,false);assert.ok(h.requests.some(u=>u.includes('?snp=')));
 h.requests.length=0;
 await done(h.engine,(await h.engine.start(f.marker,'downstream',false,[...f.local,'EXTRA123'])).id);assert.ok(h.requests.some(u=>u.includes('snp=EXTRA123')));
});
test('old verified checkpoints migrate without sample completeness; ambiguous checkpoints do not',async()=>{
 const h=harness();const s=seed();h.data.set('anc.pending.fast4.O-MF15505.direct',s.id);h.data.set('anc.job.'+s.id,s);
 const result=await loadMatch(h.io,f.marker);assert.equal(result?.target,'O-Z44059');assert.equal(result?.verifiedAt,1000);
 assert.equal(confirmedMatch({...s,mappingReady:false}),null);assert.equal(confirmedMatch({...s,snpChecks:[...checks,{snp:'X123',target:'O-OTHER123',issue:'',url:''}]}),null);
});
