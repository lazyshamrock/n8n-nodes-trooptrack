import type { Page } from 'puppeteer';

export type TxtOptOutScrapeResult = Record<string, { txtOptOut: boolean | null }>;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeTroopTrackTxtOptOut(
	page: Page,
	baseUrl: string,
	protocolTimeoutMs = 120000
): Promise<TxtOptOutScrapeResult> {
	const targetUrl = `${baseUrl}/communicate/text_message_settings`;

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

	// Redirect / access issue: return empty (caller will keep null/defaults)
	if (!page.url().includes('/communicate/text_message_settings')) {
		return {};
	}

	// Wait for the table to exist, but do not throw if missing
	const hasRows = await page
		.waitForSelector('#text_message_setting > tbody tr', { timeout: 8000 })
		.then(() => true)
		.catch(() => false);

	if (!hasRows) return {};

	// Extract rows. Important: do NOT reference `document` directly to keep TS happy.
	const map = await page.$$eval('#text_message_setting > tbody tr', (rows) => {
		const out: Record<string, { txtOptOut: boolean | null }> = {};

		for (const row of rows as any[]) {
			const idAttr = String(row?.id || '').trim(); // e.g., "user_12345"
			if (!idAttr.startsWith('user_')) continue;

			const userId = idAttr.replace('user_', '').trim();
			if (!userId) continue;

			// Current semantics per your working script:
			// Row exists => txtOptOut = false
			out[userId] = { txtOptOut: false };
		}

		return out;
	});

	return map || {};
}
