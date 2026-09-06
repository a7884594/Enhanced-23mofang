import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSnpResult,fetchSnpResult} from '../src/ancient/snp-result';
const head='<table><thead><tr><th>SNP</th><th>位置</th><th>突变</th><th>时间</th></tr></thead><tbody>';
// Transcribed from the visible FGC7600 result table, not the surrounding account page.
const html=head+'<tr><td>FGC7600</td><td><span>hg19</span> 2934285<br><span>hg38</span> 3066244<br><span>CP086569.1</span> 2742086<br><span>CP086569.2</span> 2743399</td><td>T-&gt;G</td><td>2020-12-20 13:48:54</td></tr></tbody></table>';
test('SNP parser retains reference builds and mutation while discarding account content',()=>{
 const result=parseSnpResult('<aside>PRIVATE_ACCOUNT</aside>'+html,'FGC7600');assert.equal(result.status,'ok');assert.equal(result.rows[0].mutation,'T->G');assert.equal(result.rows[0].position,'hg19 2934285\nhg38 3066244\nCP086569.1 2742086\nCP086569.2 2743399');assert.ok(!JSON.stringify(result).includes('PRIVATE_ACCOUNT'));
 assert.equal(parseSnpResult(head+'</tbody></table>','FGC7600').status,'empty');
 assert.equal(parseSnpResult('<input type=password>','FGC7600').status,'login');
 assert.equal(parseSnpResult('<h1>Access Denied</h1>','FGC7600').status,'error');
});
test('lookup requests only the fixed SNP page using browser session, and distinguishes access errors',async()=>{
 const original=globalThis.fetch;let status=200;const calls:any[]=[];
 globalThis.fetch=async(url:any,opts:any)=>{calls.push({url,opts});return {url:String(url),ok:status===200,status,text:async()=>html} as Response;};
 try{assert.equal((await fetchSnpResult('FGC7600')).status,'ok');assert.equal(calls[0].opts.credentials,'include');const u=new URL(calls[0].url);assert.equal(u.pathname,'/user/ysnp/snps');assert.equal(u.searchParams.get('snpname'),'FGC7600');
 status=403;assert.equal((await fetchSnpResult('FGC7600')).status,'login');status=500;assert.equal((await fetchSnpResult('FGC7600')).status,'error');await assert.rejects(fetchSnpResult('javascript:alert(1)'));assert.equal(calls.length,3);
 }finally{globalThis.fetch=original;}
});
