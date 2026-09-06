import {htmlSnps} from '../src/ancient/nuxt-snps';
import {writeFile} from 'node:fs/promises';
let html='';for await(const c of process.stdin)html+=c;
const name='O-MF9915',values=htmlSnps(html,name);
if(!values.includes('BY220310'))throw Error('未读取到真实节点SNP');
const evidence={marker:name,snps:values,source:`https://www.23mofang.com/ancestry/ytree/${name}`,capturedAt:new Date().toISOString()};
await writeFile('tests/fixtures/ancient/MF9915-node.json',JSON.stringify(evidence,null,2));console.log(evidence);
