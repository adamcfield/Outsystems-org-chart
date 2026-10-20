# Changelog

## 4.0.0 (unreleased)

First release of the maintained fork. Based on upstream `d3-org-chart` 3.1.1, which is identical to the upstream master branch at the time of forking.

### Breaking changes

- **Sizing.** `svgWidth` and `svgHeight` default to `null`, which means the svg follows its container (600px height when the container has none). v3 used `window.innerHeight - 100`. Set them explicitly to keep a fixed size.
- **Build output.** The `build/` folder is replaced by `dist/`: `d3-org-chart.esm.js`, and the standalone `d3-org-chart.js` / `d3-org-chart.min.js`. The standalone files bundle the d3 modules they need, so `d3-flextree` and the full d3 bundle no longer have to be loaded separately.
- **Connection marker ids.** Marker ids for connections are made safe for use as element ids (characters outside `a-z A-Z 0-9 _ -` are encoded). Custom `connectionsUpdate` functions that build `url(#from_to)` by hand should use the same ids as the default one.
- **Errors.** Unknown node ids log with `console.warn` instead of `console.log`. A missing container throws `OrgChartError` (`CONTAINER_NOT_FOUND`) instead of a TypeError.
- **Removed** `isEdge()` and the legacy Edge / vendor-prefixed fullscreen code paths.

### Added

- `destroy()`: stops transitions and removes listeners, observers and the svg. The chart can be rendered again afterwards.
- `resize()`, `autoResize` (default `true`): the svg follows container size changes through a `ResizeObserver` instead of a window resize listener.
- `strict` (default `false`): API methods throw `OrgChartError` with a `code` instead of warning.
- `escapeHtml()` export (`d3.escapeHtml` in the standalone script).
- `onNodeClick(node, event)` now receives the DOM event; `onExpandOrCollapse(node, expanded)` receives the new state.
- `fit`, `zoomIn`, `zoomOut`, `exportImg` and `exportSvg` report `NOT_RENDERED` when called before `render()` instead of crashing. `zoomIn` / `zoomOut` return the chart.
- TypeScript definitions (`index.d.ts`), based on `@types/d3-org-chart`.
- Headless Chromium test suite and CI.

### Fixed

- Connection labels were inserted into the svg unescaped.
- Paging hid the wrong nodes when a custom `nodeId` accessor was used (it read `d.id` directly).
- `zoomTransform` for the top / bottom layouts produced an invalid transform string.
- `expand` was passed unbound in `setLayouts` (latent: it only worked because freshly stratified nodes never have collapsed children).
- Node and button click detection used the deprecated `event.srcElement` and only matched the exact clicked element.
- Images that cannot be fetched (e.g. CORS) no longer stop `exportImg` from completing.
- Default `getTextWidth` font typo (`Helvetice`).
