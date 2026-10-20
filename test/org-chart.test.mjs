import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openBrowser, openPage, renderChart, visibleNodeIds, smallOrg } from './helpers.mjs';

let browser;
let page;

// Waits for zero-duration transitions (and their 'end' handlers) to flush
const settle = () => page.evaluate(() => new Promise(r => setTimeout(r, 60)));

before(async () => { browser = await openBrowser(); });
after(async () => { await browser.close(); });
beforeEach(async () => { page = await openPage(browser); });
afterEach(async () => {
    assert.deepEqual(page.errors, [], 'page reported errors');
    await page.close();
});

test('standalone bundle exposes d3.OrgChart without clobbering an existing d3 global', async () => {
    const result = await page.evaluate(() => ({
        orgChart: typeof d3.OrgChart,
        escapeHtml: typeof d3.escapeHtml,
        error: typeof d3.OrgChartError,
    }));
    assert.deepEqual(result, { orgChart: 'function', escapeHtml: 'function', error: 'function' });

    const withD3 = await browser.newPage();
    await withD3.addInitScript(() => { window.d3 = { existing: true }; });
    await withD3.goto(page.url());
    const merged = await withD3.evaluate(() => ({ existing: d3.existing, orgChart: typeof d3.OrgChart }));
    await withD3.close();
    assert.deepEqual(merged, { existing: true, orgChart: 'function' });
});

test('renders root and its direct children by default', async () => {
    await renderChart(page);
    await settle();
    assert.deepEqual(await visibleNodeIds(page), ['1', '2', '3', '4']);
    const text = await page.$$eval('.content', els => els.map(e => e.textContent).sort());
    assert.deepEqual(text, ['CEO', 'CFO', 'COO', 'CTO']);
});

test('svg follows the container size when no explicit size is set', async () => {
    await renderChart(page);
    const size = await page.$eval('svg.svg-chart-container', s => [s.getAttribute('width'), s.getAttribute('height')]);
    assert.deepEqual(size, ['1000', '700']);
});

test('explicit svgHeight wins over container height', async () => {
    await renderChart(page, smallOrg, { svgHeight: 420 });
    const h = await page.$eval('svg.svg-chart-container', s => s.getAttribute('height'));
    assert.equal(h, '420');
});

test('falls back to 600px height when the container has no height', async () => {
    await page.evaluate(() => { document.querySelector('#chart').style.height = 'auto'; });
    await renderChart(page);
    // Give the ResizeObserver a few frames: the auto-height container must not feed back into the svg height
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    const h = await page.$eval('svg.svg-chart-container', s => s.getAttribute('height'));
    assert.equal(h, '600');
    assert.equal(await page.$eval('#chart', c => c.getBoundingClientRect().height), 600);
});

test('resizes the svg when the container is resized', async () => {
    await renderChart(page);
    await page.evaluate(() => {
        const c = document.querySelector('#chart');
        c.style.width = '640px';
        c.style.height = '480px';
    });
    await page.waitForFunction(() => document.querySelector('svg.svg-chart-container').getAttribute('width') === '640');
    const size = await page.$eval('svg.svg-chart-container', s => [s.getAttribute('width'), s.getAttribute('height')]);
    assert.deepEqual(size, ['640', '480']);
});

test('expand button toggles children and reports the new state', async () => {
    await renderChart(page);
    await page.evaluate(() => {
        window.toggles = [];
        chart.onExpandOrCollapse((d, expanded) => window.toggles.push([d.id, expanded]));
    });
    // The expand button of node 2 (the only collapsed node with children)
    await page.evaluate(() => {
        const node = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === '2');
        node.querySelector('.node-button-g').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle();
    assert.deepEqual(await visibleNodeIds(page), ['1', '2', '3', '4', '5', '6']);
    await page.evaluate(() => {
        const node = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === '2');
        node.querySelector('.node-button-g').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle();
    assert.deepEqual(await visibleNodeIds(page), ['1', '2', '3', '4']);
    assert.deepEqual(await page.evaluate(() => window.toggles), [['2', true], ['2', false]]);
});

test('node click calls onNodeClick with the node and the DOM event, but not for the expand button', async () => {
    await renderChart(page);
    await page.evaluate(() => {
        window.clicks = [];
        chart.onNodeClick((d, event) => window.clicks.push([d.id, event.type]));
        const node = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === '3');
        node.querySelector('.content').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const withButton = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === '2');
        withButton.querySelector('.node-button-g').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    assert.deepEqual(await page.evaluate(() => window.clicks), [['3', 'click']]);
});

test('expandAll and collapseAll', async () => {
    await renderChart(page);
    await page.evaluate(() => chart.expandAll());
    await settle();
    assert.deepEqual(await visibleNodeIds(page), ['1', '2', '3', '4', '5', '6']);
    await page.evaluate(() => chart.collapseAll());
    await settle();
    assert.deepEqual(await visibleNodeIds(page), ['1']);
});

test('addNode and removeNode', async () => {
    await renderChart(page);
    await page.evaluate(() => chart.addNode({ id: '7', parentId: '1', name: 'CMO' }));
    await settle();
    assert.ok((await visibleNodeIds(page)).includes('7'));
    await page.evaluate(() => chart.removeNode('7'));
    await settle();
    assert.ok(!(await visibleNodeIds(page)).includes('7'));
});

test('setExpanded / setCentered / setHighlighted on a deep node', async () => {
    await renderChart(page);
    await page.evaluate(() => chart.setHighlighted('5').render());
    await settle();
    assert.ok((await visibleNodeIds(page)).includes('5'));
    const highlighted = await page.evaluate(() => chart.data().find(d => d.id === '5')._highlighted);
    assert.equal(highlighted, true);
});

test('unknown node ids warn by default and throw OrgChartError in strict mode', async () => {
    await renderChart(page);
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.evaluate(() => chart.setCentered('nope'));
    await settle();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /CENTER - Node with id \(nope\) not found/);

    const err = await page.evaluate(() => {
        chart.strict(true);
        try { chart.removeNode('nope'); } catch (e) { return { name: e.name, code: e.code, isError: e instanceof d3.OrgChartError }; }
    });
    assert.deepEqual(err, { name: 'OrgChartError', code: 'NODE_NOT_FOUND', isError: true });
});

test('API calls before render report NOT_RENDERED instead of crashing', async () => {
    const err = await page.evaluate(() => {
        const c = new d3.OrgChart().container('#chart').strict(true);
        try { c.fit(); } catch (e) { return e.code; }
    });
    assert.equal(err, 'NOT_RENDERED');
});

test('missing container throws CONTAINER_NOT_FOUND', async () => {
    const err = await page.evaluate(() => {
        try { new d3.OrgChart().container('#missing').data([{ id: 1 }]).render(); } catch (e) { return e.code; }
    });
    assert.equal(err, 'CONTAINER_NOT_FOUND');
});

test('custom nodeId / parentNodeId accessors work, including paging', async () => {
    const data = [{ key: 'r', boss: null, name: 'Root' }];
    for (let i = 0; i < 8; i++) data.push({ key: `c${i}`, boss: 'r', name: `Child ${i}` });
    await page.evaluate((data) => {
        window.chart = new d3.OrgChart()
            .container('#chart')
            .duration(0)
            .nodeId(d => d.key)
            .parentNodeId(d => d.boss)
            .minPagingVisibleNodes(() => 3)
            .data(data)
            .nodeContent(d => `<div class="content">${d.data.name}</div>`)
            .render();
    }, data);
    await settle();
    // root + 3 visible children + paging button node
    const ids = await page.$$eval('g.node', nodes => nodes.map(n => n.__data__.data.key));
    assert.equal(ids.length, 5);
    assert.equal(await page.$$eval('.paging-button-wrapper', els => els.length), 1);
});

test('escapeHtml and connection labels are escaped', async () => {
    const out = await page.evaluate(() => d3.escapeHtml(`<img src=x onerror="alert(1)">'&`));
    assert.equal(out, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;');

    await renderChart(page, smallOrg, {
        connections: [{ from: '2', to: '3', label: '<script>window.pwned = true</script>' }],
    });
    await settle();
    const injected = await page.evaluate(() => ({
        pwned: window.pwned === true,
        scripts: document.querySelectorAll('svg script').length,
        label: document.querySelector('.defs-wrapper text').textContent,
    }));
    assert.deepEqual(injected, { pwned: false, scripts: 0, label: '<script>window.pwned = true</script>' });
});

test('destroy removes the svg and observers, and the chart can render again', async () => {
    await renderChart(page);
    const afterDestroy = await page.evaluate(() => {
        chart.destroy();
        return {
            svgs: document.querySelectorAll('#chart svg').length,
            observer: chart.getChartState().resizeObserver,
        };
    });
    assert.deepEqual(afterDestroy, { svgs: 0, observer: null });
    await page.evaluate(() => chart.render());
    await settle();
    assert.deepEqual(await visibleNodeIds(page), ['1', '2', '3', '4']);
    assert.equal(await page.$$eval('#chart svg.svg-chart-container', s => s.length), 1);
});

test('fit, zoomIn and zoomOut change the zoom transform', async () => {
    await renderChart(page, smallOrg, { duration: 1 });
    await page.evaluate(() => chart.expandAll().fit({ animate: false }));
    await settle();
    const k1 = await page.evaluate(() => chart.lastTransform().k);
    await page.evaluate(() => chart.zoomIn());
    await page.waitForFunction((k) => chart.lastTransform().k > k, k1);
    const k2 = await page.evaluate(() => chart.lastTransform().k);
    await page.evaluate(() => chart.zoomOut());
    await page.waitForFunction((k) => chart.lastTransform().k < k, k2);
});

test('every layout renders without errors', async () => {
    for (const layout of ['top', 'bottom', 'left', 'right']) {
        await page.evaluate(() => document.querySelector('#chart').innerHTML = '');
        await renderChart(page, smallOrg, { layout });
        await page.evaluate(() => chart.expandAll().fit({ animate: false }));
        await settle();
        assert.equal((await visibleNodeIds(page)).length, 6, layout);
    }
});

test('exportImg produces a PNG data url without saving', async () => {
    await renderChart(page);
    const dataUrl = await page.evaluate(() => new Promise(resolve => chart.exportImg({ save: false, onLoad: resolve })));
    assert.match(dataUrl, /^data:image\/png;base64,/);
});

// ---------------------------------------------------------------- RTL

const nodeX = (page, id) => page.evaluate((id) => {
    const node = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === id);
    return node.__data__.x;
}, id);

test('rtl mirrors sibling order in the top layout', async () => {
    await renderChart(page, smallOrg, { rtl: false, compact: false });
    await settle();
    const ltr = [await nodeX(page, '2'), await nodeX(page, '4')];
    assert.ok(ltr[0] < ltr[1], 'first child is on the left in ltr');

    await page.evaluate(() => chart.rtl(true).render());
    await settle();
    const rtl = [await nodeX(page, '2'), await nodeX(page, '4')];
    assert.ok(rtl[0] > rtl[1], 'first child is on the right in rtl');
    assert.deepEqual(rtl, [-ltr[0], -ltr[1]]);
});

test('rtl "auto" follows the container direction and swaps left/right layouts', async () => {
    await page.evaluate(() => document.querySelector('#chart').setAttribute('dir', 'rtl'));
    await renderChart(page, smallOrg, { layout: 'left' });
    await settle();
    const state = await page.evaluate(() => {
        const s = chart.getChartState();
        return { isRtl: s.isRtl, effectiveLayout: s.effectiveLayout };
    });
    assert.deepEqual(state, { isRtl: true, effectiveLayout: 'right' });
    // Children sit to the left of the root when the left layout is mirrored
    assert.ok(await nodeX(page, '2') < await nodeX(page, '1'));
});

test('compact rtl layout renders all nodes and links without errors', async () => {
    const data = [{ id: 'r', parentId: null, name: 'Root' }];
    for (let i = 0; i < 6; i++) data.push({ id: `c${i}`, parentId: 'r', name: `Leaf ${i}` });
    await renderChart(page, data, { rtl: true, compact: true });
    await settle();
    assert.equal((await visibleNodeIds(page)).length, 7);
    const badPaths = await page.$$eval('path.link', ps => ps.filter(p => /NaN/.test(p.getAttribute('d'))).length);
    assert.equal(badPaths, 0);
});

// ---------------------------------------------------------------- Accessibility

test('nodes expose ARIA tree semantics with a roving tabindex', async () => {
    await renderChart(page);
    await settle();
    const tree = await page.$eval('g.nodes-wrapper', g => [g.getAttribute('role'), g.getAttribute('aria-label')]);
    assert.deepEqual(tree, ['tree', 'Organization chart']);
    const items = await page.$$eval('g.node', nodes => nodes.map(n => ({
        id: n.__data__.id,
        role: n.getAttribute('role'),
        level: n.getAttribute('aria-level'),
        expanded: n.getAttribute('aria-expanded'),
        tabindex: n.getAttribute('tabindex'),
        label: n.getAttribute('aria-label'),
    })).sort((a, b) => a.id.localeCompare(b.id)));
    assert.deepEqual(items[0], { id: '1', role: 'treeitem', level: '1', expanded: 'true', tabindex: '0', label: 'CEO' });
    assert.deepEqual(items[1], { id: '2', role: 'treeitem', level: '2', expanded: 'false', tabindex: '-1', label: 'CTO' });
    assert.equal(items[2].expanded, null, 'leaf has no aria-expanded');
    assert.equal(await page.$$eval('.node-button-g[aria-hidden="true"]', b => b.length), 4);
    assert.equal(await page.$eval('g.links-wrapper', g => g.getAttribute('aria-hidden')), 'true');
});

const focusedId = page => page.evaluate(() => document.activeElement.__data__ && document.activeElement.__data__.id);

test('keyboard: arrows move focus and expand/collapse, Enter activates', async () => {
    await renderChart(page);
    await settle();
    await page.evaluate(() => {
        window.clicks = [];
        chart.onNodeClick((d) => window.clicks.push(d.id));
    });
    await page.focus('g.node[tabindex="0"]');
    assert.equal(await focusedId(page), '1');

    await page.keyboard.press('ArrowDown');
    assert.equal(await focusedId(page), '2');

    await page.keyboard.press('ArrowRight'); // expands CTO
    await settle();
    assert.equal(await focusedId(page), '2');
    assert.ok((await visibleNodeIds(page)).includes('5'));

    await page.keyboard.press('ArrowRight'); // into first child
    assert.equal(await focusedId(page), '5');

    await page.keyboard.press('ArrowLeft'); // leaf: back to parent
    assert.equal(await focusedId(page), '2');

    await page.keyboard.press('ArrowLeft'); // collapses CTO
    await settle();
    assert.ok(!(await visibleNodeIds(page)).includes('5'));

    await page.keyboard.press('End');
    assert.equal(await focusedId(page), '4');
    await page.keyboard.press('Home');
    assert.equal(await focusedId(page), '1');

    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => window.clicks), ['1']);

    // Only one node is in the tab order at a time
    assert.equal(await page.$$eval('g.node[tabindex="0"]', n => n.length), 1);
});

test('keyboard: Space toggles, and arrow keys are mirrored in rtl', async () => {
    await renderChart(page, smallOrg, { rtl: true });
    await settle();
    await page.focus('g.node[tabindex="0"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await settle();
    assert.ok((await visibleNodeIds(page)).includes('5'));
    await page.keyboard.press('ArrowLeft'); // forward in rtl: into first child
    assert.equal(await focusedId(page), '5');
    await page.keyboard.press('ArrowRight'); // backward in rtl: parent
    assert.equal(await focusedId(page), '2');
});

test('collapsing an ancestor with the mouse moves the tab stop to the closest visible node', async () => {
    await renderChart(page);
    await page.evaluate(() => chart.expandAll());
    await settle();
    await page.evaluate(() => {
        const node = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === '5');
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const parent = [...document.querySelectorAll('g.node')].find(n => n.__data__.id === '2');
        parent.querySelector('.node-button-g').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle();
    const tabStop = await page.$eval('g.node[tabindex="0"]', n => n.__data__.id);
    assert.equal(tabStop, '2');
});

// ---------------------------------------------------------------- Theming

test('colors come from CSS variables with the original defaults as fallback', async () => {
    await renderChart(page);
    await page.evaluate(() => chart.expandAll());
    await settle();
    const before = await page.$eval('path.link', p => getComputedStyle(p).stroke);
    assert.equal(before, 'rgb(228, 226, 233)'); // #E4E2E9

    await page.evaluate(() => document.querySelector('#chart').style.setProperty('--oc-link-color', 'rgb(1, 2, 3)'));
    const after = await page.$eval('path.link', p => getComputedStyle(p).stroke);
    assert.equal(after, 'rgb(1, 2, 3)');

    await page.evaluate(() => document.querySelector('#chart').style.setProperty('--oc-button-color', 'rgb(9, 8, 7)'));
    const buttonColor = await page.$eval('.node-button-div > div', d => getComputedStyle(d).color);
    assert.equal(buttonColor, 'rgb(9, 8, 7)');
});

test('exported svg carries resolved theme colors instead of CSS variables', async () => {
    await renderChart(page);
    await page.evaluate(() => chart.expandAll());
    await settle();
    await page.evaluate(() => document.querySelector('#chart').style.setProperty('--oc-link-color', 'rgb(1, 2, 3)'));
    // Capture the serialized svg by intercepting the download link
    const svgSource = await page.evaluate(() => new Promise(resolve => {
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            HTMLAnchorElement.prototype.click = click;
            resolve(decodeURIComponent(this.href.split(',')[1]));
        };
        chart.exportSvg();
    }));
    assert.match(svgSource, /class="link"[^>]*style="[^"]*stroke: rgb\(1, 2, 3\)/);
});

test('OutSystems UI theme maps chart colors to the app theme roles', async () => {
    const css = await import('node:fs/promises').then(fs => fs.readFile(new URL('../themes/osui.css', import.meta.url), 'utf8'));
    await page.addStyleTag({ content: css + ':root { --color-border: rgb(10, 20, 30); }' });
    await page.evaluate(() => document.querySelector('#chart').classList.add('osui-org-chart'));
    await renderChart(page);
    await page.evaluate(() => chart.expandAll());
    await settle();
    assert.equal(await page.$eval('path.link', p => getComputedStyle(p).stroke), 'rgb(10, 20, 30)');
});
