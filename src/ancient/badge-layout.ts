/** Keep badges after all visible native controls on the SNP row. */
export function badgePosition(node:SVGGElement,button:SVGGElement,research:boolean):{x:number;y:number}|null {
  const matrix=node.getScreenCTM();if(!matrix?.a)return null;
  const snp=node.querySelector<SVGGElement>(':scope > .snp-wrapper');
  const ancient=research?node.querySelector<SVGGElement>(':scope > [data-mofang-ancient]'):null;
  const adjacent=ancient?.getAttribute('aria-hidden')!=='true'?ancient?.getBoundingClientRect():null;
  const bounds=adjacent?.width?adjacent:snp?.getBoundingClientRect();
  const height=Number(button.querySelector('rect')?.getAttribute('height')||20);
  const center=bounds?.height?bounds.top+bounds.height/2:matrix.f+(3+height/2)*(matrix.d||1);
  const half=height*Math.abs(matrix.d||1)/2;
  let right=bounds?.width?bounds.right:matrix.e;
  for(const child of node.children){
    if(child===button||child.hasAttribute('data-mofang-ancient')||child.hasAttribute('data-mofang-research')||child.hasAttribute('data-mofang-multi'))continue;
    const box=child.getBoundingClientRect();
    if(!box.width||!box.height||box.bottom<=center-half||box.top>=center+half)continue;
    const style=node.ownerDocument.defaultView?.getComputedStyle(child);if(style?.visibility==='hidden'||style?.display==='none')continue;
    right=Math.max(right,box.right);
  }
  return {x:(right-matrix.e)/matrix.a+3,y:matrix.d?(center-matrix.f)/matrix.d-height/2:3};
}
