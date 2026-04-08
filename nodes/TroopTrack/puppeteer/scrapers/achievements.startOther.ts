/**
 * TroopTrack Achievements: Start Other Achievement (web UI)
 *
 * IMPORTANT TYPESCRIPT NOTE (n8n build): This project does NOT include DOM libs.
 * - Do not use document/window/Element/HTMLElement types in TS annotations.
 * - Inside page.evaluate / $$eval, only access globals via (globalThis as any)
 *   and type DOM nodes as any.
 */

export type StartOtherAchievementFieldNames = {
	user_id: string;
	award_type_id: string;
	achievement_id: string;
};

export type StartOtherAchievementOptions = {
	delayMs?: number;
	batchSize?: number;
	debugMode?: boolean;
};

export type StartOtherAchievementResultItem = {
	index: number;
	user_id: string | number | null;
	award_type_id: string | number | null;
	achievement_id: string | number | null;
	achievement_started: boolean;
	errors: string[];
};

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMapped(item: Record<string, any>, field: string): unknown {
	if (!field.includes('.')) return item[field];

	const parts = field.split('.');
	let cur: any = item;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = cur[p];
	}
	return cur;
}

function buildStartOtherAchievementUrl(ttSubDomain: string, userId: string | number): string {
	return `https://${ttSubDomain}.trooptrack.com/achieve/users/${encodeURIComponent(
		String(userId),
	)}/user_achievements/new`;
}

async function submitOtherAchievement(page: any, stepDelayMs: number): Promise<void> {
	const submitSelector =
		'input[type="submit"][name="commit"][value="Save"], button[type="submit"][name="commit"][value="Save"]';

	await page.waitForSelector(submitSelector, { visible: true, timeout: 20000 });

	const navPromise = page
		.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
		.catch(() => null);

	await page.click(submitSelector);
	await navPromise;

	if (stepDelayMs > 0) await delay(stepDelayMs);
}

async function startOneOtherAchievement(
	page: any,
	ttSubDomain: string,
	item: Record<string, any>,
	fieldNames: StartOtherAchievementFieldNames,
	opts: Required<StartOtherAchievementOptions>,
	index: number,
): Promise<StartOtherAchievementResultItem> {
	const userId = readMapped(item, fieldNames.user_id);
	const awardTypeId = readMapped(item, fieldNames.award_type_id);
	const achievementId = readMapped(item, fieldNames.achievement_id);

	const result: StartOtherAchievementResultItem = {
		index,
		user_id: userId == null || userId === '' ? null : (userId as any),
		award_type_id: awardTypeId == null || awardTypeId === '' ? null : (awardTypeId as any),
		achievement_id: achievementId == null || achievementId === '' ? null : (achievementId as any),
		achievement_started: false,
		errors: [],
	};

	if (userId === undefined || userId === null || userId === '') {
		result.errors.push(`Missing ${fieldNames.user_id}`);
		return result;
	}

	if (awardTypeId === undefined || awardTypeId === null || awardTypeId === '') {
		result.errors.push(`Missing ${fieldNames.award_type_id}`);
		return result;
	}

	if (achievementId === undefined || achievementId === null || achievementId === '') {
		result.errors.push(`Missing ${fieldNames.achievement_id}`);
		return result;
	}

	const url = buildStartOtherAchievementUrl(ttSubDomain, userId as any);
	const selector = `#user_achievement_achievement_id_${achievementId}`;
	const stepDelayMs = Math.min(1000, Math.max(0, opts.delayMs));

	try {
		await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
		if (stepDelayMs > 0) await delay(stepDelayMs);

		try {
			await page.waitForSelector(selector, { visible: true, timeout: 20000 });
		} catch {
			throw new Error(`Achievement ${achievementId} not found for user_id ${userId}`);
		}

		const already = await page.$eval(selector, (el: any) => Boolean(el?.checked));
		if (!already) {
			await page.click(selector);
			await page.evaluate((sel: string) => {
				const g = globalThis as any;
				const doc = g.document as any;
				const EventCtor = g.Event;
				const el = doc ? doc.querySelector(sel) : null;
				if (!el) return;
				if (EventCtor) {
					el.dispatchEvent(new EventCtor('change', { bubbles: true }));
				}
			}, selector);
		}

		if (stepDelayMs > 0) await delay(stepDelayMs);

		await submitOtherAchievement(page, stepDelayMs);

		result.achievement_started = true;
		return result;
	} catch (e: any) {
		const msg = e?.message ? String(e.message) : String(e);
		if (opts.debugMode) throw e;
		result.errors.push(msg);
		return result;
	}
}

export async function startTroopTrackOtherAchievements(
	page: any,
	ttSubDomain: string,
	items: Array<Record<string, any>>,
	fieldNames: StartOtherAchievementFieldNames,
	options?: StartOtherAchievementOptions,
): Promise<StartOtherAchievementResultItem[]> {
	if (!ttSubDomain || typeof ttSubDomain !== 'string') {
		throw new Error('Missing or invalid ttSubDomain.');
	}
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}

	const opts: Required<StartOtherAchievementOptions> = {
		delayMs: options?.delayMs ?? 300,
		batchSize: options?.batchSize ?? 0,
		debugMode: options?.debugMode ?? false,
	};

	const results: StartOtherAchievementResultItem[] = [];
	const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : items.length;

	for (let start = 0; start < items.length; start += batchSize) {
		const chunk = items.slice(start, start + batchSize);

		for (let i = 0; i < chunk.length; i++) {
			const index = start + i;
			const item = chunk[i];
			if (!item) {
				results.push({
					index,
					user_id: null,
					award_type_id: null,
					achievement_id: null,
					achievement_started: false,
					errors: ['Internal error: item was undefined'],
				});
				if (opts.debugMode) {
					throw new Error('Internal error: item was undefined');
				}
				continue;
			}

			const res = await startOneOtherAchievement(page, ttSubDomain, item, fieldNames, opts, index);
			results.push(res);

			if (opts.delayMs > 0) {
				await delay(opts.delayMs);
			}
		}
	}

	return results;
}
