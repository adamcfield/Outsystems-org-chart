import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pageUrl = new URL('./fixtures/page.html', import.meta.url).href;

// Small org: 1 root, 3 managers, 2 reports under the first manager
export const smallOrg = [
    { id: '1', parentId: null, name: 'CEO' },
    { id: '2', parentId: '1', name: 'CTO' },
    { id: '3', parentId: '1', name: 'CFO' },
    { id: '4', parentId: '1', name: 'COO' },
    { id: '5', parentId: '2', name: 'Dev A' },
    { id: '6', parentId: '2', name: 'Dev B' },
];

function chromiumPath() {
    const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'];
    return candidates.find(p => p && existsSync(p));
}

export async function openBrowser() {
    const executablePath = chromiumPath();
    return chromium.launch(executablePath ? { executablePath } : {});
}

// Opens the fixture page; console errors and page errors are collected on page.errors
export async function openPage(browser) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
    await page.goto(pageUrl);
    return page;
}

// Renders a chart in the page with no animations; extra setters are applied as chart[key](value)
export async function renderChart(page, data = smallOrg, setters = {}) {
    await page.evaluate(({ data, setters }) => {
        window.chart = new d3.OrgChart()
            .container('#chart')
            .duration(0)
            .data(data)
            .nodeContent(d => `<div class="content">${d3.escapeHtml(d.data.name)}</div>`);
        for (const [key, value] of Object.entries(setters)) window.chart[key](value);
        window.chart.render();
    }, { data, setters });
}

export const visibleNodeIds = page =>
    page.$$eval('g.node', nodes => nodes.map(n => n.__data__.id).sort());

export const fixturePath = fileURLToPath(pageUrl);
