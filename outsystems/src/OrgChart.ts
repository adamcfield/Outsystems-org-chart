// eslint-disable-next-line @typescript-eslint/no-unused-vars
namespace OutSystems.OrgChart.Patterns {
	export type Provider = D3OrgChart.Chart;

	export interface IOrgChart extends OSFramework.OSUI.Interface.IProviderPattern<Provider> {
		centerNode(nodeId: string): void;
		clearHighlight(): void;
		collapseAll(): void;
		expandAll(): void;
		exportImage(full: boolean): void;
		fit(): void;
		highlightNode(nodeId: string, withAncestors: boolean): void;
		setExpanded(nodeId: string, expanded: boolean): void;
		zoomIn(): void;
		zoomOut(): void;
	}

	type Factory = new (uniqueId: string, configs: JSON) => IOrgChart;

	let _factory: Factory | undefined;

	/**
	 * The classes extend OutSystems UI base classes, which only exist once OutSystemsUI.js has run.
	 * Defining them on first use, instead of when this script loads, makes the script load order irrelevant.
	 */
	function DefineClasses(): Factory {
		const OSUIPatterns = OSFramework.OSUI.Patterns;

		class OrgChartConfig extends OSUIPatterns.AbstractProviderConfiguration {
			Data: string;
			IdField: string;
			ParentIdField: string;
			TitleField: string;
			SubtitleField: string;
			ImageUrlField: string;
			ClassField: string;
			NodeTemplate: string;
			Layout: Enum.Layout;
			Compact: boolean;
			NodeWidth: number;
			NodeHeight: number;
			Height: string;
			InitialExpandLevel: number;
			Rtl: Enum.Rtl;
			AriaLabel: string;

			/** Raw d3-org-chart attributes set with SetProviderConfigs; they win over the block inputs */
			ExtensibilityConfigs: Record<string, unknown>;

			constructor(config: JSON) {
				super(config);
				for (const [key, value] of Object.entries(Enum.Defaults)) {
					const self = this as unknown as Record<string, unknown>;
					if (self[key] === undefined) {
						self[key] = value;
					}
				}
				this.ExtensibilityConfigs = {};
			}

			getProviderConfig(): ProviderConfigs {
				const isRtl =
					this.Rtl === Enum.Rtl.Auto
						? OutSystems.OSUI.Utils.GetIsRTL() || Enum.Rtl.Auto
						: this.Rtl === Enum.Rtl.Yes;
				const width = this.NodeWidth;
				const height = this.NodeHeight;
				return this.mergeConfigs(
					{
						layout: this.Layout,
						compact: this.Compact,
						initialExpandLevel: this.InitialExpandLevel,
						rtl: isRtl,
						ariaLabel: this.AriaLabel,
						nodeWidth: () => width,
						nodeHeight: () => height,
						strict: true,
					},
					undefined,
					this.ExtensibilityConfigs
				);
			}

			validateDefault(key: string, value: unknown): unknown {
				switch (key) {
					case Enum.Properties.Data:
						return value === undefined || value === null ? '' : value;
					case Enum.Properties.IdField:
					case Enum.Properties.ParentIdField:
					case Enum.Properties.TitleField:
					case Enum.Properties.SubtitleField:
					case Enum.Properties.ImageUrlField:
					case Enum.Properties.ClassField:
						return value === undefined || value === null ? Enum.Defaults[key] : String(value);
					case Enum.Properties.NodeTemplate:
						return value === undefined || value === null ? '' : String(value);
					case Enum.Properties.Height:
					case Enum.Properties.AriaLabel:
						return this.validateString(value as string, Enum.Defaults[key]);
					case Enum.Properties.Layout:
						return this.validateInRange(
							value,
							Enum.Defaults.Layout,
							Enum.Layout.Top,
							Enum.Layout.Bottom,
							Enum.Layout.Left,
							Enum.Layout.Right
						);
					case Enum.Properties.Rtl:
						return this.validateInRange(
							String(value),
							Enum.Defaults.Rtl,
							Enum.Rtl.Auto,
							Enum.Rtl.Yes,
							Enum.Rtl.No
						);
					case Enum.Properties.Compact:
						return this.validateBoolean(value as boolean, Enum.Defaults.Compact);
					case Enum.Properties.NodeWidth:
					case Enum.Properties.NodeHeight: {
						const number = this.validateNumber(value as number, Enum.Defaults[key]);
						return number > 0 ? number : Enum.Defaults[key];
					}
					case Enum.Properties.InitialExpandLevel: {
						const number = this.validateNumber(value as number, Enum.Defaults.InitialExpandLevel);
						return number >= 0 ? number : Enum.Defaults.InitialExpandLevel;
					}
					default:
						return super.validateDefault(key, value);
				}
			}
		}

		class D3OrgChartPattern
			extends OSUIPatterns.AbstractProviderPattern<Provider, OrgChartConfig>
			implements IOrgChart
		{
			private _messageElem: HTMLElement | undefined;
			private _platformEventOnExpandToggle: OSFramework.OSUI.GlobalCallbacks.OSGeneric | undefined;
			private _platformEventOnExportReady: OSFramework.OSUI.GlobalCallbacks.OSGeneric | undefined;
			private _platformEventOnNodeClick: OSFramework.OSUI.GlobalCallbacks.OSGeneric | undefined;
			private _platformEventOnRenderFailed: OSFramework.OSUI.GlobalCallbacks.OSGeneric | undefined;

			constructor(uniqueId: string, configs: JSON) {
				super(uniqueId, new OrgChartConfig(configs));
			}

			private _getRowId(row: Helper.Row): string | undefined {
				return Helper.NormalizeId(Helper.GetValue(row, this.configs.IdField));
			}

			// Parses and checks the Data input; throws with a readable message when it is not a single tree
			private _getRows(): Helper.Row[] {
				const rows = Helper.ParseData(this.configs.Data);
				const error =
					rows.length > 0
						? Helper.ValidateTree(rows, this.configs.IdField, this.configs.ParentIdField)
						: undefined;
				if (error !== undefined) {
					throw new Error(error);
				}
				return rows;
			}

			private _initProvider(): void {
				let rows: Helper.Row[] = [];
				try {
					rows = this._getRows();
					this._setMessage('');
				} catch (error) {
					console.error(`${Enum.PatternName} (${this.widgetId}): ${(error as Error).message}`);
					this._setMessage((error as Error).message);
					this._trigger(this._platformEventOnRenderFailed, (error as Error).message);
				}

				// The fixed card, unless the advanced NodeTemplate input is set
				const template = this.configs.NodeTemplate;
				const cardFields: Helper.CardFields = {
					title: this.configs.TitleField,
					subtitle: this.configs.SubtitleField,
					imageUrl: this.configs.ImageUrlField,
					className: this.configs.ClassField,
				};
				const chart = new window.d3.OrgChart()
					.container(this.selfElement)
					.nodeId((row) => this._getRowId(row))
					.parentNodeId((row) => Helper.NormalizeId(Helper.GetValue(row, this.configs.ParentIdField)))
					.nodeContent((node) =>
						template === ''
							? Helper.RenderCard(node.data, cardFields)
							: Helper.RenderTemplate(template, node.data)
					)
					.onNodeClick((node) => {
						this._trigger(this._platformEventOnNodeClick, this._getRowId(node.data));
					})
					.onExpandOrCollapse((node, expanded) => {
						this._trigger(this._platformEventOnExpandToggle, this._getRowId(node.data), expanded);
					});

				// Block inputs first, SetProviderConfigs overrides last
				const providerConfigs = this.configs.getProviderConfig() as Record<string, unknown>;
				for (const [attr, value] of Object.entries(providerConfigs)) {
					// Attributes such as childrenMargin are functions of the node; a plain value from OutSystems becomes a constant
					const isAccessor = typeof chart[attr]() === 'function';
					chart[attr](isAccessor && typeof value !== 'function' ? () => value : value);
				}

				// The chart keeps a reference to the rows, so it gets a copy: OutSystems owns the data
				chart.data(rows.map((row) => ({ ...row })));
				if (rows.length > 0) {
					chart.render();
				}
				this.provider = chart;
				this.providerInfo = {
					name: Enum.ProviderInfo.Name,
					version: Enum.ProviderInfo.Version,
					events: undefined,
				};
				this.triggerPlatformInitializedEventCallback();
			}

			// triggerPlatformEventCallback already skips events the block did not register
			private _trigger(callback: OSFramework.OSUI.GlobalCallbacks.OSGeneric | undefined, ...args: unknown[]): void {
				this.triggerPlatformEventCallback(callback as OSFramework.OSUI.GlobalCallbacks.OSGeneric, ...args);
			}

			private _setHeight(): void {
				OSFramework.OSUI.Helper.Dom.Styles.SetStyleAttribute(
					this.selfElement,
					Enum.CssVariables.Height,
					this.configs.Height
				);
			}

			// Shows a message inside the block instead of an empty area when the data cannot be drawn
			private _setMessage(message: string): void {
				if (message === '') {
					this._messageElem?.remove();
					this._messageElem = undefined;
					return;
				}
				if (this._messageElem === undefined) {
					this._messageElem = document.createElement('div');
					this._messageElem.className = Enum.CssClass.Message;
					this._messageElem.setAttribute('role', 'alert');
					this.selfElement.appendChild(this._messageElem);
				}
				this._messageElem.textContent = message;
			}

			protected prepareConfigs(): void {
				this._initProvider();
			}

			// The chart sets its own ARIA tree roles and keyboard navigation
			protected setA11YProperties(): void {
				return;
			}

			// Node clicks and expand / collapse are wired to the chart in _initProvider
			protected setCallbacks(): void {
				return;
			}

			protected setHtmlElements(): void {
				OSFramework.OSUI.Helper.Dom.Styles.AddClass(this.selfElement, Enum.CssClass.Pattern);
				this._setHeight();
			}

			protected unsetCallbacks(): void {
				this._platformEventOnExpandToggle = undefined;
				this._platformEventOnExportReady = undefined;
				this._platformEventOnNodeClick = undefined;
				this._platformEventOnRenderFailed = undefined;
				super.unsetCallbacks();
			}

			protected unsetHtmlElements(): void {
				this._messageElem?.remove();
				this._messageElem = undefined;
			}

			public build(): void {
				super.build();
				this.setHtmlElements();
				this.setCallbacks();
				this.setA11YProperties();
				this.prepareConfigs();
				this.finishBuild();
			}

			public changeProperty(propertyName: string, propertyValue: unknown): void {
				// Reject data that can't be drawn before it replaces the current data, so the action reports it
				if (
					this.isBuilt &&
					(propertyName === Enum.Properties.Data ||
						propertyName === Enum.Properties.IdField ||
						propertyName === Enum.Properties.ParentIdField)
				) {
					const next = { ...this.configs, [propertyName]: propertyValue } as OrgChartConfig;
					const rows = Helper.ParseData(next.Data);
					const error =
						rows.length > 0 ? Helper.ValidateTree(rows, next.IdField, next.ParentIdField) : undefined;
					if (error !== undefined) {
						throw new Error(error);
					}
				}

				super.changeProperty(propertyName, propertyValue);

				if (this.isBuilt) {
					switch (propertyName) {
						case Enum.Properties.ExtendedClass:
							// Applied by the base class
							break;
						case Enum.Properties.Height:
							this._setHeight();
							break;
						case Enum.Properties.AriaLabel:
							this.provider.ariaLabel(this.configs.AriaLabel);
							this.selfElement.querySelector('[role="tree"]')?.setAttribute('aria-label', this.configs.AriaLabel);
							break;
						default:
							this.redraw();
							break;
					}
				}
			}

			public centerNode(nodeId: string): void {
				this.provider.setCentered(nodeId).render();
			}

			public clearHighlight(): void {
				this.provider.clearHighlighting();
			}

			public collapseAll(): void {
				this.provider.collapseAll();
			}

			public dispose(): void {
				if (this.isBuilt) {
					this.provider?.destroy();
				}
				this.unsetCallbacks();
				this.unsetHtmlElements();
				super.dispose();
			}

			public expandAll(): void {
				this.provider.expandAll();
			}

			public exportImage(full: boolean): void {
				this.provider.exportImg({
					full,
					save: false,
					onLoad: (dataUrl: string) => {
						this._trigger(this._platformEventOnExportReady, dataUrl);
					},
				});
			}

			public fit(): void {
				this.provider.fit();
			}

			public highlightNode(nodeId: string, withAncestors: boolean): void {
				this.provider.clearHighlighting();
				if (withAncestors) {
					this.provider.setUpToTheRootHighlighted(nodeId).render();
				} else {
					this.provider.setHighlighted(nodeId).render();
				}
			}

			public registerCallback(eventName: string, callback: OSFramework.OSUI.GlobalCallbacks.OSGeneric): void {
				switch (eventName) {
					case Enum.Events.OnNodeClick:
						this._platformEventOnNodeClick = callback;
						break;
					case Enum.Events.OnExpandToggle:
						this._platformEventOnExpandToggle = callback;
						break;
					case Enum.Events.OnExportReady:
						this._platformEventOnExportReady = callback;
						break;
					case Enum.Events.OnRenderFailed:
						this._platformEventOnRenderFailed = callback;
						break;
					default:
						super.registerCallback(eventName, callback);
				}
			}

			/**
			 * Shows (expanded) or hides the node's direct reports. The chart's own setExpanded works on the node's
			 * visibility instead, which is not what a "expand this node" action means in an app.
			 */
			public setExpanded(nodeId: string, expanded: boolean): void {
				const rows = this.provider.data() as Helper.Row[];
				if (!rows.some((row) => this._getRowId(row) === nodeId)) {
					throw new Error(`Node with id (${nodeId}) not found in the chart`);
				}
				const childrenOf = new Map<string, Helper.Row[]>();
				for (const row of rows) {
					const parentId = Helper.NormalizeId(Helper.GetValue(row, this.configs.ParentIdField));
					if (parentId !== undefined) {
						childrenOf.set(parentId, [...(childrenOf.get(parentId) || []), row]);
					}
				}
				const children = childrenOf.get(nodeId) || [];
				if (expanded) {
					// A row flagged _expanded is drawn along with its ancestors
					children.forEach((row) => (row._expanded = true));
				} else {
					const stack = [...children];
					while (stack.length > 0) {
						const row = stack.pop() as Helper.Row;
						row._expanded = false;
						stack.push(...(childrenOf.get(this._getRowId(row) as string) || []));
					}
				}
				this.provider.render();
			}

			public zoomIn(): void {
				this.provider.zoomIn();
			}

			public zoomOut(): void {
				this.provider.zoomOut();
			}

			public setProviderConfigs(newConfigs: ProviderConfigs): void {
				const configs = (typeof newConfigs === 'string' ? JSON.parse(newConfigs) : newConfigs) as Record<string, unknown>;
				const unknown = Object.keys(configs).filter((attr) => typeof this.provider[attr] !== 'function');
				if (unknown.length > 0) {
					throw new Error(`Unknown d3-org-chart attributes: ${unknown.join(', ')}`);
				}
				this.configs.ExtensibilityConfigs = { ...this.configs.ExtensibilityConfigs, ...configs };
				this.redraw();
				super.setProviderConfigs(newConfigs);
			}
		}

		return D3OrgChartPattern;
	}

	export function NewOrgChart(uniqueId: string, configs: JSON, provider = Enum.Provider.D3OrgChart): IOrgChart {
		if (provider !== Enum.Provider.D3OrgChart) {
			throw new Error(`${Enum.PatternName}: provider '${provider}' is not supported`);
		}
		if (typeof OSFramework === 'undefined' || OSFramework.OSUI === undefined) {
			throw new Error(`${Enum.PatternName}: OutSystems UI is not loaded`);
		}
		if (window.d3 === undefined || window.d3.OrgChart === undefined) {
			throw new Error(`${Enum.PatternName}: d3-org-chart is not loaded`);
		}
		if (_factory === undefined) {
			_factory = DefineClasses();
		}
		return new _factory(uniqueId, configs);
	}
}
