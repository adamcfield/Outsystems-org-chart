// eslint-disable-next-line @typescript-eslint/no-unused-vars
namespace OutSystems.OrgChart.OrgChartAPI {
	const _orgChartsMap = new Map<string, Patterns.IOrgChart>();

	// Same response shape as the OutSystems UI client actions: a JSON text with code, isSuccess and message
	function Respond(errorCode: string, callback: () => unknown, hasValue = false): string {
		return OutSystems.OSUI.Utils.CreateApiResponse({ errorCode, callback, hasValue });
	}

	function WithChart(orgChartId: string, errorCode: string, action: (orgChart: Patterns.IOrgChart) => void): string {
		return Respond(errorCode, () => action(GetOrgChartById(orgChartId)));
	}

	export function ChangeProperty(orgChartId: string, propertyName: string, propertyValue: unknown): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailChangeProperty, (orgChart) =>
			orgChart.changeProperty(propertyName, propertyValue)
		);
	}

	export function CenterNode(orgChartId: string, nodeId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailCenterNode, (orgChart) => orgChart.centerNode(String(nodeId)));
	}

	export function ClearHighlight(orgChartId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailClearHighlight, (orgChart) => orgChart.clearHighlight());
	}

	export function CollapseAll(orgChartId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailCollapseAll, (orgChart) => orgChart.collapseAll());
	}

	/** Creates the pattern instance. configs is the block's configuration structure, as JSON text or object */
	export function Create(orgChartId: string, configs: string | JSON, provider?: string): Patterns.IOrgChart {
		if (_orgChartsMap.has(orgChartId)) {
			throw new Error(`There is already an ${Enum.PatternName} registered under id: ${orgChartId}`);
		}
		const parsedConfigs = (typeof configs === 'string' ? JSON.parse(configs) : configs) as JSON;
		const orgChart = Patterns.NewOrgChart(
			orgChartId,
			parsedConfigs,
			(provider || Enum.Provider.D3OrgChart) as Enum.Provider
		);
		_orgChartsMap.set(orgChartId, orgChart);
		return orgChart;
	}

	export function Dispose(orgChartId: string): string {
		return Respond(Enum.ErrorCodes.FailDispose, () => {
			const orgChart = GetOrgChartById(orgChartId);
			orgChart.dispose();
			_orgChartsMap.delete(orgChart.uniqueId);
		});
	}

	export function ExpandAll(orgChartId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailExpandAll, (orgChart) => orgChart.expandAll());
	}

	/** Renders the chart to a PNG; the data URL arrives in the OnExportReady event */
	export function ExportImage(orgChartId: string, full = true): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailExportImage, (orgChart) => orgChart.exportImage(full));
	}

	export function Fit(orgChartId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailFit, (orgChart) => orgChart.fit());
	}

	export function GetAllOrgCharts(): Array<string> {
		return OSFramework.OSUI.Helper.MapOperation.ExportKeys(_orgChartsMap);
	}

	export function GetOrgChartById(orgChartId: string): Patterns.IOrgChart {
		return OSFramework.OSUI.Helper.MapOperation.FindInMap(
			Enum.PatternName,
			orgChartId,
			_orgChartsMap
		) as Patterns.IOrgChart;
	}

	export function HighlightNode(orgChartId: string, nodeId: string, withAncestors = false): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailHighlightNode, (orgChart) =>
			orgChart.highlightNode(String(nodeId), withAncestors)
		);
	}

	export function Initialize(orgChartId: string): Patterns.IOrgChart {
		const orgChart = GetOrgChartById(orgChartId);
		orgChart.build();
		return orgChart;
	}

	export function RegisterCallback(
		orgChartId: string,
		eventName: string,
		callback: OSFramework.OSUI.GlobalCallbacks.OSGeneric
	): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailRegisterCallback, (orgChart) =>
			orgChart.registerCallback(eventName, callback)
		);
	}

	export function SetExpanded(orgChartId: string, nodeId: string, expanded = true): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailSetExpanded, (orgChart) =>
			orgChart.setExpanded(String(nodeId), expanded)
		);
	}

	/** Extensibility: raw d3-org-chart attributes (JSON text or object) applied over the block inputs */
	export function SetProviderConfigs(orgChartId: string, providerConfigs: string | object): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailSetProviderConfigs, (orgChart) =>
			orgChart.setProviderConfigs(providerConfigs as ProviderConfigs)
		);
	}

	export function ZoomIn(orgChartId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailZoomIn, (orgChart) => orgChart.zoomIn());
	}

	export function ZoomOut(orgChartId: string): string {
		return WithChart(orgChartId, Enum.ErrorCodes.FailZoomOut, (orgChart) => orgChart.zoomOut());
	}
}
