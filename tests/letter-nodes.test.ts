import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AncientEngine,cacheKey,type IO} from '../src/ancient/engine';
import {resolveTarget} from '../src/ancient/aliases';
import {marker,treeMarker,sourceMarker,type QueryResult} from '../src/ancient/model';
const nodes=['A-P305','B-M8720','C-M130','D','E','F-M89','G','H','I-M170','J-M304','K-L469','L','M','N-M231','O-F175','P','Q','R','S','T'];
function harness(){const data=new Map<string,any>(),urls:string[]=[];let id=0;
  const io:IO={get:async k=>structuredClone(data.get(k)),set:async(k,v)=>{data.set(k,structuredClone(v));},now:()=>Date.now(),id:()=>`letter-${++id}`,request:async url=>{
    urls.push(url);const u=new URL(url);const target=u.searchParams.get('haplogroup')!;
    if(u.pathname.startsWith('/sample/')){
      const sample=idToMarker.get(u.pathname)!;return {status:200,url,body:`<div><label for="input-stype"></label><div>古人</div></div><div><label for="input-sid"></label><div>AU${sample.id}</div></div><div><label for="input-haplogroup"></label><div>${sample.marker}</div></div>`};
    }
    assert.ok(target);assert.ok(!u.searchParams.has('snp'));
    const index=targets.get(target)||targets.size+1;targets.set(target,index);
    const rows:any[]=[{hid:1,parent:0,name:target},{hid:2,parent:1,name:target+'-TEST123'}];
    for(const [n,parent,name] of [[1,1,target],[2,2,target+'-TEST123']] as const){const sid=index*10+n;const hex=String(sid).padStart(32,'0');idToMarker.set('/sample/'+hex+'.html',{id:sid,marker:name});rows.push({sid,parent,haplogroup:name,stype:2,sid_encrypted:hex,name:'Synthetic Ancient'});}
    rows.push({sid:3,parent:1,stype:1,name:'Scientific must be excluded'});
    return {status:200,url,body:JSON.stringify({code:1,data:{ytree:rows}})};
  }};const idToMarker=new Map<string,{id:number;marker:string}>(),targets=new Map<string,number>();return {data,urls,engine:new AncientEngine(io)};
}
async function done(engine:AncientEngine,j:QueryResult){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,2));const result=(await engine.get(j.id))!;if(result.status!=='running')return result;}throw Error('timeout');}
test('all A–T navigation nodes support direct and downstream queries, with exact root aliases only',async()=>{
  const h=harness();for(let i=0;i<nodes.length;i++){
    const name=nodes[i],letter=String.fromCharCode(65+i),expected=i===0?'A-P305':letter;
    assert.equal(treeMarker('/ancestry/ytree/'+letter),letter);assert.equal(sourceMarker('/tree/'+letter),letter);assert.equal(marker(letter),letter);
    const direct=await done(h.engine,await h.engine.start(name,'direct'));assert.equal(direct.target,expected);assert.equal(direct.complete,true);assert.equal(direct.samples.length,1);
    const downstream=await done(h.engine,await h.engine.start(name,'downstream'));assert.equal(downstream.target,expected);assert.equal(downstream.samples.length,2);assert.equal(downstream.complete,true);
    const bare=await done(h.engine,await h.engine.start(letter,'direct'));assert.equal(bare.target,letter);assert.equal(bare.complete,true);assert.equal(bare.samples.length,1);
  }
  for(const name of ['A-P305','O-F265','N-M128','K-M526','O-MF10031','ROOT'])assert.equal(resolveTarget(name).target,name);
});
test('old zero results and failed root-name checkpoints cannot hide a corrected root badge',async()=>{
  const h=harness();const old=await done(h.engine,await h.engine.start('O-F175','direct'));
  h.data.set(cacheKey('O-F175','direct'),{...old,target:'O-F175',samples:[]});
  assert.equal(await h.engine.getBadge('O-F175'),null);
  const pending={...old,id:'old-pending',target:'O-F175',mappingReady:false,status:'paused',complete:false};
  h.data.set('anc.pending.fast4.O-F175.direct',pending.id);h.data.set('anc.job.'+pending.id,pending);
  const fixed=await done(h.engine,await h.engine.start('O-F175','direct'));assert.equal(fixed.target,'O');assert.equal(fixed.samples.length,1);
  h.data.delete(cacheKey('O-F175','direct'));
  await done(h.engine,await h.engine.start('O','downstream'));
  assert.equal((await h.engine.getBadge('O-F175'))?.count,1);
});
