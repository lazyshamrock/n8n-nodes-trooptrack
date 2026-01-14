/**
 * Create TroopTrack Leadership Tracker entries (new assignments) via Puppeteer.
 *
 * Notes:
 * - Iterates items on a single Page instance.
 * - Does not attempt to update existing entries. It only creates new ones.
 * - Avoids DOM lib types in TypeScript. In page.evaluate, use (globalThis as any).
 */

export type WaitUntilOption = 'domcontentloaded' | 'load' | 'networkidle0' | 'networkidle2';

export interface CreateAssignmentsFieldMapping {
	userIdField: string;
	positionIdField: string;
	startDateField: string;
	endDateField: string;
}

export interface ChromiumOptions {
	navigationTimeoutMs?: number;
	waitUntil?: WaitUntilOption;
	userAgent?: string;
	viewportWidth?: number;
	viewportHeight?: number;
	blockImagesAndMedia?: boolean;
}

export interface CreateAssignmentsOptions {
	delayMs?: number;
	batchSize?: number; // 0 means no batching
	debugMode?: boolean;
	chromiumOptions?: ChromiumOptions;
}

export interface CreateAssignmentInputItem {
	[key: string]: unknown;
}

export interface CreateAssignmentError {
	index: number;
	user_id?: string | number;
	position_id?: string | number;
	start_date?: string;
	end_date?: string;
	url?: string;
	error: string;
}

export interface CreateAssignmentsResult {
	successCount: number;
	errorCount: number;
	errors: CreateAssignmentError[];
}

const SELECTORS = {
	form: '#new_leadership_tracker',
	role: '#leadership_tracker_role_id',
	start: '#leadership_tracker_start_on',
	end: '#leadership_tracker_end_on',
	submitBtn: '#new_leadership_tracker input[type="submit"], #new_leadership_tracker button[type="submit"]',
};

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildNewUrl(ttSubDomain: string, userId: string | number): string {
	return `https://${ttSubDomain}.trooptrack.com/manage/users/${encodeURIComponent(String(userId))}/leadership_trackers/new`;
}

function toStr(v: unknown): string {
	return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
}

function readMapped(item: CreateAssignmentInputItem, field: string): unknown {
	// supports nested dot notation like "data.user_id" if you want it later
	if (!field.includes('.')) return item[field];

	const parts = field.split('.');
	let cur: any = item;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = cur[p];
	}
	return cur;
}

async function configurePage(page: any, chromiumOptions?: ChromiumOptions): Promise<void> {
	const navTimeout = chromiumOptions?.navigationTimeoutMs ?? 120000;
	page.setDefaultNavigationTimeout(navTimeout);
	page.setDefaultTimeout(navTimeout);

	if (chromiumOptions?.userAgent) {
		await page.setUserAgent(chromiumOptions.userAgent);
	}

	const vw = chromiumOptions?.viewportWidth ?? 1365;
	const vh = chromiumOptions?.viewportHeight ?? 768;
	if (vw > 0 && vh > 0) {
		await page.setViewport({ width: vw, height: vh });
	}

	const block = chromiumOptions?.blockImagesAndMedia ?? true;
	if (block) {
		await page.setRequestInterception(true);
		page.on('request', (req: any) => {
			const rt = req.resourceType?.() ?? '';
			if (rt === 'image' || rt === 'media' || rt === 'font') {
				req.abort();
				return;
			}
			req.continue();
		});
	}
}

async function optionExists(page: any, selector: string, value: string): Promise<boolean> {
	return page.$eval(
		selector,
		(selectEl: any, v: any) => {
			const opts = Array.from((selectEl as any).options || []);
			return opts.some((o: any) => String(o.value) === String(v));
		},
		value,
	);
}

async function setDate(page: any, selector: string, value: string): Promise<void> {
	// Use globalThis to avoid relying on DOM typings.
	await page.$eval(
		selector,
		(el: any, v: any) => {
			(el as any).value = v;

			const g: any = (globalThis as any);
			const EventCtor = g.Event;

			if (EventCtor) {
				(el as any).dispatchEvent(new EventCtor('input', { bubbles: true }));
				(el as any).dispatchEvent(new EventCtor('change', { bubbles: true }));
			}
		},
		value,
	);
}

async function submitFormAndWait(page: any, userId: string | number, waitUntil: WaitUntilOption, navTimeoutMs: number): Promise<void> {
	const postWait = page.waitForResponse(
		(resp: any) => {
			try {
				const req = resp.request?.();
				const method = req?.method?.() ?? '';
				const url = resp.url?.() ?? '';
				return (
					method === 'POST' &&
					url.includes(`/manage/users/${encodeURIComponent(String(userId))}/leadership_trackers`)
				);
			} catch {
				return false;
			}
		},
		{ timeout: Math.min(20000, navTimeoutMs) },
	);

	const navWait = page.waitForNavigation({
		waitUntil,
		timeout: Math.min(20000, navTimeoutMs),
	});

	// Click submit inside DOM context safely
	await page.$eval(
		SELECTORS.form,
		(form: any, submitSel: any) => {
			const btn = form.querySelector?.(submitSel);
			if (btn) {
				btn.click();
			} else if (form.submit) {
				form.submit();
			}
		},
		SELECTORS.submitBtn,
	);

	let completed: any = null;
	try {
		completed = await Promise.race([
			postWait.then((r: any) => ({ kind: 'response', status: r.status?.() ?? 0 })),
			navWait.then(() => ({ kind: 'navigation' })),
		]);
	} catch {
		// handled below
	}

	if (!completed) {
		throw new Error('Submission did not complete (no POST response or navigation observed).');
	}

	if (completed.kind === 'response' && completed.status >= 400) {
		throw new Error(`Server responded with status ${completed.status} for leadership tracker POST.`);
	}
}

async function processOne(
	page: any,
	ttSubDomain: string,
	item: CreateAssignmentInputItem,
	mapping: CreateAssignmentsFieldMapping,
	opts: Required<CreateAssignmentsOptions>,
	index: number,
): Promise<void> {
	const userId = readMapped(item, mapping.userIdField);
	const positionId = readMapped(item, mapping.positionIdField);
	const startDate = readMapped(item, mapping.startDateField);
	const endDate = readMapped(item, mapping.endDateField);

	const user_id = userId as any;
	const position_id = positionId as any;

	if (!userId || !positionId || !startDate || !endDate) {
		throw new Error(
			`Missing required mapped fields. user_id=${toStr(userId)} position_id=${toStr(positionId)} start_date=${toStr(
				startDate,
			)} end_date=${toStr(endDate)}`,
		);
	}

	const url = buildNewUrl(ttSubDomain, userId as any);

	const waitUntil = opts.chromiumOptions.waitUntil ?? 'domcontentloaded';
	const navTimeoutMs = opts.chromiumOptions.navigationTimeoutMs ?? 120000;

	await page.goto(url, { waitUntil, timeout: navTimeoutMs });

	await Promise.all([
		page.waitForSelector(SELECTORS.form, { timeout: 15000 }),
		page.waitForSelector(SELECTORS.role, { timeout: 15000 }),
		page.waitForSelector(SELECTORS.start, { timeout: 15000 }),
		page.waitForSelector(SELECTORS.end, { timeout: 15000 }),
	]);

	const positionIdStr = String(positionId);

	const hasOption = await optionExists(page, SELECTORS.role, positionIdStr);
	if (!hasOption) {
		throw new Error(`Position option value "${positionIdStr}" not found in dropdown.`);
	}

	const selected = await page.select(SELECTORS.role, positionIdStr);
	if (!selected || selected.length === 0) {
		throw new Error(`Failed to select position_id "${positionIdStr}".`);
	}

	await setDate(page, SELECTORS.start, String(startDate));
	await setDate(page, SELECTORS.end, String(endDate));

	await submitFormAndWait(page, userId as any, waitUntil, navTimeoutMs);

	if (opts.delayMs > 0) await delay(opts.delayMs);

	// Suppress unused variable linting in some setups
	void user_id;
	void position_id;
}

export async function createPositionAssignments(
	page: any,
	ttSubDomain: string,
	items: CreateAssignmentInputItem[],
	mapping: CreateAssignmentsFieldMapping,
	options?: CreateAssignmentsOptions,
): Promise<CreateAssignmentsResult> {
	if (!ttSubDomain || typeof ttSubDomain !== 'string') {
		throw new Error('Missing or invalid ttSubDomain.');
	}
	if (!Array.isArray(items) || items.length === 0) {
		return { successCount: 0, errorCount: 0, errors: [] };
	}

	const opts: Required<CreateAssignmentsOptions> = {
		delayMs: options?.delayMs ?? 300,
		batchSize: options?.batchSize ?? 0,
		debugMode: options?.debugMode ?? false,
		chromiumOptions: {
			navigationTimeoutMs: options?.chromiumOptions?.navigationTimeoutMs ?? 120000,
			waitUntil: options?.chromiumOptions?.waitUntil ?? 'domcontentloaded',
			userAgent: options?.chromiumOptions?.userAgent ?? '',
			viewportWidth: options?.chromiumOptions?.viewportWidth ?? 1365,
			viewportHeight: options?.chromiumOptions?.viewportHeight ?? 768,
			blockImagesAndMedia: options?.chromiumOptions?.blockImagesAndMedia ?? true,
		},
	};

	await configurePage(page, opts.chromiumOptions);

	const errors: CreateAssignmentError[] = [];
	let successCount = 0;

	const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : items.length;

	for (let start = 0; start < items.length; start += batchSize) {
		const chunk = items.slice(start, start + batchSize);

		for (let i = 0; i < chunk.length; i++) {
            const index = start + i;

            const item = chunk[i];
            if (!item) {
                // Should never happen, but satisfies TS and avoids passing undefined.
                errors.push({
                    index,
                    error: 'Internal error: chunk item was undefined.',
                });
                if (opts.debugMode) {
                    throw new Error('Internal error: chunk item was undefined.');
                }
                continue;
            }

            try {
                await processOne(page, ttSubDomain, item, mapping, opts, index);
                successCount++;
            } catch (e: any) {
                const userId = readMapped(item, mapping.userIdField);
                const positionId = readMapped(item, mapping.positionIdField);
                const startDate = readMapped(item, mapping.startDateField);
                const endDate = readMapped(item, mapping.endDateField);

                errors.push({
                    index,
                    user_id: userId as any,
                    position_id: positionId as any,
                    start_date: toStr(startDate),
                    end_date: toStr(endDate),
                    url: userId ? buildNewUrl(ttSubDomain, userId as any) : undefined,
                    error: e?.message ? String(e.message) : String(e),
                });

                if (opts.debugMode) {
                    throw e;
                }

                if (opts.delayMs > 0) await delay(Math.min(300, opts.delayMs));
            }
        }

	}

	return {
		successCount,
		errorCount: errors.length,
		errors,
	};
}