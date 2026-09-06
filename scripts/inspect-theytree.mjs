// Read-only source inspection: decode a literal-packed script without eval.
import {parse} from 'acorn';
const js=await(await fetch('https://www.theytree.com/static/js/theytree.js?v=20260101-6')).text();
const expression=parse(js,{ecmaVersion:'latest'}).body.find(n=>n.type==='ExpressionStatement')?.expression;
const call=expression?.arguments?.[0];
const payload=call?.arguments?.[0]?.value,base=call?.arguments?.[1]?.value;
const dictionary=call?.arguments?.[3]?.callee?.object?.value;
if(typeof payload!=='string'||typeof dictionary!=='string'||base!==62)throw Error('Unexpected packed format');
const words=dictionary.split('|'),alphabet='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const decoded=payload.replace(/\b\w+\b/g,t=>{let n=0;for(const c of t){const k=alphabet.indexOf(c);if(k<0)return t;n=n*base+k;}return words[n]||t;});
for(const hit of decoded.matchAll(/.{0,220}(?:url:|user_anc|sample\/|\/sample|stype|beforeExpand|onClick:|getHaplogroup|dataFilter).{0,500}/g))console.log(hit[0]);
