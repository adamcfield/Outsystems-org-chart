// Renders the OutSystems block assets: the OrgChartV2 icon (from its SVG) and the design-time preview image,
// which is a screenshot of the real block rendered with sample data. Run after `npm run build`.
import { readFileSync } from 'node:fs';
import { openBrowser } from '../test/helpers.mjs';

const root = new URL('../', import.meta.url);
const out = name => new URL(`outsystems/assets/${name}`, root).pathname;
const browser = await openBrowser();

const svg = readFileSync(out('OrgChartV2-icon.svg'), 'utf8');
for (const size of [16, 32, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
    await page.screenshot({ path: out(`OrgChartV2-icon-${size}.png`), omitBackground: true });
    await page.close();
}

const employees = [
    { Id: 1, ManagerId: 0, Name: 'Dana Levi', Title: 'CEO' },
    { Id: 2, ManagerId: 1, Name: 'Omer Cohen', Title: 'CTO' },
    { Id: 3, ManagerId: 1, Name: 'Noa Mizrahi', Title: 'CFO' },
    { Id: 4, ManagerId: 1, Name: 'Lior Ben David', Title: 'VP Operations' },
    { Id: 5, ManagerId: 2, Name: 'Yael Shapiro', Title: 'Engineering Lead' },
    { Id: 6, ManagerId: 2, Name: 'Amit Katz', Title: 'Product Manager' },
    { Id: 7, ManagerId: 3, Name: 'Tamar Golan', Title: 'Controller' },
    { Id: 8, ManagerId: 4, Name: 'Eitan Peretz', Title: 'Site Manager' },
];
const page = await browser.newPage({ viewport: { width: 1000, height: 420 }, deviceScaleFactor: 1 });
await page.goto(new URL('test/fixtures/osui.html', root).href);
await page.addScriptTag({ path: new URL('test/vendor/outsystems-ui/O11.OutSystemsUI-2.29.0.min.js', root).pathname });
await page.addScriptTag({ path: new URL('dist/outsystems/OrgChart.OSUI.js', root).pathname });
await page.evaluate(data => {
    const api = OutSystems.OrgChart.OrgChartAPI;
    api.Create('oc1', JSON.stringify({
        Data: JSON.stringify(data), IdField: 'Id', ParentIdField: 'ManagerId', TitleField: 'Name', SubtitleField: 'Title',
        ImageUrlField: '', ClassField: '', NodeTemplate: '', Layout: 'top', Compact: false, NodeWidth: 220, NodeHeight: 72,
        Height: '420px', InitialExpandLevel: 3, Rtl: 'auto', AriaLabel: 'Organization chart', ExtendedClass: '',
    }));
    api.Initialize('oc1');
}, employees);
await page.waitForTimeout(800);
await page.evaluate(() => OutSystems.OrgChart.OrgChartAPI.Fit('oc1'));
await page.waitForTimeout(800);
await page.locator('.screen').screenshot({ path: out('OrgChartV2-preview.png') });
await browser.close();
