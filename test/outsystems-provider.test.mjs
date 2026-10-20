// Runs the OutSystems UI provider (dist/outsystems/OrgChart.OSUI.js) the way a Reactive block does,
// against the real OutSystems UI runtime of each supported version.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openBrowser } from './helpers.mjs';

const fixtureUrl = new URL('./fixtures/osui.html', import.meta.url).href;
const osuiPath = version => new URL(`./vendor/outsystems-ui/O11.OutSystemsUI-${version}.min.js`, import.meta.url).pathname;
const providerPath = new URL('../dist/outsystems/OrgChart.OSUI.js', import.meta.url).pathname;

// Employee list as an aggregate serializes it: nested by entity, null manager as 0
const employees = [
    { Employee: { Id: 1, ManagerId: 0, Name: 'Dana Levi', Title: 'CEO' } },
    { Employee: { Id: 2, ManagerId: 1, Name: 'Omer Cohen', Title: 'CTO' } },
    { Employee: { Id: 3, ManagerId: 1, Name: 'Noa Mizrahi', Title: 'CFO' } },
    { Employee: { Id: 4, ManagerId: 2, Name: 'Yael Shapiro', Title: 'Developer' } },
];

const blockConfigs = (overrides = {}) => ({
    Data: JSON.stringify(employees),
    IdField: 'Employee.Id',
    ParentIdField: 'Employee.ManagerId',
    TitleField: 'Employee.Name',
    SubtitleField: 'Employee.Title',
    ImageUrlField: 'Employee.PhotoUrl',
    ClassField: '',
    NodeTemplate: '',
    Layout: 'top',
    Compact: false,
    NodeWidth: 220,
    NodeHeight: 100,
    Height: '500px',
    InitialExpandLevel: 2,
    Rtl: 'auto',
    AriaLabel: 'Company structure',
    ExtendedClass: '',
    ...overrides,
});

// Opens the fixture, loads the scripts in the given order and records every platform event on window.events
async function openBlock(browser, version, { providerFirst = false } = {}) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    await page.goto(fixtureUrl);
    const scripts = [osuiPath(version), providerPath];
    if (providerFirst) scripts.reverse();
    for (const path of scripts) await page.addScriptTag({ path });
    await page.evaluate(() => {
        window.events = [];
        window.record = name => (...args) => window.events.push([name, ...args]);
    });
    return page;
}

// Create + RegisterCallback + Initialize, the order the block's OnReady runs them in
async function initialize(page, configs) {
    return page.evaluate(configs => {
        const api = OutSystems.OrgChart.OrgChartAPI;
        api.Create('oc1', JSON.stringify(configs));
        const responses = ['Initialized', 'OnNodeClick', 'OnExpandToggle', 'OnExportReady', 'OnRenderFailed'].map(event =>
            JSON.parse(api.RegisterCallback('oc1', event, window.record(event)))
        );
        api.Initialize('oc1');
        return responses;
    }, configs);
}

const events = (page, name) =>
    page.evaluate(name => window.events.filter(e => e[0] === name).map(e => e.slice(1)), name);

const nodeIds = page => page.$$eval('#b1-Container g.node', nodes => nodes.map(n => n.__data__.id).sort());

const waitForEvents = page => page.waitForTimeout(50);

// Removed nodes stay in the DOM until the chart's exit transition (400ms) ends
const waitForTransitions = page => page.waitForTimeout(600);

for (const version of ['2.30.0', '3.0.0']) {
    describe(`OutSystems UI ${version}`, () => {
        let browser;
        before(async () => { browser = await openBrowser(); });
        after(async () => { await browser.close(); });

        test('renders nested aggregate data and fires Initialized with the widget id', async () => {
            const page = await openBlock(browser, version);
            const responses = await initialize(page, blockConfigs());
            assert.ok(responses.every(r => r.isSuccess), JSON.stringify(responses));
            await waitForEvents(page);
            assert.deepEqual(await events(page, 'Initialized'), [['b1-OrgChart']]);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4']);
            assert.equal(await page.$eval('#b1-Container', el => el.classList.contains('osui-org-chart')), true);
            assert.equal(await page.$eval('#b1-Container [role="tree"]', el => el.getAttribute('aria-label')), 'Company structure');
            const names = await page.$$eval('#b1-Container .osui-org-chart__card-name', els => els.map(e => e.textContent).sort());
            assert.deepEqual(names, ['Dana Levi', 'Noa Mizrahi', 'Omer Cohen', 'Yael Shapiro']);
            assert.deepEqual(page.errors, []);
            await page.close();
        });

        test('works when the provider script loads before OutSystems UI', async () => {
            const page = await openBlock(browser, version, { providerFirst: true });
            await initialize(page, blockConfigs());
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4']);
            assert.deepEqual(page.errors, []);
            await page.close();
        });

        test('uses the Height input as the block height', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            assert.equal(await page.$eval('#b1-Container', el => el.getBoundingClientRect().height), 500);
            const response = await page.evaluate(() =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI.ChangeProperty('oc1', 'Height', '300px'))
            );
            assert.equal(response.isSuccess, true);
            assert.equal(await page.$eval('#b1-Container', el => el.getBoundingClientRect().height), 300);
            await page.close();
        });

        test('draws the fixed card from escaped values', async () => {
            const page = await openBlock(browser, version);
            const data = [
                { Employee: { Id: 1, ManagerId: 0, Name: '<img src=x onerror="window.pwned=1">', Title: 'CEO', PhotoUrl: '' } },
                { Employee: { Id: 2, ManagerId: 1, Name: 'Omer Cohen', Title: 'CTO', PhotoUrl: 'javascript:window.pwned=2' } },
                { Employee: { Id: 3, ManagerId: 1, Name: 'Noa Mizrahi', Title: 'CFO', PhotoUrl: '/img/noa.png' } },
            ];
            await initialize(page, blockConfigs({ Data: JSON.stringify(data) }));
            await waitForEvents(page);
            assert.equal(await page.evaluate(() => window.pwned), undefined);
            const cards = await page.$$eval('#b1-Container .osui-org-chart__card', els => Object.fromEntries(els.map(el => [
                el.closest('g.node').__data__.id,
                { name: el.querySelector('.osui-org-chart__card-name').textContent, avatar: el.querySelector('.osui-org-chart__card-avatar').innerHTML },
            ])));
            assert.equal(cards['1'].name, data[0].Employee.Name);
            assert.equal(cards['2'].avatar, '<span aria-hidden="true">OC</span>');
            assert.equal(cards['3'].avatar, '<img src="/img/noa.png" alt="">');
            await page.close();
        });

        test('NodeTemplate replaces the card when set', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs({ NodeTemplate: '<b class="custom">{{Employee.Name}} &middot; {{Employee.Title}}</b>' }));
            const texts = await page.$$eval('#b1-Container .custom', els => els.map(e => e.textContent).sort());
            assert.deepEqual(texts, ['Dana Levi · CEO', 'Noa Mizrahi · CFO', 'Omer Cohen · CTO', 'Yael Shapiro · Developer']);
            await page.close();
        });

        test('fires OnNodeClick and OnExpandToggle with the widget id and the node id', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            await page.click('#b1-Container g.node:not(.node-button-g) .osui-org-chart__card >> text=Noa Mizrahi');
            await waitForEvents(page);
            assert.deepEqual(await events(page, 'OnNodeClick'), [['b1-OrgChart', '3']]);

            // Collapse the root with its expand button
            await page.evaluate(() => {
                const root = [...document.querySelectorAll('#b1-Container g.node')].find(n => n.__data__.id === '1');
                root.querySelector('.node-button-g').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await waitForEvents(page);
            assert.deepEqual(await events(page, 'OnExpandToggle'), [['b1-OrgChart', '1', false]]);
            await page.close();
        });

        test('ChangeProperty Data redraws, and rejects data that is not a single tree', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            const next = [...employees, { Employee: { Id: 5, ManagerId: 3, Name: 'Lior Katz', Title: 'Accountant' } }];
            const ok = await page.evaluate(data =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI.ChangeProperty('oc1', 'Data', data)), JSON.stringify(next));
            assert.equal(ok.isSuccess, true);
            await waitForEvents(page);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4', '5']);

            const twoRoots = [...next, { Employee: { Id: 6, ManagerId: 0, Name: 'Second root', Title: '' } }];
            const rejected = await page.evaluate(data =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI.ChangeProperty('oc1', 'Data', data)), JSON.stringify(twoRoots));
            assert.equal(rejected.isSuccess, false);
            assert.equal(rejected.code, 'ORGCHART-API-01001');
            assert.match(rejected.message, /2 root records/);
            await waitForEvents(page);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4', '5']);

            // A manager who reports to themself, e.g. through a department hierarchy
            const loop = next.map(e => e.Employee.Id === 2 ? { Employee: { ...e.Employee, ManagerId: 2 } } : e);
            const looped = await page.evaluate(data =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI.ChangeProperty('oc1', 'Data', data)), JSON.stringify(loop));
            assert.equal(looped.isSuccess, false);
            assert.match(looped.message, /loop: 2 > 2/);
            await page.close();
        });

        test('shows a message instead of failing when the initial data is not a tree', async () => {
            const page = await openBlock(browser, version);
            const orphan = [...employees, { Employee: { Id: 9, ManagerId: 99, Name: 'Orphan', Title: '' } }];
            await initialize(page, blockConfigs({ Data: JSON.stringify(orphan) }));
            assert.match(await page.$eval('#b1-Container .osui-org-chart__message', el => el.textContent), /not in the data: 9/);
            assert.deepEqual(await nodeIds(page), []);
            await waitForEvents(page);
            const [[widgetId, message]] = await events(page, 'OnRenderFailed');
            assert.equal(widgetId, 'b1-OrgChart');
            assert.match(message, /not in the data: 9/);

            // Fixing the data removes the message and draws the chart
            await page.evaluate(data => OutSystems.OrgChart.OrgChartAPI.ChangeProperty('oc1', 'Data', data), JSON.stringify(employees));
            await waitForEvents(page);
            assert.equal(await page.$('#b1-Container .osui-org-chart__message'), null);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4']);
            await page.close();
        });

        test('client actions return OutSystems UI style responses', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs({ InitialExpandLevel: 1 }));
            assert.deepEqual(await nodeIds(page), ['1', '2', '3']);

            const api = (name, ...args) => page.evaluate(({ name, args }) =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI[name]('oc1', ...args)), { name, args });

            assert.equal((await api('ExpandAll')).isSuccess, true);
            await waitForTransitions(page);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4']);

            assert.equal((await api('SetExpanded', '2', false)).isSuccess, true);
            await waitForTransitions(page);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3']);

            assert.equal((await api('SetExpanded', '2', true)).isSuccess, true);
            await waitForTransitions(page);
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4']);

            assert.equal((await api('HighlightNode', '4', true)).isSuccess, true);
            assert.equal((await api('ClearHighlight')).isSuccess, true);
            assert.equal((await api('CenterNode', '3')).isSuccess, true);
            assert.equal((await api('Fit')).isSuccess, true);
            const scale = () => page.evaluate(() => OutSystems.OrgChart.OrgChartAPI.GetOrgChartById('oc1').provider.lastTransform().k);
            const before = await scale();
            assert.equal((await api('ZoomIn')).isSuccess, true);
            await waitForTransitions(page);
            assert.ok(await scale() > before);
            assert.equal((await api('ZoomOut')).isSuccess, true);
            assert.equal((await api('CollapseAll')).isSuccess, true);

            const missing = await api('HighlightNode', '404', false);
            assert.equal(missing.isSuccess, false);
            assert.equal(missing.code, 'ORGCHART-API-01009');
            assert.match(missing.message, /404/);

            const unknownChart = await page.evaluate(() => JSON.parse(OutSystems.OrgChart.OrgChartAPI.Fit('nope')));
            assert.equal(unknownChart.isSuccess, false);
            assert.match(unknownChart.message, /OrgChart with id:'nope' was not found/);
            await page.close();
        });

        test('finds the chart by widget id as well as by unique id', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            const response = await page.evaluate(() => JSON.parse(OutSystems.OrgChart.OrgChartAPI.Fit('b1-OrgChart')));
            assert.equal(response.isSuccess, true);
            await page.close();
        });

        test('SetProviderConfigs applies raw chart attributes over the block inputs', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            await page.evaluate(() => OutSystems.OrgChart.OrgChartAPI.RegisterCallback('oc1', 'OnProviderConfigsApplied', window.record('OnProviderConfigsApplied')));
            const response = await page.evaluate(() =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI.SetProviderConfigs('oc1', '{"layout":"left","childrenMargin":80}')));
            assert.equal(response.isSuccess, true);
            await waitForEvents(page);
            const layout = await page.evaluate(() => OutSystems.OrgChart.OrgChartAPI.GetOrgChartById('oc1').provider.layout());
            assert.equal(layout, 'left');
            assert.equal((await events(page, 'OnProviderConfigsApplied')).length, 1);

            const unknown = await page.evaluate(() =>
                JSON.parse(OutSystems.OrgChart.OrgChartAPI.SetProviderConfigs('oc1', { notAnAttribute: 1 })));
            assert.equal(unknown.isSuccess, false);
            assert.match(unknown.message, /notAnAttribute/);
            assert.deepEqual(page.errors, []);
            await page.close();
        });

        test('follows the OutSystems UI right-to-left class', async () => {
            const page = await openBlock(browser, version);
            await page.evaluate(() => document.body.classList.add('is-rtl'));
            await initialize(page, blockConfigs());
            const isRtl = await page.evaluate(() => OutSystems.OrgChart.OrgChartAPI.GetOrgChartById('oc1').provider.getChartState().isRtl);
            assert.equal(isRtl, true);
            await page.close();
        });

        test('ExportImage sends a PNG data URL to OnExportReady', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            const response = await page.evaluate(() => JSON.parse(OutSystems.OrgChart.OrgChartAPI.ExportImage('oc1', false)));
            assert.equal(response.isSuccess, true);
            await page.waitForFunction(() => window.events.some(e => e[0] === 'OnExportReady'));
            const [[widgetId, dataUrl]] = await events(page, 'OnExportReady');
            assert.equal(widgetId, 'b1-OrgChart');
            assert.match(dataUrl, /^data:image\/png;base64,/);
            await page.close();
        });

        test('Dispose removes the chart and frees the id', async () => {
            const page = await openBlock(browser, version);
            await initialize(page, blockConfigs());
            const response = await page.evaluate(() => JSON.parse(OutSystems.OrgChart.OrgChartAPI.Dispose('oc1')));
            assert.equal(response.isSuccess, true);
            assert.equal(await page.$('#b1-Container svg'), null);
            assert.deepEqual(await page.evaluate(() => OutSystems.OrgChart.OrgChartAPI.GetAllOrgCharts()), []);
            // The block can be created again under the same id (e.g. navigating back to the screen)
            await initialize(page, blockConfigs());
            assert.deepEqual(await nodeIds(page), ['1', '2', '3', '4']);
            await page.close();
        });
    });
}
