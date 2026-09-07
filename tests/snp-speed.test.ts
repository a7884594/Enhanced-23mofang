import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AncientEngine,RequestGate,type IO} from '../src/ancient/engine';
import {snpUrl} from '../src/ancient/snps';
const sleep=(n:number)=>new Promise(r=>setTimeout(r,n));
test('shared gate spaces SNP searches by 500ms, keeps tree requests exclusive, and caps at sixteen',async()=>{
 const original=globalThis.fetch;let active=0,max=0;const starts:number[]=[];let exclusive=0;
 globalThis.fetch=async(url:any)=>{if(!String(url).includes('?snp='))exclusive=active;starts.push(Date.now());active++;max=Math.max(max,active);await sleep(1800);active--;return new Response('{}');};
 try{const gate=new RequestGate(),signal=new AbortController().signal;await Promise.all([gate.fetch(snpUrl('X1'),signal),gate.fetch(snpUrl('X2'),signal),gate.fetch(snpUrl('X3'),signal),gate.fetch(snpUrl('X4'),signal),gate.fetch(snpUrl('X5'),signal),gate.fetch('https://www.theytree.com/api/ysnp/theytree/?haplogroup=O-F8',signal)]);assert.ok(max<=16);assert.equal(exclusive,0);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=490);}
 finally{globalThis.fetch=original;}
});
function harness(blocked=false){const data=new Map<string,any>(),urls:string[]=[];let id=0,active=0,max=0;
 const io:IO={get:async k=>structuredClone(data.get(k)),set:async(k,v)=>{data.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>String(++id),request:async(url,signal)=>{urls.push(url);active++;max=Math.max(max,active);await sleep(2);active--;if(signal.aborted)throw new DOMException('cancelled','AbortError');return {status:blocked?403:200,url,body:JSON.stringify({code:1,data:{ytree:[{hid:1,parent:0,name:'O-ROOT100',equivalent_mutations:{equivalent_count:2}}]}})};}};
 return {engine:new AncientEngine(io),urls,data,max:()=>max};
}
async function done(h:ReturnType<typeof harness>,id:string){for(let i=0;i<1000;i++){await sleep(2);const j=await h.engine.get(id);if(j?.status!=='running')return j!;}throw Error('timeout');}
test('272 SNPs stay bounded and shared searches are recomputed for a different local SNP set',async()=>{
 const h=harness(),values=Array.from({length:272},(_,i)=>'X'+i);
 const first=await done(h,(await h.engine.start('O-MF160381','direct',false,values)).id);
 assert.equal(first.snpChecks?.length,272);assert.equal(first.status,'sync');assert.equal(h.max(),16);assert.equal(h.urls.length,272);
 const before=h.urls.length;const second=await done(h,(await h.engine.start('O-OTHER2','direct',false,[...values,'ROOT100'])).id);
 assert.equal(second.complete,true);assert.equal(second.target,'O-ROOT100');assert.equal(second.snpChecks?.length,273);
 assert.equal(h.urls.slice(before).filter(u=>u.includes('?snp=')).length,1);assert.equal(second.snpChecks?.find(c=>c.snp==='X1')?.issue,'');
});
test('access restriction stops after the current bounded batch and cancellation cannot resume progress',async()=>{
 const h=harness(true);const job=await done(h,(await h.engine.start('O-X1','direct',false,['X1','X2','X3','X4','X5','X6'])).id);assert.equal(job.status,'sync');assert.equal(job.complete,false);assert.equal(h.urls.length,6);
 const next=harness();const j=await next.engine.start('O-X1','direct',false,Array.from({length:272},(_,i)=>'X'+i));await next.engine.pause(j.id);await sleep(30);assert.equal((await next.engine.get(j.id))?.status,'paused');assert.ok(next.urls.length<=16);
});
