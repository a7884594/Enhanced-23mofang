// MAIN-world bridge: D3 stores tree data on DOM expandos that are not visible
// to Chrome's isolated content-script world.
import {NODE_FILTER_CHANNEL, type NodeFilterThresholds} from './node-filter-shared';

const NODE_SEL = '.tree-wrapper g.node';
const LINK_SEL = '.tree-wrapper path.link';

interface NodeCounts { samples: number | null }
interface ManagedValue { original: string | null; applied: string | null }
type StyledElement = HTMLElement | SVGElement;
interface Point { x: number; y: number }
interface LinkPath { sourceX: number; sourceY: number; targetX: number; targetY: number }
interface NodeLayout {
  element: HTMLElement;
  datum: any;
  point: Point;
  originalDisplay: string;
  hidden: boolean;
  newY: number;
}

const managedAttributes = new WeakMap<Element, Map<string, ManagedValue>>();
const managedDisplays = new WeakMap<StyledElement, {original: string; applied: string}>();

function setAttributeValue(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function restoreAttribute(element: Element, name: string): string | null {
  const current = element.getAttribute(name);
  let values = managedAttributes.get(element);
  if (!values) { values = new Map(); managedAttributes.set(element, values); }
  let state = values.get(name);
  if (!state) { state = {original: current, applied: current}; values.set(name, state); }
  else if (current !== state.applied) state.original = current;
  setAttributeValue(element, name, state.original);
  state.applied = state.original;
  return state.original;
}

function applyAttribute(element: Element, name: string, value: string | null): void {
  const values = managedAttributes.get(element);
  const state = values?.get(name);
  if (!state) throw new Error(`Attribute ${name} must be restored before it is managed`);
  setAttributeValue(element, name, value);
  state.applied = value;
}

function restoreDisplay(element: StyledElement): string {
  const current = element.style.display;
  let state = managedDisplays.get(element);
  if (!state) { state = {original: current, applied: current}; managedDisplays.set(element, state); }
  else if (current !== state.applied) state.original = current;
  element.style.display = state.original;
  state.applied = state.original;
  return state.original;
}

function applyDisplay(element: StyledElement, value: string): void {
  const state = managedDisplays.get(element);
  if (!state) throw new Error('Display must be restored before it is managed');
  element.style.display = value;
  state.applied = value;
}

function transformPoint(value: string | null): Point | null {
  if (value === null || value.trim() === '') return {x: 0, y: 0};
  const match = /^translate\(\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)\s*\)$/.exec(value);
  if (!match) return null;
  const point = {x: Number(match[1]), y: Number(match[2])};
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
}

function linkPath(value: string | null): LinkPath | null {
  if (!value) return null;
  const match = /^M\s*([-+\d.eE]+)[ ,]([-+\d.eE]+)\s*L\s*([-+\d.eE]+)[ ,]([-+\d.eE]+)\s*L\s*([-+\d.eE]+)[ ,]([-+\d.eE]+)\s*$/.exec(value);
  if (!match) return null;
  const values = match.slice(1).map(Number);
  if (values.some(value => !Number.isFinite(value))) return null;
  return {sourceX: values[0], sourceY: values[1], targetX: values[4], targetY: values[5]};
}

function rowGap(layouts: NodeLayout[]): number {
  const rows = [...new Set(layouts.map(layout => layout.point.y))].sort((a, b) => a - b);
  const gaps = rows.slice(1).map((row, index) => row - rows[index]).filter(gap => gap > 0).sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 50;
}

function finalPoint(node: Element, transform: string | null): Point | null {
  const datum = (node as any).__data__;
  if (typeof datum?.x === 'number' && Number.isFinite(datum.x) && typeof datum?.y === 'number' && Number.isFinite(datum.y)) {
    // 23mofang assigns x=getIndent(node) and y=preorderIndex*50, then renders
    // transform="translate(x,y)". New nodes animate from their parent's x0/y0.
    return {x: datum.x, y: datum.y};
  }
  return transformPoint(transform);
}

function nodeRowHeight(layout: NodeLayout): number {
  const height = Number(layout.element.querySelector('.label-wrapper')?.getAttribute('height'));
  return Number.isFinite(height) && height > 0 ? height : 30;
}

function sourceAnchorX(layout: NodeLayout, originalAnchors: Map<any, number>): number {
  if (!layout.datum?.parent) {
    const width = Number(layout.element.querySelector('.label-wrapper')?.getAttribute('width'));
    if (Number.isFinite(width) && width > 0) return layout.point.x + width / 2;
    return originalAnchors.get(layout.datum) ?? layout.point.x;
  }
  return layout.point.x + 12;
}

function structuralTreeMutation(record: MutationRecord): boolean {
  const asElement = (node: Node | null): Element | null => node?.nodeType === 1 ? node as Element : null;
  const target = asElement(record.target) ?? asElement(record.target.parentNode);
  if (!target?.closest('.tree-wrapper')) return false;
  if (record.type === 'attributes') return target.matches('g.node,path.link,svg.overlay');
  const changed = [...record.addedNodes, ...record.removedNodes];
  return changed.some(node => {
    const element = asElement(node);
    return !!element && (element.matches('g.node,path.link,.tree-wrapper,svg.overlay') ||
      !!element.querySelector('g.node,path.link,.tree-wrapper,svg.overlay'));
  });
}

function threshold(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function nodeCounts(node: Element): NodeCounts | null {
  const hierarchy = (node as any).__data__;
  if (!hierarchy || typeof hierarchy !== 'object') return null;
  const data = hierarchy.data;
  const rawSamples = data?.clanRelationCount;
  const samples = typeof rawSamples === 'number' && Number.isFinite(rawSamples) && rawSamples >= 0 ? rawSamples : null;
  return {samples};
}

export function applyPageNodeFilter(documentRoot: Document, raw: unknown): void {
  const value = raw as Partial<NodeFilterThresholds> | null;
  const filter = {minSamples: threshold(value?.minSamples)};
  const active = filter.minSamples > 0;
  const nodes = Array.from(documentRoot.querySelectorAll<HTMLElement>(NODE_SEL));
  const links = Array.from(documentRoot.querySelectorAll<SVGPathElement>(LINK_SEL));
  const svg = nodes[0]?.closest('svg');
  const layouts: NodeLayout[] = [];

  for (const node of nodes) {
    const transform = restoreAttribute(node, 'transform');
    const originalDisplay = restoreDisplay(node);
    const point = finalPoint(node, transform);
    const counts = nodeCounts(node);
    // Do not compact a partially rendered tree: its link identities and
    // coordinates are not stable yet. Unknown counts themselves remain visible.
    if (!point || !(node as any).__data__ || !counts) continue;
    const belowSamples = filter.minSamples > 0 && counts.samples !== null && counts.samples < filter.minSamples;
    layouts.push({element: node, datum: (node as any).__data__, point, originalDisplay,
      hidden: originalDisplay === 'none' || belowSamples, newY: point.y});
  }
  const linkLayouts = links.map(element => ({
    element,
    datum: (element as any).__data__,
    path: linkPath(restoreAttribute(element, 'd')),
    originalDisplay: restoreDisplay(element),
  }));
  const originalHeight = svg ? restoreAttribute(svg, 'height') : null;

  if (!active) return;
  // Fail open if D3 has not finished binding every node/link. Hiding with an
  // incomplete layout would recreate the large blank-area failure mode.
  if (!svg || layouts.length !== nodes.length || linkLayouts.some(link => !link.path || !link.datum)) return;

  const byDatum = new Map<any, NodeLayout>(layouts.map(layout => [layout.datum, layout]));
  const targetOf = (datum: any) => byDatum.has(datum) ? datum : byDatum.has(datum?.target) ? datum.target : null;
  if (linkLayouts.some(link => !targetOf(link.datum))) return;
  const visible = layouts.filter(layout => !layout.hidden).sort((a, b) => a.point.y - b.point.y);
  const visibleData = new Set(visible.map(layout => layout.datum));
  const gap = rowGap(layouts);
  const firstY = Math.min(...layouts.map(layout => layout.point.y));
  visible.forEach((layout, index) => { layout.newY = firstY + index * gap; });

  for (const layout of layouts) {
    if (layout.hidden) { applyDisplay(layout.element, 'none'); continue; }
    applyDisplay(layout.element, layout.originalDisplay);
    if (layout.newY !== layout.point.y) applyAttribute(layout.element, 'transform', `translate(${layout.point.x}, ${layout.newY})`);
  }

  const sourceAnchors = new Map<any, number>();
  for (const link of linkLayouts) {
    const target = targetOf(link.datum);
    const source = byDatum.has(link.datum?.source) ? link.datum.source : target?.parent;
    if (byDatum.has(source) && link.path) sourceAnchors.set(source, link.path.sourceX);
  }
  for (const link of linkLayouts) {
    const target = targetOf(link.datum);
    const targetLayout = byDatum.get(target);
    if (!targetLayout || !visibleData.has(target)) { applyDisplay(link.element, 'none'); continue; }
    const immediateSource = byDatum.has(link.datum?.source) ? link.datum.source : target?.parent;
    let source = immediateSource;
    while (source && !visibleData.has(source)) source = source.parent;
    const sourceLayout = byDatum.get(source);
    if (!sourceLayout || !link.path) { applyDisplay(link.element, 'none'); continue; }
    const sourceX = sourceAnchorX(sourceLayout, sourceAnchors);
    const sourceY = sourceLayout.newY + nodeRowHeight(sourceLayout);
    const targetY = targetLayout.newY + nodeRowHeight(targetLayout) / 2;
    applyDisplay(link.element, link.originalDisplay);
    applyAttribute(link.element, 'd', `M${sourceX},${sourceY}L${sourceX},${targetY}L${targetLayout.point.x},${targetY}`);
  }

  const originalHeightNumber = Number(originalHeight);
  if (Number.isFinite(originalHeightNumber) && visible.length) {
    const originalLastY = Math.max(...layouts.map(layout => layout.point.y));
    const bottomPadding = Math.max(gap, originalHeightNumber - originalLastY);
    applyAttribute(svg, 'height', String(visible.at(-1)!.newY + bottomPadding));
  }
}

export function installPageNodeFilterBridge(pageWindow: Window): MutationObserver {
  const documentRoot = pageWindow.document;
  let currentFilter: NodeFilterThresholds | null = null;
  let observing = false;
  const MutationObserverConstructor = (pageWindow as Window & {MutationObserver: typeof MutationObserver}).MutationObserver;
  const observer = new MutationObserverConstructor((records: MutationRecord[]) => {
    if (!currentFilter || !records.some(structuralTreeMutation)) return;
    applyCurrent();
  });
  const observe = () => {
    if (observing) return;
    observer.observe(documentRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['transform', 'd', 'height'],
    });
    observing = true;
  };
  const applyCurrent = () => {
    if (!currentFilter) return;
    observer.disconnect();
    observing = false;
    try { applyPageNodeFilter(documentRoot, currentFilter); }
    finally { observe(); }
  };
  pageWindow.addEventListener('message', event => {
    if (event.source !== pageWindow || event.origin !== pageWindow.location.origin) return;
    if (event.data?.channel !== NODE_FILTER_CHANNEL || event.data?.type !== 'apply') return;
    const value = event.data.filter as Partial<NodeFilterThresholds> | null;
    currentFilter = {minSamples: threshold(value?.minSamples)};
    applyCurrent();
  });
  observe();
  return observer;
}

if (typeof window !== 'undefined') {
  const pageWindow = window as any;
  if (!pageWindow.__mofangNodeFilterBridgeV1) {
    pageWindow.__mofangNodeFilterBridgeV1 = true;
    installPageNodeFilterBridge(window);
  }
}
