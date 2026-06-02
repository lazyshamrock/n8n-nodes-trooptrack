/**
 * TroopTrack Achievements: Start Merit Badge (web UI)
 *
 * IMPORTANT TYPESCRIPT NOTE (n8n build): This project does NOT include DOM libs.
 * - Do not use document/window/Element/HTMLElement types in TS annotations.
 * - Inside page.evaluate / $$eval, only access globals via (globalThis as any)
 *   and type DOM nodes as any.
 */

export type StartMeritBadgeFieldNames = {
	user_id: string;
	achievement_id: string;
};

export type StartMeritBadgeOptions = {
	/**
	 * Used for pacing / stability and between-item delays.
	 */
	delayMs?: number;

	/**
	 * Process items in chunks. 0 means no batching.
	 */
	batchSize?: number;

	/**
	 * When true, throws on hard failures instead of returning errors.
	 */
	debugMode?: boolean;
};

export type StartMeritBadgeResultItem = {
	index: number;
	mb_added: boolean;
	errors: string[];
};

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAchievementsUrl(ttSubDomain: string, userId: string | number): string {
	return `https://${ttSubDomain}.trooptrack.com/manage/users/${encodeURIComponent(
		String(userId),
	)}?tab=achievements`;
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

function errorToMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	if (error && typeof error === 'object') {
		const maybeMessage = (error as { message?: unknown }).message;
		if (typeof maybeMessage === 'string') return maybeMessage;
		if (maybeMessage != null) return errorToMessage(maybeMessage);

		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
}

async function clickByText(page: any, selector: string, text: string): Promise<void> {
	const ok = await page.evaluate(
		(sel: string, label: string) => {
			const g = globalThis as any;
			const doc = g.document as any;
			if (!doc) return false;
			const nodes = Array.from(doc.querySelectorAll(sel)) as any[];
			const target = nodes.find((el) => ((el?.textContent || '').trim() || '') === label);
			if (!target) return false;
			try {
				target.click();
				return true;
			} catch {
				return false;
			}
		},
		selector,
		text,
	);

	if (!ok) {
		throw new Error(`Unable to find "${text}" button`);
	}
}

async function openStartMeritBadgeModal(page: any, stepDelayMs: number): Promise<void> {
	await clickByText(page, 'a, button', 'Actions');
	if (stepDelayMs > 0) await delay(stepDelayMs);

	await page.waitForSelector('.dropdown-menu .dropdown-item', { timeout: 10000 });
	await clickByText(page, '.dropdown-menu .dropdown-item', 'Start Merit Badge');
	if (stepDelayMs > 0) await delay(stepDelayMs);
}

async function submitStartMeritBadge(page: any, stepDelayMs: number): Promise<void> {
	const submitSelector =
		'#new_merit_badge_tracker input[type="submit"], #new_merit_badge_tracker button[type="submit"]';

	await page.waitForSelector(submitSelector, { visible: true, timeout: 20000 });

	const navPromise = page
		.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
		.catch(() => null);

	await page.click(submitSelector);
	await navPromise;

	if (stepDelayMs > 0) await delay(stepDelayMs);
}

async function startOneMeritBadge(
	page: any,
	ttSubDomain: string,
	item: Record<string, any>,
	fieldNames: StartMeritBadgeFieldNames,
	opts: Required<StartMeritBadgeOptions>,
	index: number,
): Promise<StartMeritBadgeResultItem> {
	const result: StartMeritBadgeResultItem = {
		index,
		mb_added: false,
		errors: [],
	};

	const userId = readMapped(item, fieldNames.user_id);
	const achievementId = readMapped(item, fieldNames.achievement_id);

	if (userId === undefined || userId === null || userId === '') {
		result.errors.push(`Missing ${fieldNames.user_id}`);
		return result;
	}

	if (achievementId === undefined || achievementId === null || achievementId === '') {
		result.errors.push(`Missing ${fieldNames.achievement_id}`);
		return result;
	}

	const url = buildAchievementsUrl(ttSubDomain, userId as any);
	const stepDelayMs = Math.min(1000, Math.max(0, opts.delayMs));

	try {
		await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
		if (stepDelayMs > 0) await delay(stepDelayMs);

		await openStartMeritBadgeModal(page, stepDelayMs);

		const selector = `#merit_badge_tracker_merit_badge_id_${achievementId}`;

		try {
			await page.waitForSelector(selector, { visible: true, timeout: 20000 });
		} catch {
			throw new Error(`Merit badge ${achievementId} not found or already started for user_id ${userId}`);
		}

		const already = await page.$eval(selector, (el: any) => Boolean(el?.checked));
		if (already) {
			throw new Error(`Merit badge ${achievementId} already started for user_id ${userId}`);
		}

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

		if (stepDelayMs > 0) await delay(stepDelayMs);

		await submitStartMeritBadge(page, stepDelayMs);

		result.mb_added = true;
		return result;
	} catch (e: any) {
		const msg = errorToMessage(e);
		if (opts.debugMode) throw e;
		result.errors.push(msg);
		return result;
	}
}

export async function startTroopTrackMeritBadges(
	page: any,
	ttSubDomain: string,
	items: Array<Record<string, any>>,
	fieldNames: StartMeritBadgeFieldNames,
	options?: StartMeritBadgeOptions,
): Promise<StartMeritBadgeResultItem[]> {
	if (!ttSubDomain || typeof ttSubDomain !== 'string') {
		throw new Error('Missing or invalid ttSubDomain.');
	}
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}

	const opts: Required<StartMeritBadgeOptions> = {
		delayMs: options?.delayMs ?? 300,
		batchSize: options?.batchSize ?? 0,
		debugMode: options?.debugMode ?? false,
	};

	const results: StartMeritBadgeResultItem[] = [];
	const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : items.length;

	for (let start = 0; start < items.length; start += batchSize) {
		const chunk = items.slice(start, start + batchSize);

		for (let i = 0; i < chunk.length; i++) {
			const index = start + i;
			const item = chunk[i];
			if (!item) {
				results.push({
					index,
					mb_added: false,
					errors: ['Internal error: item was undefined'],
				});
				if (opts.debugMode) {
					throw new Error('Internal error: item was undefined');
				}
				continue;
			}

			const res = await startOneMeritBadge(page, ttSubDomain, item, fieldNames, opts, index);
			results.push(res);

			if (opts.delayMs > 0) {
				await delay(opts.delayMs);
			}
		}
	}

	return results;
}
