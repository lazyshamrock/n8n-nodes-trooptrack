import type { Page } from 'puppeteer';

export type UsernameScrapeResult = Record<string, { troopTrackUsername: string | null }>;

/**
 * Scrape TroopTrack usernames from /manage/users.
 * Returns a map keyed by user_id.
 */
export async function scrapeTroopTrackUsernames(
	page: Page,
	baseUrl: string,
	protocolTimeoutMs = 120000
): Promise<UsernameScrapeResult> {
	await page.goto(`${baseUrl}/manage/users`, {
		waitUntil: 'domcontentloaded',
		timeout: protocolTimeoutMs,
	});

	// Try a few selectors to tolerate minor UI changes
	const selectorCandidates = [
		'#DataTables_Table_1 > tbody tr',
		'table.data-table tbody tr',
		'table tbody tr',
	];

	let rowsSelector: string | null = null;
	for (const sel of selectorCandidates) {
		const count = await page.$$eval(sel, (els) => els.length).catch(() => 0);
		if (count > 0) {
			rowsSelector = sel;
			break;
		}
	}

	if (!rowsSelector) {
		// If user lacks access, TroopTrack often still returns a page but without the table.
		// Throw so caller can apply "null fields" behavior.
		throw new Error('Could not find users table on /manage/users');
	}

	const result = await page.$$eval(rowsSelector, (rows) => {
		const map: Record<string, { troopTrackUsername: string | null }> = {};

		for (const row of rows) {
			// Try to find a link with the user id in href
			const link =
                row.querySelector('td:nth-child(1) a') ||
                row.querySelector('a[href*="/users/"]') ||
                row.querySelector('a[href*="/manage/users/"]');

			const rawHref = link?.getAttribute('href') || '';
			const userId = /[^/]*$/.exec(rawHref)?.[0] || '';
			if (!userId) continue;

			// Username is typically in 2nd cell, but be defensive
			const usernameCell =
                row.querySelector('td:nth-child(2)') ||
                row.querySelector('td');

			const username = (usernameCell?.textContent || '')
				.replace('No user account', '')
				.replace('Register', '')
				.trim();

			map[userId] = { troopTrackUsername: username || null };
		}

		return map;
	});

	return result;
}
