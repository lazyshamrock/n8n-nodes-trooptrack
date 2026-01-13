import type { Page } from 'puppeteer';

export interface TroopTrackPosition {
	scout_position: boolean;
	position_id: number | null;
	position_name: string | null;
}

interface ScrapePositionsInput {
	baseUrl: string;
	demoScoutUserId: number;
	demoAdultUserId: number;
}

const SCOUT_SELECTOR = '#leadership_tracker_role_id';
const ADULT_SELECTOR = '#leadership_position_leadership_position_type_id';

async function scrapeDropdown(
	page: Page,
	url: string,
	selector: string,
	scoutFlag: boolean,
): Promise<TroopTrackPosition[]> {
	await page.goto(url, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector(selector, { timeout: 15000 });

	return page.$$eval(
		`${selector} option`,
		(opts, isScout) => {
			return (opts as any[]).map((o) => {
				const value = (o?.value ?? '') as string;
				const text = String(o?.textContent ?? '').replace(/\s+/g, ' ').trim();

				const parsed = Number.parseInt(value, 10);
				const id = Number.isFinite(parsed) ? parsed : null;

				return {
					scout_position: Boolean(isScout),
					position_id: id,
					position_name: text.length ? text : null,
				};
			});
		},
		scoutFlag,
	);
}

export async function scrapePositions(
	page: Page,
	input: ScrapePositionsInput,
): Promise<TroopTrackPosition[]> {
	const { baseUrl, demoScoutUserId, demoAdultUserId } = input;

	if (!demoScoutUserId || !demoAdultUserId) {
		throw new Error('demoScoutUserId and demoAdultUserId are required to scrape positions');
	}

	const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

	const scoutUrl = `${cleanBaseUrl}/manage/users/${demoScoutUserId}/leadership_trackers/new`;
	const adultUrl = `${cleanBaseUrl}/manage/users/${demoAdultUserId}/leadership_positions/new`;

	const scoutPositions = await scrapeDropdown(page, scoutUrl, SCOUT_SELECTOR, true);
	const adultPositions = await scrapeDropdown(page, adultUrl, ADULT_SELECTOR, false);

	return [...scoutPositions, ...adultPositions];
}