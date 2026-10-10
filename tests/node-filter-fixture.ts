// Synthetic page using the site's Vue 2 / Vue Router 3 component contract.
// No credentials, personal samples or live API requests are used here.
import Vue from 'vue';
import VueRouter from 'vue-router';
Vue.use(VueRouter);Vue.config.productionTip=false;Vue.config.devtools=false;
const NodeFilter=Vue.extend({
  props:['visible','default'],
  data(){return {surnames:[] as string[],birthplace:[] as unknown[],nations:[] as string[],provinces:[] as string[]};},
  created(){const value=this.$props.default||{};this.surnames=[...(value.surnames||[])];this.birthplace=[...(value.birthplace||[])];this.nations=[...(value.nations||[])];},
  computed:{canSubmit():boolean{return this.surnames.length>0||this.provinces.length>0||this.nations.length>0;}},
  methods:{
    handleSubmit(){this.$emit('submit',{surnames:this.surnames,birthplace:this.birthplace,nations:this.nations});this.handleClose();},
    handleReset(){this.surnames=[];this.birthplace=[];this.nations=[];this.provinces=[];this.$emit('reset');},
    handleClose(){this.$emit('close');},
  },
  render(h){return h('div',{style:{display:this.$props.visible?'':'none'}},[h('section',{class:'node-filter-container'},[
    h('h2','筛选'),h('div',{class:'node-filter-content'},[h('label',['官方姓氏条件 ',h('input',{attrs:{'aria-label':'官方姓氏条件'},domProps:{value:this.surnames.join('')},on:{input:(e:Event)=>{const text=(e.target as HTMLInputElement).value;this.surnames=text?[text]:[];}}})])]),
    h('footer',[h('button',{attrs:{'data-action':'reset'},on:{click:this.handleReset}},'重置'),h('button',{attrs:{disabled:!this.canSubmit,'data-action':'confirm'},on:{click:this.handleSubmit}},'确定'),h('button',{on:{click:this.handleClose}},'关闭')])])]);},
});
const Page=Vue.extend({
  data(){return {visible:true,nativeRequest:'{}',redraw:0};},
  computed:{nativeFilters():any{try{return JSON.parse(String(this.$route.query.filterParams||'{}'));}catch{return {};}}},
  watch:{'$route.fullPath'(){this.nativeRequest=JSON.stringify(this.nativeFilters);this.$nextTick(this.markNodes);}},
  mounted(){this.markNodes();this.nativeRequest=JSON.stringify(this.nativeFilters);},updated(){this.markNodes();},
  methods:{
    markNodes(){let parent:any=null;for(const [index,node]of Array.from(this.$el.querySelectorAll<SVGGElement>('g.node')).entries()){const data={x:20,y:index*60,data:{clanRelationCount:[100,2,8][index]},parent};(node as any).__data__=data;if(index===0)parent=data;}},
    handleFilter(payload:any){return this.$router.push({path:this.$route.path,query:{...this.$route.query,filterParams:JSON.stringify(payload)}}).catch(()=>{});},
    handleFilterReset(){const query={...this.$route.query};delete query.filterParams;return this.$router.replace({path:this.$route.path,query}).catch(()=>{});},
    handleResetNode(node:string,query=''){return this.$router.push('/ancestry/ytree/'+node+query).catch(()=>{});},
  },
  render(h){return h('main',[
    h('h1','最小宗亲人数 · 生命周期验证'),h('p','模拟官方 Vue 组件与路由，节点为测试数据。'),
    h('nav',[h('button',{on:{click:()=>{this.visible=!this.visible;}}},'筛选'),h('button',{on:{click:()=>this.handleResetNode('O-F2890')}},'树内切换支系'),h('button',{on:{click:()=>this.$router.push('/ancestry/ytree/O-F2758').catch(()=>{})}},'打开普通网址'),h('button',{on:{click:()=>{this.redraw++;}}},'模拟树重绘')]),
    h('code',{attrs:{'data-route':''}},this.$route.fullPath),
    h(NodeFilter,{key:this.$route.fullPath,props:{visible:this.visible,default:this.nativeFilters},on:{submit:this.handleFilter,reset:this.handleFilterReset,close:()=>{this.visible=false;}}}),
    h('div',{class:'tree-wrapper'},[h('svg',{key:this.redraw,class:'overlay',attrs:{height:220,width:360}},['根节点 · 宗亲 100 人','小支系 · 宗亲 2 人','大支系 · 宗亲 8 人'].map((label,index)=>h('g',{class:'node',attrs:{transform:'translate(20,'+(index*60)+')','data-count':[100,2,8][index]}},[h('rect',{class:'label-wrapper',attrs:{width:300,height:38,rx:7,fill:'#e8f1f5'}}),h('text',{attrs:{x:12,y:25,fill:'#244559'}},label)])))]),
    h('h3','官方请求参数（不含扩展人数字段）'),h('pre',{attrs:{'data-native-request':''}},this.nativeRequest),
  ]);},
});
const router=new VueRouter({mode:'history',routes:[{path:'/ancestry/ytree/:id',component:Page}]});
(Vue.prototype as any).$nuxt={refresh:()=>{}};
if(!(window as any).chrome?.storage)(window as any).chrome={storage:{local:{get:async()=>({}),remove:async()=>{}}}};
new Vue({router,render:h=>h('router-view')}).$mount('#app');
