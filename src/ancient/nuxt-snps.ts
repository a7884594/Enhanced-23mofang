import {parse} from 'acorn';
import {snps} from './snps';
// Interpret only literal Nuxt serialization. Downloaded scripts are never run.
function literal(n:any,env:any=Object.create(null)):any {
  if(!n)throw Error('缺少页面数据');
  switch(n.type){
    case 'Literal':return n.value;
    case 'Identifier':if(Object.hasOwn(env,n.name))return env[n.name];if(n.name==='undefined')return undefined;break;
    case 'ArrayExpression':return n.elements.map((x:any)=>x?literal(x,env):null);
    case 'ObjectExpression':{const o=Object.create(null);for(const p of n.properties){const k=p.key?.name??p.key?.value;if(p.type!=='Property'||p.computed||p.kind!=='init'||['__proto__','constructor','prototype'].includes(k))throw Error('非字面量属性');o[k]=literal(p.value,env);}return o;}
    case 'UnaryExpression':{const v=literal(n.argument,env);if(n.operator==='!')return !v;if(n.operator==='-')return -v;if(n.operator==='+')return +v;if(n.operator==='void')return undefined;break;}
    case 'CallExpression':{const f=n.callee;if(f.type!=='FunctionExpression'||f.body.body.length!==1||f.body.body[0].type!=='ReturnStatement')break;const scope=Object.create(null);f.params.forEach((p:any,i:number)=>{if(p.type!=='Identifier')throw Error('非字面量参数');scope[p.name]=literal(n.arguments[i],env);});return literal(f.body.body[0].argument,scope);}
  }
  throw Error('页面包含不可解析的数据表达式');
}
export function htmlSnps(html:string,name:string):string[]{
  const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.startsWith('window.__NUXT__='));
  if(!source)return [];
  const ast:any=parse(source,{ecmaVersion:2022});const a=ast.body[0]?.expression;
  if(a?.type!=='AssignmentExpression')return [];
  const nuxt=literal(a.right);const stack=(nuxt.data||[]).map((d:any)=>d?.treeData);let count=0;
  while(stack.length&&count++<150000){const n=stack.pop();if(!n)continue;
    if(n.id===name)return snps(n.rsids);
    if(Array.isArray(n.children))stack.push(...n.children);
  }
  return [];
}
