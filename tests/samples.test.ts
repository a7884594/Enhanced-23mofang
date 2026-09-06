import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {yfull,ftdna,theytree} from '../src/samples/adapters';import {select,type Result,type Node} from '../src/samples/model';import {query} from '../src/samples/service';
const fixture=(name:string)=>readFileSync('tests/fixtures/samples/'+name,'utf8');
const result=(nodes:Node[],target='R-YP5527'):Result=>({provider:'yfull',marker:target,target,url:'https://www.yfull.com/tree/'+target+'/',nodes,updatedAt:1,status:'ready',complete:true,mapping:'同名',message:''});
test('real FGC9988 empty star group is complete; all nine descendants remain selectable',()=>{
 const r=result(yfull(fixture('yfull-R-FGC9988.html')),'R-FGC9988');assert.equal(select(r,false).complete,true);assert.equal(select(r,false).rows.length,0);assert.equal(select(r,true).complete,true);assert.equal(select(r,true).rows.length,9);assert.ok(r.nodes.every(n=>!n.pending));
});
test('TheYtree counts samples as loaded children and accepts a parent-bound child-only response',()=>{
 const raw={code:1,data:{ytree:[{hid:1,name:'R-FGC9988',parent:0,isParent:1},{sid:46471,parent:1,stype:2,name:'VK494'}]}};
 const nodes=theytree(raw);assert.equal(nodes[0].pending,false);
 const root={...nodes[0],pending:true};const child=theytree({code:1,data:{ytree:[{sid:5,parent:1,stype:2,name:'ancient'}]}},root);assert.equal(child[0].samples[0].id,'AU5');assert.equal(child[0].pending,false);
 assert.throws(()=>theytree({code:1,data:{ytree:[{hid:3,name:'R-OTHER',parent:9}]}},root),/不属于/);
 assert.equal(theytree({code:1,data:{ytree:[{...raw.data.ytree[0],low_count:2},raw.data.ytree[1]]}})[0].pending,true);
});
test('unchanged child pages stop retrying instead of reporting successful repeated loads',async()=>{
 const html='<ul id="tree"><li id="lR-X1"><a>R-X1</a><ul><li id="lR-X2"><a href="/tree/R-X2/">R-X2</a></li></ul></li></ul>';
 const r=result(yfull(html),'R-X1');r.updatedAt=100;r.complete=false;const data=new Map<string,any>([['samples.v2.yfull.R-X1.R-X1',r]]);let calls=0;
 const io={get:async(k:string)=>data.get(k),set:async(k:string,v:any)=>{data.set(k,v);},request:async(url:string)=>{calls++;return {status:200,url,body:html};},now:()=>101,id:()=>''};
 const stalled=await query(io,'yfull','R-X1',false,new AbortController().signal,true);assert.ok(stalled.nodes.find(n=>n.name==='R-X2')?.loadBlocked);assert.equal(stalled.complete,false);
 await query(io,'yfull','R-X1',false,new AbortController().signal,true);assert.equal(calls,1);
});
test('real YFull YP5527 direct basal sample and descendant samples remain distinct',()=>{
 const nodes=yfull(fixture('yfull-R-YP5527.html'));const r=result(nodes);assert.deepEqual(select(r,false).rows.map(s=>s.id),['YF006680']);assert.deepEqual(select(r,true).rows.map(s=>s.id),['YF006680','YF011107','YF001896']);assert.equal(select(r,true).complete,true);assert.ok(select(r,true).rows.every(s=>s.kind==='modern'&&!s.name));assert.equal(select(r,true).rows[1].node,'R-YP6497');
});
test('YFull scientific/personal ambiguity is retained and ancient annotation controls classification',()=>{
 const rows=select(result(yfull(fixture('yfull-R-CTS4385.html')),'R-CTS4385'),true).rows;assert.equal(rows.find(s=>s.id==='I7209')?.kind,'ancient');assert.equal(rows.find(s=>s.id==='NA12155')?.kind,'modern');assert.equal(rows.find(s=>s.id==='POZ81')?.uncertain,true);assert.match(rows.find(s=>s.id==='CGG107425')!.period,/4338/);
});
test('FTDNA real tree keeps ancient uncertainty and anonymous modern rows as aggregates',()=>{
 const nodes=ftdna(JSON.parse(fixture('ftdna-R-CTS4385.json')));assert.equal(nodes.length,464);const r=result(nodes,'R-CTS4385');const direct=select(r,false);assert.equal(direct.rows.length,3);assert.equal(direct.rows.filter(s=>!s.uncertain).length,1);assert.ok(select(r,true).groups.length);assert.equal(select(r,true).rows.some(s=>s.kind==='personal'),false);assert.equal(JSON.stringify(nodes).includes('birth_year'),false);
});
test('TheYtree explicitly personal rows drop names, private text and null type',()=>{
 const nodes=theytree({code:1,data:{ytree:[{hid:1,name:'R-YP5527',parent:0},{sid:2,parent:1,stype:0,name:'DO NOT COPY',country:'公开地区',email:'secret'},{sid:3,parent:1,stype:null,name:'unknown'},{sid:4,parent:1,stype:1,name:'scientific'},{sid:5,parent:1,stype:2,name:'ancient'}]}});assert.equal(nodes[0].samples.length,3);assert.equal(nodes[0].samples[0].kind,'personal');assert.equal(nodes[0].samples[0].name,'');assert.ok(!JSON.stringify(nodes).includes('DO NOT COPY'));assert.ok(!JSON.stringify(nodes).includes('secret'));
});
test('service source caches are isolated, wrong roots rejected, refresh and cancellation respected',async()=>{
 const data=new Map<string,any>();let requests=0;let body=fixture('yfull-R-YP5527.html');const io={get:async(k:string)=>data.get(k),set:async(k:string,v:any)=>{data.set(k,v);},request:async(url:string)=>{requests++;return {status:200,url,body};},now:()=>100000,id:()=>''};const signal=new AbortController().signal;
 assert.equal((await query(io,'yfull','R-YP5527',false,signal)).status,'ready');assert.equal((await query(io,'yfull','R-YP5527',false,signal)).cached,true);assert.equal(requests,1);await query(io,'yfull','R-YP5527',true,signal);assert.equal(requests,2);assert.equal((await query(io,'yfull','O-F8',false,signal)).status,'unmatched');
 const c=new AbortController();c.abort();await assert.rejects(query(io,'yfull','R-YP5527',true,c.signal));body='<html>Login</html>';await assert.rejects(query(io,'yfull','R-YP5527',true,signal));
});

test('continuation keeps parents, stops on restrictions and does not mark partial trees complete',async()=>{
 const data=new Map<string,any>();const cached=result([{name:'R-YP5527',parent:'',sourceId:'1',snps:[],pending:true,samples:[],groups:[]}]);cached.provider='theytree';cached.updatedAt=100000;cached.complete=false;data.set('samples.v2.theytree.R-YP5527.R-YP5527',cached);
 let status=200,calls=0;const io={get:async(k:string)=>data.get(k),set:async(k:string,v:any)=>{data.set(k,v);},request:async(url:string)=>{calls++;return {status,url,body:JSON.stringify({code:1,data:{ytree:[{hid:1,parent:0,name:'R-YP5527',isParent:1},{hid:2,parent:1,name:'R-YP6497',isParent:1}]}})};},now:()=>100001,id:()=>''};
 const r=await query(io,'theytree','R-YP5527',false,new AbortController().signal,true);assert.equal(calls,1);assert.equal(r.nodes.find(n=>n.name==='R-YP6497')?.parent,'R-YP5527');assert.equal(r.complete,false);
 status=403;const blocked=await query(io,'theytree','R-YP5527',false,new AbortController().signal,true);assert.equal(blocked.complete,false);assert.match(blocked.message,/403/);assert.equal(blocked.nodes.length,2);
});

test('FTDNA alias file 403 resolves only through unique search and canonical root SNP evidence',async()=>{
 for(const mode of ['verified','no-snp','ambiguous','wrong-root','denied','cross-lineage']){
  const data=new Map<string,any>(),urls:string[]=[];const raw=JSON.parse(fixture('ftdna-O-M175-root.json'));
  if(mode==='no-snp')raw.node.variants=raw.node.variants.filter((v:string)=>v!=='F175');if(mode==='wrong-root')raw.node.name='O-OTHER';
  const io={get:async(k:string)=>data.get(k),set:async(k:string,v:any)=>{data.set(k,v);},now:()=>100000,id:()=>'',request:async(url:string)=>{
   urls.push(url);if(url.includes('HaplogroupSearch'))return {status:mode==='denied'?403:200,url,body:JSON.stringify(mode==='ambiguous'?[{name:'O-M175'},{name:'O-F265'}]:[{name:mode==='cross-lineage'?'R-M175':'O-M175',exact:false}])};
   return url.endsWith('O-M175.json')?{status:200,url,body:JSON.stringify(raw)}:{status:403,url,body:'AccessDenied'};
  }};
  if(mode==='verified'){const r=await query(io,'ftdna','O-F175',false,new AbortController().signal);assert.equal(r.target,'O-M175');assert.match(r.mapping,/F175/);assert.equal(urls.length,3);assert.equal((await query(io,'ftdna','O-F175',false,new AbortController().signal)).cached,true);assert.equal(urls.length,3);}
  else{await assert.rejects(query(io,'ftdna','O-F175',false,new AbortController().signal),/403/);assert.equal(data.size,0);}
 }
});
