// eslint-disable-next-line @typescript-eslint/no-unused-vars
namespace OutSystems.OrgChart.Helper {
	export type Row = Record<string, unknown>;

	/**
	 * Reads a value by attribute name or dotted path. Lists serialized from an aggregate are nested by entity
	 * (`[{"Employee":{"Id":1}}]`), so `Employee.Id` reaches the attribute.
	 */
	export function GetValue(row: Row, path: string): unknown {
		let value: unknown = row;
		for (const key of path.split('.')) {
			if (value === null || value === undefined || typeof value !== 'object') {
				return undefined;
			}
			value = (value as Row)[key];
		}
		return value;
	}

	/**
	 * Normalizes an identifier to a string. OutSystems serializes a null identifier as 0 (number) or '' (text),
	 * so those mean "no value", as do null and undefined.
	 */
	export function NormalizeId(value: unknown): string | undefined {
		if (value === null || value === undefined || value === '' || value === 0 || value === '0') {
			return undefined;
		}
		return String(value);
	}

	/** Parses the Data input: a JSON text (from JSONSerialize) or an already parsed list */
	export function ParseData(data: unknown): Row[] {
		if (data === null || data === undefined || data === '') {
			return [];
		}
		const parsed = typeof data === 'string' ? JSON.parse(data) : data;
		if (!Array.isArray(parsed)) {
			throw new Error('Data must be a JSON list of records');
		}
		return parsed as Row[];
	}

	/**
	 * Checks that the rows form a single tree: unique ids, exactly one root, and every parent present.
	 * Returns an error message, or undefined when the data is valid.
	 */
	export function ValidateTree(rows: Row[], idField: string, parentIdField: string): string | undefined {
		const ids = new Set<string>();
		for (const row of rows) {
			const id = NormalizeId(GetValue(row, idField));
			if (id === undefined) {
				return `A record has no value in '${idField}'`;
			}
			if (ids.has(id)) {
				return `Duplicate id '${id}' in '${idField}'`;
			}
			ids.add(id);
		}
		const roots: string[] = [];
		const orphans: string[] = [];
		for (const row of rows) {
			const parentId = NormalizeId(GetValue(row, parentIdField));
			if (parentId === undefined) {
				roots.push(String(NormalizeId(GetValue(row, idField))));
			} else if (!ids.has(parentId)) {
				orphans.push(String(NormalizeId(GetValue(row, idField))));
			}
		}
		if (orphans.length > 0) {
			return `Records whose '${parentIdField}' is not in the data: ${orphans.slice(0, 10).join(', ')}`;
		}
		const cycle = FindCycle(rows, idField, parentIdField);
		if (cycle !== undefined) {
			return `The '${parentIdField}' values form a loop: ${cycle.join(' > ')}`;
		}
		if (roots.length !== 1) {
			return roots.length === 0
				? 'The data has no root record (a record with an empty parent id)'
				: `The data has ${roots.length} root records (${roots.slice(0, 10).join(', ')}); exactly one is required`;
		}
		return undefined;
	}

	/** Returns the ids of a parent loop (a record that is its own ancestor), or undefined when there is none */
	function FindCycle(rows: Row[], idField: string, parentIdField: string): string[] | undefined {
		const parentOf = new Map<string, string | undefined>();
		for (const row of rows) {
			parentOf.set(String(NormalizeId(GetValue(row, idField))), NormalizeId(GetValue(row, parentIdField)));
		}
		const checked = new Set<string>();
		for (const start of parentOf.keys()) {
			const path: string[] = [];
			let current: string | undefined = start;
			while (current !== undefined && !checked.has(current)) {
				const index = path.indexOf(current);
				if (index !== -1) {
					return [...path.slice(index), current];
				}
				path.push(current);
				current = parentOf.get(current);
			}
			path.forEach((id) => checked.add(id));
		}
		return undefined;
	}

	/** Escapes a value for HTML text and attribute contexts */
	export function EscapeHtml(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/** Replaces every {{Field}} (or {{Entity.Field}}) placeholder with the escaped value from the row */
	export function RenderTemplate(template: string, row: Row): string {
		return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => EscapeHtml(GetValue(row, path)));
	}

	export type CardFields = { title: string; subtitle: string; imageUrl: string; className: string };

	// Only web and relative image addresses are used; anything else (e.g. javascript:) falls back to initials
	function IsSafeImageUrl(url: string): boolean {
		return /^(https?:\/\/|\/|\.{0,2}\/|data:image\/)/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url);
	}

	function Initials(title: string): string {
		return title
			.split(/\s+/)
			.filter((word) => word !== '')
			.slice(0, 2)
			.map((word) => Array.from(word)[0].toUpperCase())
			.join('');
	}

	/** The block's node card: photo (or initials), title and subtitle, all values HTML-escaped */
	export function RenderCard(row: Row, fields: CardFields): string {
		const text = (path: string) => {
			const value = path === '' ? undefined : GetValue(row, path);
			return value === null || value === undefined ? '' : String(value);
		};
		const title = text(fields.title);
		const imageUrl = text(fields.imageUrl).trim();
		const avatar =
			imageUrl !== '' && IsSafeImageUrl(imageUrl)
				? `<img src="${EscapeHtml(imageUrl)}" alt="" />`
				: `<span aria-hidden="true">${EscapeHtml(Initials(title))}</span>`;
		const extendedClass = text(fields.className).trim();
		return (
			`<div class="${Enum.CssClass.Card}${extendedClass === '' ? '' : ' ' + EscapeHtml(extendedClass)}">` +
			`<div class="${Enum.CssClass.CardAvatar}">${avatar}</div>` +
			`<div class="${Enum.CssClass.CardText}">` +
			`<div class="${Enum.CssClass.CardName}">${EscapeHtml(title)}</div>` +
			`<div class="${Enum.CssClass.CardTitle}">${EscapeHtml(text(fields.subtitle))}</div>` +
			'</div></div>'
		);
	}
}
