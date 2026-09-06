import {type QueryResult,type Branch,type AncientSample} from './model';
function eligible(j:QueryResult){return j.complete&&j.scope==='downstream'&&!j.failures.length&&!j.queue.length&&!j.details.length&&!j.unknown.length&&j.samples.every(s=>s.detail&&!s.tentative);}
export function graph(j:QueryResult){
  const roots=j.branches.filter(b=>b.marker===j.target&&!b.tentative);if(roots.length!==1)return [];
  const children=new Map<string,Branch[]>();for(const b of j.branches){const list=children.get(b.parent)||[];list.push(b);children.set(b.parent,list);}
  const seen=new Set<string>();const queue=[roots[0]],rows:Branch[]=[];
  for(let i=0;i<queue.length;i++){const b=queue[i];if(seen.has(b.id)||b.tentative)continue;seen.add(b.id);rows.push(b);queue.push(...children.get(b.id)||[]);}
  return rows;
}
function view(j:QueryResult,b:Branch,samples:AncientSample[],branches:Branch[],scope:'direct'|'downstream'):QueryResult {
  return {...j,marker:b.marker,target:b.marker,scope,nodeSnps:undefined,snpChecks:[],mappingReady:true,mappingToken:'',syncToken:'',forceRefresh:false,cached:false,
    mapping:`同名标记对应，挂载关系以TheYtree为准；来自 ${j.marker} 的包含下游查询`,
    samples,branches,checked:branches.map(b=>b.id),unknown:[],failures:[],queue:[],details:[],excluded:0,
    projectedVersion:undefined,cachedChildren:undefined,cacheOrigin:{marker:j.marker,at:j.updatedAt},mappingVerifiedAt:undefined,
    message:`查询完成 · 复用 ${j.marker} 已核查的${scope==='direct'?'本节点':'下游'}数据`};
}
/** Linear grouping: don't duplicate an entire ancestor graph in every child cache. */
export function* directProjections(j:QueryResult):Generator<QueryResult>{
  if(!eligible(j))return;
  const rows=graph(j),checked=new Set(j.checked),names=new Map<string,number>(),samples=new Map<string,AncientSample[]>();
  for(const b of rows)names.set(b.marker,(names.get(b.marker)||0)+1);
  for(const s of j.samples){const list=samples.get(s.parentId)||[];list.push(s);samples.set(s.parentId,list);}
  for(const b of rows){if(b.pending||!checked.has(b.id)||names.get(b.marker)!==1)continue;
    yield view(j,b,(samples.get(b.id)||[]).map(s=>({...s,path:[b.marker]})),[{...b,pending:false}],'direct');
  }
}
export function subtreeProjection(j:QueryResult,name:string):QueryResult|null{
  if(!eligible(j))return null;
  const rows=graph(j),roots=rows.filter(b=>b.marker===name);if(roots.length!==1)return null;const root=roots[0];
  const children=new Map<string,Branch[]>();for(const b of rows){const list=children.get(b.parent)||[];list.push(b);children.set(b.parent,list);}
  const branches:Branch[]=[],index=new Map<string,Branch>(),queue=[root],checked=new Set(j.checked);
  for(let i=0;i<queue.length;i++){const b=queue[i];if(index.has(b.id))continue;if(b.pending||!checked.has(b.id))return null;index.set(b.id,b);branches.push(b);queue.push(...children.get(b.id)||[]);}
  const samples=j.samples.flatMap(s=>{if(!index.has(s.parentId))return [];const path:string[]=[];let b=index.get(s.parentId)!;while(b){path.unshift(b.marker);if(b.id===root.id)break;b=index.get(b.parent)!;}return [{...s,path}];});
  return {...view(j,root,samples,branches,'downstream'),projectedVersion:1,cachedChildren:branches.length-1};
}
