import type { Page } from 'puppeteer';

export type TroopTrackProfileFieldKey = 'BSA_id' | 'date_joined' | 'allergies';

export type TroopTrackProfileFields = {
	BSA_id?: number | null;
	date_joined?: string | null;
	allergies?: string | null;
};

export type TroopTrackProfileFieldsResult = Record<string, TroopTrackProfileFields>;

type Options = {
	delayMs?: number;
	retries?: number;
	debug?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scrapeWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
	try {
		return await fn();
	} catch (e: any) {
		if (retries > 0 && String(e?.message || e).includes('detached')) {
			await sleep(750);
			return scrapeWithRetry(fn, retries - 1);
		}
		throw e;
	}
}

export async function scrapeTroopTrackProfileFields(
	page: Page,
	baseUrl: string,
	userIds: string[],
	fields: TroopTrackProfileFieldKey[],
	options: Options = {}
): Promise<TroopTrackProfileFieldsResult> {
	const delayMs = options.delayMs ?? 300;
	const retries = options.retries ?? 1;
	const debug = options.debug ?? false;

	const result: TroopTrackProfileFieldsResult = {};
	let firstDebug: any = null;

	for (const userId of userIds) {
		result[userId] = {};
		for (const f of fields) result[userId][f] = null;

		try {
			const profileUrl = `${baseUrl}/manage/users/${userId}`;

			const scraped = await scrapeWithRetry(async () => {
				await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
				await page.waitForSelector('#main-container', { timeout: 30000 });

				return await page.evaluate(() => {
					const doc: any = (globalThis as any).document;
					const container: any = doc?.querySelector?.('#main-container');
					if (!container) {
						return { bsaIdRaw: null as string | null, joinedRaw: null as string | null, allergiesRaw: null as string | null };
					}

					const norm = (s: any) =>
						String(s || '')
							.replace(/\s+/g, ' ')
							.trim()
							.toLowerCase();

					let allergiesRaw: string | null = null;
					let bsaIdRaw: string | null = null;
					let joinedRaw: string | null = null;

					// 1) dt/dd pairs: Allergy Info
					const dlNodes: any[] = Array.from(container.querySelectorAll('dl') as any);
					for (const dl of dlNodes) {
						const dtNodes: any[] = Array.from(dl.querySelectorAll('dt') as any);
						for (const dt of dtNodes) {
							const dd: any = dt.nextElementSibling;
							if (!dd || String(dd.tagName || '').toLowerCase() !== 'dd') continue;

							const label = norm(dt.textContent);
							const value = String(dd.textContent || '').trim();

							if (label === 'allergy info' && value !== '') {
								allergiesRaw = value;
							}
						}
					}

					// 2) free-floating dd values: "ID: ####" and "Joined on YYYY-MM-DD"
					const ddNodes: any[] = Array.from(container.querySelectorAll('dd') as any);
					for (const dd of ddNodes) {
						const txt = String(dd.textContent || '').trim();

						if (!bsaIdRaw) {
							const idMatch = txt.match(/\bID:\s*(\d+)/i);
							bsaIdRaw = (idMatch?.[1] ?? null);
						}

						if (!joinedRaw) {
							const joinedMatch = txt.match(/\bJoined on\s*(\d{4}-\d{2}-\d{2})/i);
							joinedRaw = (joinedMatch?.[1] ?? null);
						}

						if (bsaIdRaw && joinedRaw) break;
					}

					return { bsaIdRaw, joinedRaw, allergiesRaw };
				});
			}, retries);

			if (fields.includes('BSA_id')) {
				result[userId].BSA_id = scraped.bsaIdRaw ? parseInt(scraped.bsaIdRaw, 10) : null;
			}

			if (fields.includes('date_joined')) {
				// TroopTrack already provides YYYY-MM-DD on the page
				result[userId].date_joined = scraped.joinedRaw ?? null;
			}

			if (fields.includes('allergies')) {
				let a: string | null = scraped.allergiesRaw ?? null;
				if (typeof a === 'string') {
					a = a.trim();
					if (a.startsWith('"') && a.endsWith('"') && a.length >= 2) {
						a = a.slice(1, -1).trim();
					}
					a = a.replace(/\s+/g, ' ').trim();
					if (a === '') a = null;
				}
				result[userId].allergies = a;
			}

			if (debug && firstDebug === null) {
				firstDebug = {
					userId,
					url: page.url(),
					scraped,
				};
			}
		} catch {
			// fail soft: keep nulls
		}

		if (delayMs) await sleep(delayMs);
	}

	if (debug && firstDebug) {
		(result as any)._debug_first = firstDebug;
	}

	return result;
}