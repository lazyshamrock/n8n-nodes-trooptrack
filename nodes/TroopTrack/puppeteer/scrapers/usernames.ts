import type { Page } from 'puppeteer';

export type UsernameScrapeResult = Record<string, { user_name: string | null }>;

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

/**
 * Scrape TroopTrack usernames from /manage/users.
 * Returns a map keyed by user_id.
 *
 * Hardened behaviors:
 * - One retry on navigation
 * - Redirect detection
 * - Brief waits for DataTables rows
 * - Multiple selector fallbacks
 * - Final fallback scans all <tr> for user links
 */
export async function scrapeTroopTrackUsernames(
	page: Page,
	baseUrl: string,
	protocolTimeoutMs = 120000
): Promise<UsernameScrapeResult> {
	const targetUrl = `${baseUrl}/manage/users`;

	// Navigate with one retry
	try {
		await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: protocolTimeoutMs });
	} catch {
		await sleep(1000);
		await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: protocolTimeoutMs });
	}

	// Redirect detection (permissions, etc.)
	const landedUrl = page.url();
	if (!landedUrl.includes('/manage/users')) {
		throw new Error(`Redirected away from /manage/users (landed on: ${landedUrl})`);
	}

	// Selector candidates in order of preference
	const selectorCandidates = [
		'#DataTables_Table_1 > tbody tr',
		'#DataTables_Table_0 > tbody tr',
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

	// Final fallback: any row containing a user link
	if (!rowsSelector) {
		const fallbackCount = await page
			.$$eval('tr', (els) =>
				(els as any[]).filter((tr) => !!(tr as any).querySelector?.('a[href*="/users/"], a[href*="/manage/users/"]')).length
			)
			.catch(() => 0);

		if (fallbackCount > 0) rowsSelector = 'tr';
	}

	if (!rowsSelector) {
		throw new Error('Could not find users table rows on /manage/users');
	}

	// Parse rows into a user_id -> user_name map
	const result = await page.$$eval(rowsSelector, (rows) => {
		const map: Record<string, { user_name: string | null }> = {};

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

		for (const row of rows as any[]) {
			const link =
				row.querySelector?.('td:nth-child(1) a') ||
				row.querySelector?.('a[href*="/users/"]') ||
				row.querySelector?.('a[href*="/manage/users/"]');

			const rawHref = link?.getAttribute?.('href') || '';
			const userId = trailing(rawHref);
			if (!userId) continue;

			const usernameCell = row.querySelector?.('td:nth-child(2)') || row.querySelector?.('td');
			const username = String(usernameCell?.textContent || '')
				.replace('No user account', '')
				.replace('Register', '')
				.trim();

			map[userId] = { user_name: username || null };
		}

		return map;
	});

	if (!result || Object.keys(result).length === 0) {
		throw new Error('Users table parsed but no usernames were extracted');
	}

	return result;
}
