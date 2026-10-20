// eslint-disable-next-line @typescript-eslint/no-unused-vars
namespace OutSystems.OrgChart.Enum {
	/** Name used in error messages and in the instances map lookups */
	export const PatternName = 'OrgChart';

	/** Provider implementations available to OrgChartAPI.Create */
	export enum Provider {
		D3OrgChart = 'D3OrgChart',
	}

	/** Events that can be registered with OrgChartAPI.RegisterCallback */
	export enum Events {
		Initialized = 'Initialized',
		OnNodeClick = 'OnNodeClick',
		OnExpandToggle = 'OnExpandToggle',
		OnExportReady = 'OnExportReady',
		OnRenderFailed = 'OnRenderFailed',
	}

	/** Configuration properties, as sent by the block (see OrgChartConfig) */
	export enum Properties {
		Data = 'Data',
		IdField = 'IdField',
		ParentIdField = 'ParentIdField',
		TitleField = 'TitleField',
		SubtitleField = 'SubtitleField',
		ImageUrlField = 'ImageUrlField',
		ClassField = 'ClassField',
		NodeTemplate = 'NodeTemplate',
		Layout = 'Layout',
		Compact = 'Compact',
		NodeWidth = 'NodeWidth',
		NodeHeight = 'NodeHeight',
		Height = 'Height',
		InitialExpandLevel = 'InitialExpandLevel',
		Rtl = 'Rtl',
		AriaLabel = 'AriaLabel',
		ExtendedClass = 'ExtendedClass',
	}

	export enum Layout {
		Top = 'top',
		Bottom = 'bottom',
		Left = 'left',
		Right = 'right',
	}

	export enum Rtl {
		Auto = 'auto',
		Yes = 'true',
		No = 'false',
	}

	export enum CssClass {
		Pattern = 'osui-org-chart',
		Container = 'osui-org-chart__container',
		Card = 'osui-org-chart__card',
		CardAvatar = 'osui-org-chart__card-avatar',
		CardText = 'osui-org-chart__card-text',
		CardName = 'osui-org-chart__card-name',
		CardTitle = 'osui-org-chart__card-title',
		Message = 'osui-org-chart__message',
	}

	/** Codes returned in the JSON response of every OrgChartAPI action */
	export const ErrorCodes = {
		FailChangeProperty: 'ORGCHART-API-01001',
		FailDispose: 'ORGCHART-API-01002',
		FailRegisterCallback: 'ORGCHART-API-01003',
		FailSetProviderConfigs: 'ORGCHART-API-01004',
		FailExpandAll: 'ORGCHART-API-01005',
		FailCollapseAll: 'ORGCHART-API-01006',
		FailSetExpanded: 'ORGCHART-API-01007',
		FailCenterNode: 'ORGCHART-API-01008',
		FailHighlightNode: 'ORGCHART-API-01009',
		FailClearHighlight: 'ORGCHART-API-01010',
		FailFit: 'ORGCHART-API-01011',
		FailExportImage: 'ORGCHART-API-01012',
		FailZoomIn: 'ORGCHART-API-01013',
		FailZoomOut: 'ORGCHART-API-01014',
	};

	export enum CssVariables {
		Height = '--osui-org-chart-height',
	}

	export const Defaults = {
		IdField: 'Id',
		ParentIdField: 'ParentId',
		Layout: Layout.Top,
		Compact: true,
		NodeWidth: 250,
		NodeHeight: 120,
		Height: '600px',
		InitialExpandLevel: 1,
		Rtl: Rtl.Auto,
		AriaLabel: 'Organization chart',
		TitleField: 'Title',
		SubtitleField: 'Subtitle',
		ImageUrlField: 'ImageUrl',
		ClassField: 'ExtendedClass',
		NodeTemplate: '',
	};

	export const ProviderInfo = {
		Name: 'd3-org-chart',
		Version: '4',
	};
}
