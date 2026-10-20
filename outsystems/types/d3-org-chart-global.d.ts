// The chart is loaded as a plain script (dist/d3-org-chart.min.js), which exposes it as `d3.OrgChart`.
// Only the surface the OutSystems provider uses is declared here; see index.d.ts for the full API.
declare namespace D3OrgChart {
	interface HierarchyNode {
		data: Record<string, unknown>;
		depth: number;
		width: number;
		height: number;
	}

	interface Chart {
		[attr: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
		container(value: Element): Chart;
		data(): Record<string, unknown>[];
		data(value: Record<string, unknown>[]): Chart;
		nodeId(value: (row: Record<string, unknown>) => string | undefined): Chart;
		parentNodeId(value: (row: Record<string, unknown>) => string | undefined): Chart;
		nodeContent(value: (node: HierarchyNode) => string): Chart;
		nodeWidth(value: (node: HierarchyNode) => number): Chart;
		nodeHeight(value: (node: HierarchyNode) => number): Chart;
		onNodeClick(value: (node: HierarchyNode, event: Event) => void): Chart;
		onExpandOrCollapse(value: (node: HierarchyNode, expanded: boolean) => void): Chart;
		render(): Chart;
		fit(options?: { animate?: boolean }): Chart;
		expandAll(): Chart;
		collapseAll(): Chart;
		setExpanded(id: string, expanded?: boolean): Chart;
		setCentered(id: string): Chart;
		setHighlighted(id: string): Chart;
		setUpToTheRootHighlighted(id: string): Chart;
		clearHighlighting(): Chart;
		exportImg(options: { full?: boolean; scale?: number; save?: boolean; backgroundColor?: string; onLoad?: (dataUrl: string) => void }): void;
		destroy(): Chart;
	}

	interface Namespace {
		OrgChart: new () => Chart;
	}
}

interface Window {
	d3: D3OrgChart.Namespace;
}
