// Compile-only check of index.d.ts (run with `npm run typecheck`)
import { OrgChart, OrgChartError, escapeHtml } from '../index.js';

interface Employee {
    id: string;
    parentId: string | null;
    name: string;
}

const chart = new OrgChart<Employee>()
    .container('#chart')
    .svgHeight(null)
    .autoResize(true)
    .strict(true)
    .data([{ id: '1', parentId: null, name: 'CEO' }])
    .nodeContent((d) => `<div>${escapeHtml(d.data.name)}</div>`)
    .onNodeClick((node, event) => console.log(node.id, event.clientX))
    .onExpandOrCollapse((node, expanded) => console.log(node.id, expanded))
    .render();

chart.fit({ animate: false, onCompleted: () => undefined }).zoomIn().zoomOut();
chart.destroy().render();

try {
    chart.removeNode('x');
} catch (e) {
    if (e instanceof OrgChartError) {
        const code: 'NODE_NOT_FOUND' | 'NODE_ALREADY_EXISTS' | 'CONTAINER_NOT_FOUND' | 'NOT_RENDERED' = e.code;
        console.log(code);
    }
}
