export const NODE_FILTER_CHANNEL = 'enhanced-23mofang:node-filter:v2';
export const NODE_FILTER_PARAM = 'mofangMinSamples';

export interface NodeFilterThresholds { minSamples: number }

export function normalizeThreshold(value: unknown): number {
  const parsed=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
  return parsed>=0&&Number.isSafeInteger(Math.floor(parsed))?Math.floor(parsed):0;
}
export function isTreePath(path:string):boolean {return /^\/ancestry\/ytree\/[^/]+\/?$/.test(path);}
export function routeThreshold(url:URL):number {
  const values=url.searchParams.getAll(NODE_FILTER_PARAM);
  return isTreePath(url.pathname)&&values.length===1?normalizeThreshold(values[0]):0;
}
export interface NodeFilterState {
  route:string; epoch:number; revision:number; componentId:string;
  draft:number; applied:number;
  status:'ready'|'unavailable'|'inactive'|'navigating';
  error:string;
}
