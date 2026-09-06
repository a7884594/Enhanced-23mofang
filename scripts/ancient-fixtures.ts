import {mkdir,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {normalizeTree,selectSamples,queryUrl} from '../src/ancient/model';
import {parseDetail} from '../src/ancient/parser';
await mkdir('tests/fixtures/ancient',{recursive:true});
const stdin=async()=>{const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,''));};
async function detail(au:string,url:string,html:string){
  const parsed=parseDetail(html,url);if(parsed.type!=='ancient')throw Error(`No ancient detail ${au}`);
  const doc=parseHTML(html).document;const fields=['name','sid','stype','haplogroup','quality','country','nativeplace','culture','period','data_source'];
  const safe=fields.map(key=>doc.querySelector(`label[for="input-${key}"]`)?.parentElement?.outerHTML||'').join('\n');
  await writeFile(`tests/fixtures/ancient/${au}.html`,safe);await writeFile(`tests/fixtures/ancient/${au}.json`,JSON.stringify({url,...parsed}));
  console.log(JSON.stringify({au,type:parsed.type,marker:parsed.sample?.marker}));
}
if(process.argv.includes('--detail-stdin')){const input=await stdin();await detail(input.au,input.url,input.html);process.exit(0);}
const page=normalizeTree(process.argv.includes('--stdin')?await stdin():await(await fetch(queryUrl('O-F8'))).json());
if(!page.valid)throw Error(page.reason);
await writeFile('tests/fixtures/ancient/O-F8.json',JSON.stringify(page));
const root=page.branches.find(b=>b.marker==='O-F8')!;
console.log(JSON.stringify({branches:page.branches.length,direct:selectSamples(page,root,'direct').samples.length,downstream:selectSamples(page,root,'downstream').samples.length,pending:page.branches.filter(b=>b.pending).length}));
if(process.argv.includes('--stdin'))process.exit(0);
for(const au of ['AU334','AU104785']){
  const source=page.samples.find(s=>s.au===au)!;await detail(au,source.url,await(await fetch(source.url)).text());
}
