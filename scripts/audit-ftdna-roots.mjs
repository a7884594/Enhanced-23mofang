import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {query} from '../src/samples/service.ts';
import {RequestGate} from '../src/ancient/engine.ts';
import {htmlSnps} from '../src/ancient/nuxt-snps.ts';
import {snpTokens} from '../src/samples/model.ts';
const names=JSON.parse(await readFile('assets/yfull-root-audit.json','utf8')).rows.map(r=>({letter:r.letter,mofang:r.mofang}));
const gate=new RequestGate(),cache=new Map(),responses=new Map();
await mkdir('test-results/ftdna-roots',{recursive:true});
const io={get:async k=>cache.get(k),set:async(k,v)=>{cache.set(k,v);},now:()=>Date.now(),id:()=>crypto.randomUUID(),request:async(url,signal)=>{const r=await gate.fetch(url,signal);let raw;try{raw=JSON.parse(r.body);}catch{}responses.set(url,{url,status:r.status,bytes:r.body.length,sha256:createHash('sha256').update(r.body).digest('hex'),search:Array.isArray(raw)?raw:undefined,root:raw?.node?{name:raw.node.name,short:raw.node.short,variants:raw.node.variants,synonyms:raw.node.synonyms}:undefined});return r;}};
const rows=[];
for(const entry of names){
 const row={...entry};responses.clear();
 try{const url='https://www.23mofang.com/ancestry/ytree/'+entry.mofang;const r=await gate.fetch(url,new AbortController().signal);row.mofangStatus=r.status;row.localGroups=r.status===200?htmlSnps(r.body,entry.mofang,true):[];}catch(e){row.mofangError=String(e);}
 try{const r=await query(io,'ftdna',entry.mofang,true,new AbortController().signal);row.status=r.status;row.target=r.target;row.mapping=r.mapping;row.url=r.url;row.complete=r.complete;row.nodes=r.nodes.length;const own=r.nodes.find(n=>n.name===r.target);row.rootSnps=own?.snps||[];const local=snpTokens((row.localGroups||[]).join(' '));row.overlap=row.rootSnps.filter(s=>local.includes(s));row.directSampleCount=own?.samples.length;row.message=r.message;}catch(e){row.status='error';row.error=String(e);}
 row.responses=[...responses.values()];rows.push(row);await writeFile('test-results/ftdna-roots/audit.json',JSON.stringify({checkedAt:new Date().toISOString(),rows},null,2)+'\n');
 console.log(JSON.stringify({letter:row.letter,mofang:row.mofang,status:row.status,target:row.target,local:row.localGroups?.length,overlap:row.overlap?.length,error:row.error}));
}
