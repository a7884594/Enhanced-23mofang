import {parse} from 'acorn';
import {mkdir,writeFile} from 'node:fs/promises';

// Decode Nuxt's literal-packed SSR payload without executing downloaded JavaScript.
export function decodeLiteral(node,env=Object.create(null)) {
  if(!node)throw Error('Missing AST node');
  switch(node.type){
    case 'Literal':return node.value;
    case 'Identifier':if(Object.hasOwn(env,node.name))return env[node.name];if(node.name==='undefined')return undefined;throw Error(`Unknown identifier ${node.name}`);
    case 'ArrayExpression':return node.elements.map(n=>n?decodeLiteral(n,env):null);
    case 'ObjectExpression':{const o=Object.create(null);for(const p of node.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')throw Error('Non-literal property');const key=p.key.name??p.key.value;if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe property');o[key]=decodeLiteral(p.value,env);}return o;}
    case 'UnaryExpression':{const v=decodeLiteral(node.argument,env);switch(node.operator){case '-':return -v;case '+':return +v;case '!':return !v;case 'void':return undefined;default:throw Error('Unsafe unary');}}
    case 'CallExpression':{const fn=node.callee;if(fn.type!=='FunctionExpression'||fn.body.body.length!==1||fn.body.body[0].type!=='ReturnStatement')throw Error('Non-literal function');const scope=Object.create(null);fn.params.forEach((p,i)=>{if(p.type!=='Identifier')throw Error('Non-identifier argument');scope[p.name]=decodeLiteral(node.arguments[i],env);});return decodeLiteral(fn.body.body[0].argument,scope);}
    default:throw Error(`Refusing AST node ${node.type}`);
  }
}
await mkdir('tests/fixtures',{recursive:true});
for(const node of ['O-CTS7316','O-MF564266','O-BY11777']) {
  const url=`https://www.23mofang.com/ancestry/ytree/${node}/branch`;
  const html=await(await fetch(url)).text();
  const source=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.startsWith('window.__NUXT__='));
  if(!source)throw Error(`Missing Nuxt payload: ${node}`);
  const ast=parse(source,{ecmaVersion:2022});
  const assignment=ast.body[0].expression;
  if(assignment.type!=='AssignmentExpression')throw Error('No assignment');
  const nuxt=decodeLiteral(assignment.right);
  const branch=nuxt.data?.find(d=>d?.branchData)?.branchData;
  const geo=branch?.geographicDistribution||{chartItems:[]};
  const fixture={node,branchId:branch?.id,source:url,capturedAt:new Date().toISOString(),geographicDistribution:geo};
  await writeFile(`tests/fixtures/${node}.json`,JSON.stringify(fixture));
  console.log(JSON.stringify({node,branchId:branch?.id,provinces:geo.chartItems?.length,bytes:JSON.stringify(geo).length}));
}
