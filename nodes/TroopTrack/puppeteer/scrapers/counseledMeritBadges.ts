import type { Page } from 'puppeteer';

export type CounseledMeritBadgesScrapeResult = Record<string, { counseled_MBs: string[] }>;

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

function trailingNumericId(href: string): string {
	const cleaned = normalizeHref(href);
	if (!cleaned) return '';
	const match = cleaned.match(/(\d+)(?:\/?$)/);
    return match?.[1] ?? '';
}

/**
 * Scrape counselor merit badge assignments from /manage/counseled_merit_badges.
 *
 * Returns a map keyed by user_id:
 * { [user_id]: { counseled_MBs: ["Camping", "First Aid"] } }
 *
 * Permission behavior:
 * - If user cannot access the page, returns {} (caller should keep default empty arrays).
 *
 * Hardening:
 * - One retry on navigation
 * - Redirect detection but non-fatal
 * - Works against common table selectors (data-table and generic table)
 */
export async function scrapeTroopTrackCounseledMeritBadges(
	page: Page,
	baseUrl: string,
	protocolTimeoutMs = 120000
): Promise<CounseledMeritBadgesScrapeResult> {
	const targetUrl = `${baseUrl}/manage/counseled_merit_badges`;

	// Navigate with one retry
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

	// Redirect / access issue
	if (!page.url().includes('/manage/counseled_merit_badges')) {
		return {};
	}

	// Try to wait for something table-like, but do not throw if missing
	const foundRows = await page
		.waitForSelector('table tbody tr', { timeout: 8000 })
		.then(() => true)
		.catch(() => false);

	if (!foundRows) return {};

	// Extract using a flexible evaluation that does not reference `document` directly
	const map = await page.$$eval('table tbody tr', (rows) => {
		const counselorMap: Record<string, { counseled_MBs: string[] }> = {};

		const normalize = (href: string): string => {
			let out = href || '';
			const hashIdx = out.indexOf('#');
			if (hashIdx >= 0) out = out.slice(0, hashIdx);
			const qIdx = out.indexOf('?');
			if (qIdx >= 0) out = out.slice(0, qIdx);
			while (out.endsWith('/')) out = out.slice(0, -1);
			return out;
		};

		const trailingId = (href: string): string => {
			const cleaned = normalize(href);
			if (!cleaned) return '';
			const match = cleaned.match(/(\d+)(?:\/?$)/);
            return match?.[1] ?? '';
		};

		for (const row of rows as any[]) {
			const cells = row.querySelectorAll?.('td') ?? [];
			if (!cells || cells.length < 2) continue;

			const badgeName = String(cells[0]?.textContent || '').trim();
			if (!badgeName) continue;

			// Counselor links are typically in the second cell as <li><a ...>
			const links = cells[1]?.querySelectorAll?.('a') ?? [];
			for (const a of links as any[]) {
				const href = String(a?.getAttribute?.('href') || '');
				const userId = trailingId(href);
				if (!userId) continue;

				if (!counselorMap[userId]) {
					counselorMap[userId] = { counseled_MBs: [] };
				}

				if (!counselorMap[userId].counseled_MBs.includes(badgeName)) {
					counselorMap[userId].counseled_MBs.push(badgeName);
				}
			}
		}

		return counselorMap;
	});

	return map || {};
}