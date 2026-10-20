# OrgChart for OutSystems 11 (Reactive)

An OutSystems UI style provider for the chart: the block's inputs and events and the client actions go through
`OutSystems.OrgChart.OrgChartAPI`, which follows the same lifecycle and response format as the OutSystems UI
patterns (Carousel, DatePicker, ...). Tested against OutSystems UI 2.30.0 and 3.0.0.

## Files to add to the module

| File | Add as |
| --- | --- |
| `dist/outsystems/OrgChart.OSUI.js` | Script, required by the OrgChart block. Contains d3-org-chart and the provider; no other d3 script is needed. |
| `dist/outsystems/OrgChart.OSUI.css` | Style sheet of the block (or of the theme). |

The script can load before or after OutSystemsUI.js.

## Design rule

The JavaScript is only the rendering engine. Everything the app does to the chart goes through a block input or a
client action (search is an OutSystems widget that calls `HighlightNode` / `CenterNode`), and everything the user
does in the chart comes back as a block event. The chart has no UI of its own beyond zoom / pan, the expand
buttons (which raise `OnExpandToggle`) and keyboard navigation.

## Block

The block contains a Container whose `name` is the block's unique id (`OrgChartId`), like OutSystems UI blocks.

| JavaScript node | Calls |
| --- | --- |
| OnReady | `OrgChartAPI.Create(OrgChartId, Configs)`, `RegisterCallback` per event, `Initialize(OrgChartId)` |
| OnParametersChanged | `ChangeProperty(OrgChartId, Name, Value)` for each changed input |
| OnDestroy | `Dispose(OrgChartId)` |

`Configs` is a JSONSerialize of the block's configuration structure:

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| Data | Text | | JSONSerialize of the list. Aggregate rows are nested by entity, so use `Entity.Attribute` in the field names. |
| IdField | Text | `Id` | Attribute name or dotted path. |
| ParentIdField | Text | `ParentId` | Empty, `0` or null means top of the tree. Exactly one top record is required. |
| NodeTemplate | Text | Name + Title card | HTML with `{{Field}}` placeholders; values are HTML-escaped. |
| Layout | Text | `top` | `top`, `bottom`, `left`, `right` |
| Compact | Boolean | True | |
| NodeWidth, NodeHeight | Integer | 250, 120 | Pixels |
| Height | Text | `600px` | Any CSS length |
| InitialExpandLevel | Integer | 1 | Levels open on first draw |
| Rtl | Text | `auto` | `auto` follows the OutSystems UI `is-rtl` class and the CSS direction |
| AriaLabel | Text | `Organization chart` | Name of the chart for screen readers |
| ExtendedClass | Text | | |

Data that is not a single tree (orphans, loops, several top records, duplicate ids) is never dropped silently: on
first draw the block shows the reason and raises OnRenderFailed, and `ChangeProperty` returns it as an error and keeps the current chart.

## Events

Registered with `RegisterCallback(OrgChartId, EventName, $actions.Handler)`. Every handler receives the block's
widget id first.

| Event | Arguments |
| --- | --- |
| Initialized | |
| OnNodeClick | NodeId (Text) |
| OnExpandToggle | NodeId (Text), IsExpanded (Boolean) |
| OnExportReady | ImageDataUrl (Text, PNG) |
| OnRenderFailed | Message (Text): the data could not be drawn (first draw or redraw) |
| OnProviderConfigsApplied | |

## Client actions

Each takes the OrgChartId (the unique id or the block's widget id) and returns a JSON text
`{"code","isSuccess","message"}`, like the OutSystems UI client actions.

`ExpandAll`, `CollapseAll`, `SetExpanded(NodeId, Expanded)`, `CenterNode(NodeId)`,
`HighlightNode(NodeId, WithAncestors)`, `ClearHighlight`, `Fit`, `ZoomIn`, `ZoomOut`, `ExportImage(Full)`,
`SetProviderConfigs(Configs)`: raw d3-org-chart attributes as JSON, applied over the inputs (for example
`{"childrenMargin":80}`).

## Developing

The provider is TypeScript in `outsystems/src`, written as namespaces like OutSystems UI. `npm run build` compiles
it and writes the two files above; `test/outsystems-provider.test.mjs` runs the block lifecycle in Chromium against
the OutSystems UI runtimes in `test/vendor/outsystems-ui`.
