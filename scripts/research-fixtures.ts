import {mkdir,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {STYPE} from '../src/ancient/profile';
import {normalizeTree} from '../src/ancient/model';
import {parseDetail} from '../src/ancient/parser';
if(STYPE!==1)throw Error('Build this collector with __RESEARCH__=true');
let source='';for await(const c of process.stdin)source+=c;
const input=JSON.parse(source.replace(/^\uFEFF/,''));await mkdir('tests/fixtures/research',{recursive:true});
if(input.kind==='tree'){
 const page=normalizeTree(input.raw);if(!page.valid)throw Error(page.reason);
 await writeFile(`tests/fixtures/research/${input.marker}.json`,JSON.stringify(page));
 console.log(JSON.stringify({branches:page.branches.length,research:page.samples.length,samples:page.samples.slice(0,3).map(s=>({au:s.au,url:s.url,marker:s.marker}))}));
}else{
 const result=parseDetail(input.html,input.url);if(result.type!=='scientific')throw Error('Not explicitly scientific');
 const doc=parseHTML(input.html).document;
 const html=['name','sid','stype','haplogroup','quality','country','nativeplace','data_source'].map(key=>doc.querySelector(`label[for="input-${key}"]`)?.parentElement?.outerHTML||'').join('\n');
 await writeFile(`tests/fixtures/research/${input.au}.html`,html);await writeFile(`tests/fixtures/research/${input.au}.json`,JSON.stringify(result));
 console.log(JSON.stringify({au:input.au,type:result.type,marker:result.sample?.marker}));
}
