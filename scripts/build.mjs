// Builds the distributable files into ./dist
//
//  d3-org-chart.esm.js  ES module, d3 packages left as imports (for bundlers / npm consumers)
//  d3-org-chart.js      Standalone browser script, all d3 dependencies bundled in
//  d3-org-chart.min.js  Minified standalone browser script
//  outsystems/OrgChart.OSUI.js   The file to upload to OutSystems: the minified chart + the OutSystems UI provider
//  outsystems/OrgChart.OSUI.css  The block styles: themes/osui.css + outsystems/OrgChart.css
//
// The standalone scripts expose the chart as `d3.OrgChart` (same global as upstream v3).
// They merge into an existing `window.d3` instead of replacing it, so they are safe to load
// on pages that already use the full d3 bundle.
import { build, transform } from 'esbuild';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const banner = `/*! ${pkg.name} v${pkg.version} | MIT License | https://github.com/adamcfield/outsystems-org-chart */`;

const standaloneFooter = `
(function (g) {
  var ns = g.d3 = g.d3 || {};
  ns.OrgChart = __d3OrgChart.OrgChart;
  ns.OrgChartError = __d3OrgChart.OrgChartError;
  ns.escapeHtml = __d3OrgChart.escapeHtml;
  ns.OrgChartErrorCodes = __d3OrgChart.ErrorCodes;
})(typeof globalThis !== 'undefined' ? globalThis : window);`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist/outsystems', { recursive: true });

const common = {
    entryPoints: ['index.js'],
    bundle: true,
    target: ['es2019'],
    banner: { js: banner },
    legalComments: 'none',
    logLevel: 'info',
};

await Promise.all([
    build({
        ...common,
        format: 'esm',
        outfile: 'dist/d3-org-chart.esm.js',
        external: Object.keys(pkg.dependencies),
    }),
    build({
        ...common,
        format: 'iife',
        globalName: '__d3OrgChart',
        footer: { js: standaloneFooter },
        outfile: 'dist/d3-org-chart.js',
    }),
    build({
        ...common,
        format: 'iife',
        globalName: '__d3OrgChart',
        footer: { js: standaloneFooter },
        minify: true,
        outfile: 'dist/d3-org-chart.min.js',
    }),
]);

// OutSystems UI provider. It is written as TypeScript namespaces (like OutSystems UI itself), which only tsc
// can merge across files, so tsc compiles it and esbuild minifies the result.
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', 'outsystems/tsconfig.json'], { stdio: 'inherit' });
const provider = await transform(await readFile('build/outsystems/OrgChart.Provider.js', 'utf8'), {
    minify: true,
    target: 'es2019',
    legalComments: 'none',
});
const providerBanner = `/*! OrgChart OutSystems UI provider v${pkg.version} | MIT License | https://github.com/adamcfield/outsystems-org-chart */`;
await writeFile(
    'dist/outsystems/OrgChart.OSUI.js',
    [await readFile('dist/d3-org-chart.min.js', 'utf8'), providerBanner, provider.code].join('\n')
);
await writeFile(
    'dist/outsystems/OrgChart.OSUI.css',
    [await readFile('themes/osui.css', 'utf8'), await readFile('outsystems/OrgChart.css', 'utf8')].join('\n')
);
