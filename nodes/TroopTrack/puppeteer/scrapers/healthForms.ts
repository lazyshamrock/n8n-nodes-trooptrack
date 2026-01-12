import type { Page } from 'puppeteer';

export type HealthFormDatesScrapeResult = Record<
	string,
	{
		PartA: string | null;
		PartB: string | null;
		PartC: string | null;
	}
>;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHref(href: string): string {
	let out = href || '';
	const hashIdx = out.indexOf('#');
	if (hashIdx >= 0) out = out.slice(0, hashIdx);
	const qIdx = out.indexOf('?');
	if (qIdx >= 0) out = out.slice(0, qIdx);
	while (out.endsWith('/')) out = out.slice(0, -1);
	return out;
}

function trailingId(href: string): string {
	const cleaned = normalizeHref(href);
	if (!cleaned) return '';
	const parts = cleaned.split('/').filter(Boolean);
	return parts.length > 0 ? (parts[parts.length - 1] || '') : '';
}

function normalizeDateOrNull(raw: string): string | null {
	const v = String(raw || '').trim();
	if (!v) return null;

	// Your TroopTrack instance shows YYYY-MM-DD.
	if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

	return null;
}

/**
 * Scrape TroopTrack health form dates from /manage/medical_book.
 * Returns a map keyed by user_id:
 * { [user_id]: { PartA, PartB, PartC } }
 *
 * Permission behavior:
 * - If the user cannot access the page, returns {} so the caller can merge null fields without failing.
 *
 * Hardening:
 * - One retry on navigation
 * - Redirect detection but non-fatal
 * - Multiple selector fallbacks
 * - Column index detection from header text ("Part A", "Part B", "Part C") with fallback to 1,2,3
 */
export async function scrapeTroopTrackHealthFormDates(
	page: Page,
	baseUrl: string,
	protocolTimeoutMs = 120000
): Promise<HealthFormDatesScrapeResult> {
	const targetUrl = `${baseUrl}/manage/medical_book`;

	// Navigate with one retry. If this fails, return empty map (do not fail node).
	try {
		try {
			await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: protocolTimeoutMs });
		} catch {
			await sleep(1000);
			await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: protocolTimeoutMs });
		}
	} catch {
		return {};
	}

	// Redirect detection (permissions, etc.). Do not throw. Return empty map.
	const landedUrl = page.url();
	if (!landedUrl.includes('/manage/medical_book')) {
		return {};
	}

	// Selector candidates in order of preference
	const selectorCandidates = [
		'#DataTables_Table_0 > tbody tr',
		'#DataTables_Table_1 > tbody tr',
		'table.data-table tbody tr',
		'table tbody tr',
	];

	// Give DataTables a moment to populate
	for (const sel of selectorCandidates.slice(0, 2)) {
		try {
			await page.waitForSelector(sel, { timeout: 8000 });
			break;
		} catch {
			// keep going
		}
	}

	// Pick the first selector that yields rows
	let rowsSelector: string | null = null;
	for (const sel of selectorCandidates) {
		const count = await page.$$eval(sel, (els) => els.length).catch(() => 0);
		if (count > 0) {
			rowsSelector = sel;
			break;
		}
	}

	// Final fallback: any row containing a medical_book link
	if (!rowsSelector) {
		const fallbackCount = await page
			.$$eval('tr', (els) =>
				(els as any[]).filter((tr) => !!(tr as any).querySelector?.('a[href*="/medical_book/"], a[href*="/manage/medical_book/"]'))
					.length
			)
			.catch(() => 0);

		if (fallbackCount > 0) rowsSelector = 'tr';
	}

	if (!rowsSelector) {
		return {};
	}

	const result = await page.$$eval(rowsSelector, (rows) => {
		const map: Record<string, { PartA: string | null; PartB: string | null; PartC: string | null }> = {};

		const normalize = (href: string): string => {
			let out = href || '';
			const hashIdx = out.indexOf('#');
			if (hashIdx >= 0) out = out.slice(0, hashIdx);
			const qIdx = out.indexOf('?');
			if (qIdx >= 0) out = out.slice(0, qIdx);
			while (out.endsWith('/')) out = out.slice(0, -1);
			return out;
		};

		const trailing = (href: string): string => {
			const cleaned = normalize(href);
			if (!cleaned) return '';
			const parts = cleaned.split('/').filter(Boolean);
			return parts.length > 0 ? (parts[parts.length - 1] || '') : '';
		};

		const normDate = (raw: string): string | null => {
			const v = String(raw || '').trim();
			if (!v) return null;
			if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
			return null;
		};

		// Detect column indexes from the header row if available.
		// Default: [1,2,3] for PartA/B/C (after the name column).
		let idxA = 1;
		let idxB = 2;
		let idxC = 3;

		// Try to locate the table header from the first row we were given,
		// without referencing `document` (keeps TS happy without DOM lib).
		const firstRow = (rows as any[])[0];
		const table = firstRow?.closest?.('table') || null;
		const headerRow = table?.querySelector?.('thead tr') || null;

		if (headerRow) {
		const ths = Array.from(headerRow.querySelectorAll('th')) as any[];
		const texts = ths.map((th) => String(th?.textContent || '').trim().toLowerCase());

		const findIdx = (needle: string): number =>
			texts.findIndex((t) => t === needle || t.includes(needle));

		const a = findIdx('part a');
		const b = findIdx('part b');
		const c = findIdx('part c');

		// Only override if the index is plausible.
		if (a >= 1) idxA = a;
		if (b >= 1) idxB = b;
		if (c >= 1) idxC = c;
		}


		for (const row of rows as any[]) {
			const cells = row.querySelectorAll?.('td') ?? [];
			if (!cells || cells.length < 4) continue;

			const nameCell = cells[0];
			const link =
				nameCell?.querySelector?.('a') ||
				row.querySelector?.('a[href*="/medical_book/"]') ||
				row.querySelector?.('a[href*="/manage/medical_book/"]');

			const rawHref = link?.getAttribute?.('href') || '';
			const userId = trailing(rawHref);
			if (!userId) continue;

			const PartA = normDate(cells[idxA]?.textContent || '');
			const PartB = normDate(cells[idxB]?.textContent || '');
			const PartC = normDate(cells[idxC]?.textContent || '');

			map[userId] = { PartA, PartB, PartC };
		}

		return map;
	});

	if (!result || Object.keys(result).length === 0) return {};
	return result;
}