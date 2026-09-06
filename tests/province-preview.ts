// Browser regression fixture: a real ECharts province map initialized at zero
// size while hidden. This replaces the old text-only original-map placeholder.
import * as echarts from 'echarts/core';
import {GeoComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
echarts.use([GeoComponent,CanvasRenderer]);
const container=document.querySelector<HTMLElement>('.parentsum-distributed-map-container')!;
container.textContent='';container.style.background='white';container.style.padding='0';
const map=document.createElement('div');map.style.cssText='width:100%;height:360px';map.setAttribute('aria-label','省级地图真实画布');container.append(map);
setTimeout(async()=>{
  const data=await(await fetch('/assets/counties.geo.json')).json();
  const features=data.features.filter((f:any)=>f.properties.code.startsWith('outline-'));
  echarts.registerMap('original-provinces',{type:'FeatureCollection',features});
  const real=echarts.init(map,undefined,{width:0,height:0});
  const root=(window as any).$nuxt;
  const showDimensions=()=>{container.dataset.chartWidth=String(real.getWidth());container.dataset.chartHeight=String(real.getHeight());document.querySelector('#province-size')!.textContent=`原图画布：${real.getWidth()} × ${real.getHeight()}`;};
  const instance={getDom:()=>map,isDisposed:()=>real.isDisposed(),resize:(options:any)=>{real.resize(options);showDimensions();}};
  root.$children[0].$children.push({myChart:instance,$el:map,$children:[]});
  function update(){
    const rows=root.$children[0].branchData?.geographicDistribution?.chartItems||[];
    const values=new Map(rows.map((r:any)=>[`outline-${r.code.padEnd(6,'0')}`,r.percent]));
    real.setOption({animation:false,geo:{map:'original-provinces',nameProperty:'code',roam:true,label:{show:false},itemStyle:{areaColor:'#eee',borderColor:'#aabacb',borderWidth:.5},regions:features.map((f:any)=>({name:f.properties.code,itemStyle:{areaColor:values.has(f.properties.code)?'#5792c9':'#eee'}}))}});
    showDimensions();
  }
  window.addEventListener('preview-branch-change',update);
  showDimensions();
  try{update();}catch{document.querySelector('#province-size')!.textContent+='（模拟隐藏初始化，等待切回原图）';}
},1000);
