import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {badgePosition} from '../src/ancient/badge-layout';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
test('native new-branch tag remains unobstructed with scaled compact and counted badges',()=>{
  const dom=new JSDOM('<svg><g id="node"><g class="snp-wrapper"></g><g id="new"></g><g id="offrow"></g><g data-mofang-ancient><rect height="20"/></g><g data-mofang-research><rect height="20"/></g></g></svg>');
  try{
    const node=dom.window.document.querySelector('#node') as SVGGElement;
    const ancient=node.querySelector('[data-mofang-ancient]') as SVGGElement,research=node.querySelector('[data-mofang-research]') as SVGGElement;
    let scale=1,width=20;
    const box=(left:number,right:number,top=3,bottom=23)=>({left:100+left*scale,right:100+right*scale,top:50+top*scale,bottom:50+bottom*scale,width:(right-left)*scale,height:(bottom-top)*scale} as DOMRect);
    node.getScreenCTM=()=>({a:scale,d:scale,e:100,f:50} as DOMMatrix);
    node.querySelector('.snp-wrapper')!.getBoundingClientRect=()=>box(200,230);
    const tag=node.querySelector('#new') as Element;tag.getBoundingClientRect=()=>box(234,306);
    node.querySelector('#offrow')!.getBoundingClientRect=()=>box(0,1000,60,80);
    let ancientX=0;
    ancient.getBoundingClientRect=()=>box(ancientX,ancientX+width);
    for(scale of [.5,1,1.8])for(width of [20,92]){
      const a=badgePosition(node,ancient,false)!;ancientX=a.x;
      const r=badgePosition(node,research,true)!;
      assert.ok(Math.abs(a.x-309)<1e-8);assert.ok(Math.abs(r.x-a.x-width-3)<1e-8);assert.ok(Math.abs(a.y-3)<1e-8);assert.ok(Math.abs(r.y-3)<1e-8);
    }
    scale=1;tag.remove();assert.equal(badgePosition(node,ancient,false)!.x,233);
    ancient.setAttribute('aria-hidden','true');assert.equal(badgePosition(node,research,true)!.x,233);
  }finally{dom.window.close();}
});
