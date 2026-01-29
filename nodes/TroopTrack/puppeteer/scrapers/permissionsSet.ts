/**
 * TroopTrack Permissions. Set Permissions (Privileges tab)
 *
 * IMPORTANT TYPESCRIPT NOTE (n8n build): This project does NOT include DOM libs.
 * - Do not use document/window/Element/HTMLElement types in TS annotations.
 * - Inside page.evaluate / $$eval, only access globals via (globalThis as any)
 *   and type DOM nodes as any.
 */

export type TroopTrackSetPermissionsResult = {
	user_id: number | string;
	errors: string[];
};

export type TroopTrackSetPermissionsFieldNames = {
	user_id: string;
	access_level: string;
	granted_permissions: string;
};

export type TroopTrackSetPermissionsOptions = {
	/**
	 * Used only for pacing / stability. Caller controls batching and iteration.
	 */
	delayMs?: number;

	/**
	 * Optional batch size when iterating a batch input.
	 */
	batchSize?: number;

	/**
	 * When true, functions will throw on certain hard failures
	 * instead of returning an error message in the errors array.
	 */
	debugMode?: boolean;

	/**
	 * Optional logger for trace output.
	 */
	log?: (message: string, meta?: Record<string, unknown>) => void;
};

export type TroopTrackSetPermissionsInput = {
	user_id: number | string;
	access_level: string;
	granted_permissions: number[];
};

export type TroopTrackSetPermissionsBatchInput = {
	baseUrl: string;
	my_user_id: number;
	items: Array<Record<string, any>>;
	fieldNames: TroopTrackSetPermissionsFieldNames;
	options?: TroopTrackSetPermissionsOptions;
};

export type TroopTrackSetPermissionsBatchResultItem = {
	index: number;
	user_id: number | string;
	errors: string[];
};

const ACCESS_LEVEL_SELECT_ID = '#manage_user_privileges_access_level';
const SAVE_BUTTON_SELECTOR =
	'form#new_manage_user_privileges input[type="submit"][value="Save"], form#new_manage_user_privileges button[type="submit"]';

function buildPrivilegesUrl(baseUrl: string, userId: string | number): string {
	const root = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
	return `${root}/manage/users/${encodeURIComponent(String(userId))}?tab=privileges`;
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function asNumberArray(value: unknown): number[] | null {
	if (!Array.isArray(value)) return null;
	const out: number[] = [];
	for (const v of value) {
		if (typeof v !== 'number' || Number.isNaN(v)) return null;
		out.push(v);
	}
	return out;
}

async function safeWaitForSelector(page: any, selector: string, timeoutMs = 30000) {
	await page.waitForSelector(selector, { timeout: timeoutMs });
}

async function setCheckboxChecked(page: any, elHandle: any, checked: boolean) {
	// Some TroopTrack controls need events to fire.
	await page.evaluate(
		(el: any, nextChecked: boolean) => {
			const g = globalThis as any;
			const EventCtor = g.Event;
			const MouseEventCtor = g.MouseEvent;

			const input = el as any;
			if (!input) return;

			const isCheckbox =
				typeof input.getAttribute === 'function' &&
				(input.getAttribute('type') || '').toLowerCase() === 'checkbox';

			if (!isCheckbox) return;

			const current = !!input.checked;
			if (current === nextChecked) return;

			// Force the checked state first, then emit events.
			input.checked = nextChecked;
			if (EventCtor) {
				input.dispatchEvent(new EventCtor('input', { bubbles: true }));
				input.dispatchEvent(new EventCtor('change', { bubbles: true }));
			}
			if (MouseEventCtor) {
				input.dispatchEvent(new MouseEventCtor('click', { bubbles: true }));
			}
		},
		elHandle,
		checked,
	);
}

async function uncheckAllPrivilegeCheckboxes(page: any) {
	// The instructions mention:
	// - checkboxes with id=check_all_div (sometimes it is a div containing an input)
	// - checkboxes with id containing manage_user_privileges_privileges
	const handles: any[] = [];

	// Covers: <input id="check_all_div" type="checkbox"> OR <div id="check_all_div"><input type="checkbox"></div>
	const checkAll1 = await page.$$(
		'input#check_all_div[type="checkbox"], #check_all_div input[type="checkbox"]',
	);
	handles.push(...checkAll1);

	// Covers privilege checkboxes
	const priv = await page.$$(
		'input[type="checkbox"][id*="manage_user_privileges_privileges"]',
	);
	handles.push(...priv);

	// Deduplicate by underlying node (best-effort)
	const seen = new Set<string>();
	const unique: any[] = [];
	for (const h of handles) {
		const key = await page.evaluate((el: any) => {
			try {
				return (el && el.id) || (el && el.getAttribute && el.getAttribute('id')) || '';
			} catch {
				return '';
			}
		}, h);
		if (!key) {
			unique.push(h);
			continue;
		}
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(h);
		}
	}

	for (const h of unique) {
		await setCheckboxChecked(page, h, false);
	}
}

async function getAccessLevelOptions(page: any): Promise<Array<{ value: string; text: string }>> {
	await safeWaitForSelector(page, ACCESS_LEVEL_SELECT_ID, 30000);
	return await page.evaluate((selector: string) => {
		const g = globalThis as any;
		const doc = g.document as any;
		const select = doc ? doc.querySelector(selector) : null;
		if (!select) return [];
		const options = Array.from(select.querySelectorAll('option')) as any[];
		return options.map((o) => ({
			value: (o && o.value) || '',
			text: (o && (o.textContent || '')).trim(),
		}));
	}, ACCESS_LEVEL_SELECT_ID);
}

async function getCheckedPermissionIds(page: any): Promise<number[]> {
	return await page.evaluate(() => {
		const g = globalThis as any;
		const doc = g.document as any;
		if (!doc) return [];
		const nodes = Array.from(
			doc.querySelectorAll(
				'input[type="checkbox"][id^="manage_user_privileges_privileges_"]:checked',
			),
		) as any[];
		return nodes
			.map((el) => Number(el && el.value))
			.filter((v) => Number.isFinite(v));
	});
}

async function getFormPermissionIds(page: any): Promise<number[]> {
	return await page.evaluate(() => {
		const g = globalThis as any;
		const doc = g.document as any;
		if (!doc) return [];
		const values: number[] = [];

		const checked = Array.from(
			doc.querySelectorAll(
				'input[type="checkbox"][id^="manage_user_privileges_privileges_"]:checked',
			),
		) as any[];
		for (const el of checked) {
			const v = Number(el && el.value);
			if (Number.isFinite(v)) values.push(v);
		}

		const injected = Array.from(
			doc.querySelectorAll('form#new_manage_user_privileges input[data-tt-injected="1"]'),
		) as any[];
		for (const el of injected) {
			const v = Number(el && el.value);
			if (Number.isFinite(v)) values.push(v);
		}

		return values;
	});
}

async function injectPermissionInputs(page: any, permissionIds: number[]) {
	await page.evaluate((ids: number[]) => {
		const g = globalThis as any;
		const doc = g.document as any;
		if (!doc) return;
		const form = doc.querySelector('form#new_manage_user_privileges');
		if (!form) return;

		const existing = Array.from(form.querySelectorAll('input[data-tt-injected="1"]')) as any[];
		for (const el of existing) {
			try {
				el.remove();
			} catch {
				/* no-op */
			}
		}

		for (const id of ids) {
			const input = doc.createElement('input');
			input.type = 'hidden';
			input.name = 'manage_user_privileges[privileges][]';
			input.value = String(id);
			input.setAttribute('data-tt-injected', '1');
			form.appendChild(input);
		}
	}, permissionIds);
}

async function applyPermissionsWithRetry(page: any, permissionIds: number[]) {
	const expected = new Set(permissionIds);
	let lastMissing: number[] = [];
	let lastExtra: number[] = [];

	for (let attempt = 0; attempt < 2; attempt++) {
		for (const permissionId of permissionIds) {
			const selector = `#manage_user_privileges_privileges_${permissionId}`;
			const handle = await page.$(selector);
			if (!handle) continue;
			await setCheckboxChecked(page, handle, true);
		}

		await sleep(150);
		const checked = await getCheckedPermissionIds(page);
		lastMissing = permissionIds.filter((id) => !checked.includes(id));
		lastExtra = checked.filter((id) => !expected.has(id));

		if (lastMissing.length === 0) {
			return { missing: lastMissing, extra: lastExtra };
		}

		// If the DOM was re-rendered after access-level change, retry once.
		await sleep(500);
	}

	return { missing: lastMissing, extra: lastExtra };
}

async function selectAccessLevel(page: any, accessLevel: string): Promise<boolean> {
	const opts = await getAccessLevelOptions(page);

	// Prefer matching by option.value. Fallback to matching by visible text.
	const byValue = opts.find((o) => o.value === accessLevel);
	if (byValue) {
		await page.select(ACCESS_LEVEL_SELECT_ID, byValue.value);
		// Ensure change event fires (some sites rely on it)
		await page.evaluate((selector: string) => {
			const g = globalThis as any;
			const doc = g.document as any;
			const EventCtor = g.Event;
			const el = doc ? doc.querySelector(selector) : null;
			if (!el) return;
			if (EventCtor) el.dispatchEvent(new EventCtor('change', { bubbles: true }));
		}, ACCESS_LEVEL_SELECT_ID);
		// Give the page a moment in case access-level triggers async re-render.
		await sleep(400);
		return true;
	}

	const byText = opts.find((o) => o.text === accessLevel);
	if (!byText) return false;

	// Select by text: set selectedIndex manually
	await page.evaluate(
		(selector: string, wantedText: string) => {
			const g = globalThis as any;
			const doc = g.document as any;
			const EventCtor = g.Event;

			const select = doc ? doc.querySelector(selector) : null;
			if (!select) return;

			const options = Array.from(select.querySelectorAll('option')) as any[];
			const idx = options.findIndex((o) => ((o && (o.textContent || '')).trim() || '') === wantedText);
			if (idx < 0) return;

			select.selectedIndex = idx;
			if (EventCtor) select.dispatchEvent(new EventCtor('change', { bubbles: true }));
		},
		ACCESS_LEVEL_SELECT_ID,
		accessLevel,
	);
	await sleep(400);

	return true;
}

async function clickSaveAndWait(page: any) {
	await safeWaitForSelector(page, SAVE_BUTTON_SELECTOR, 30000);

	// Dismiss push notification modal if it appears (it can block clicks).
	try {
		const noThanksSelector = '#pushpad-prompt a[href*="deny"], #pushpad-prompt button';
		const promptVisible = await page.$('#pushpad-prompt');
		if (promptVisible) {
			const btn = await page.$(noThanksSelector);
			if (btn) {
				await btn.click();
				await sleep(250);
			}
		}
	} catch {
		// ignore modal dismissal failures
	}

	try {
		await page.$eval(SAVE_BUTTON_SELECTOR, (el: any) => {
			if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
		});
		await sleep(150);
	} catch {
		// ignore scroll failures
	}

	// Use navigation wait with a fallback to a brief delay since TroopTrack can do Turbo/partial reloads.
	const navPromise = page
		.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
		.catch(() => null);

	const actionPath = await page.evaluate(() => {
		const g = globalThis as any;
		const doc = g.document as any;
		const form = doc ? doc.querySelector('form#new_manage_user_privileges') : null;
		return (form && form.getAttribute && form.getAttribute('action')) || '';
	});

	const responsePromise = actionPath
		? page
				.waitForResponse((resp: any) => {
					try {
						const req = resp.request();
						const url = resp.url();
						return req && req.method() === 'POST' && typeof url === 'string' && url.includes(actionPath);
					} catch {
						return false;
					}
				}, { timeout: 30000 })
				.catch(() => null)
		: Promise.resolve(null);

	// Click Save; fall back to submitting the form directly.
	try {
		await page.click(SAVE_BUTTON_SELECTOR);
	} catch {
		await page.evaluate(() => {
			const g = globalThis as any;
			const doc = g.document as any;
			const form = doc ? doc.querySelector('form#new_manage_user_privileges') : null;
			if (form && form.submit) form.submit();
		});
	}

	await Promise.race([navPromise, responsePromise]);
	// Extra settle time for UI post-processing / server persistence
	await sleep(1500);
}

/**
 * Update permissions for a single user on:
 * {baseUrl}/manage/users/{{user_id}}?tab=privileges
 *
 * This function DOES NOT validate that you have "Edit user profile" and "Manage privileges".
 * That check belongs in the node operation flow before you start iterating.
 */
async function setTroopTrackUserPermissionsSingle(
	page: any,
	baseUrl: string,
	input: TroopTrackSetPermissionsInput,
	options: TroopTrackSetPermissionsOptions = {},
): Promise<TroopTrackSetPermissionsResult> {
	const { delayMs = 0, debugMode = false, log } = options;

	const result: TroopTrackSetPermissionsResult = {
		user_id: input.user_id,
		errors: [],
	};

	// Hard validation for granted_permissions array of numbers.
	const gp = asNumberArray(input.granted_permissions);
	if (!gp) {
		const msg = 'granted_permissions must be an array of numbers';
		if (debugMode) throw new Error(msg);
		result.errors.push(msg);
		return result;
	}

	const targetUserId = input.user_id;
	const accessLevel = (input.access_level || '').trim();

	const url = buildPrivilegesUrl(baseUrl, targetUserId);

	log?.('Navigating to TroopTrack privileges page', { url, user_id: targetUserId });

	try {
		await page.goto(url, { waitUntil: 'networkidle2' });
	} catch (e) {
		const msg = `Failed to navigate to privileges page for user_id ${targetUserId}`;
		if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
		result.errors.push(msg);
		return result;
	}

	if (delayMs > 0) await sleep(delayMs);

	// Ensure form exists
	try {
		await safeWaitForSelector(page, ACCESS_LEVEL_SELECT_ID, 30000);
		await safeWaitForSelector(
			page,
			'input[type="checkbox"][id^="manage_user_privileges_privileges_"]',
			30000,
		);
	} catch (e) {
		const msg = `Privileges form not found for user_id ${targetUserId}`;
		if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
		result.errors.push(msg);
		return result;
	}

	// Access Level validation and selection
	if (!accessLevel) {
		result.errors.push('access_level is empty');
	} else {
		const ok = await selectAccessLevel(page, accessLevel);
		if (!ok) {
			result.errors.push(`Unknown Access Level: ${accessLevel}`);
		}
	}

	if (delayMs > 0) await sleep(delayMs);

	// Reset all permissions to disabled
	try {
		await uncheckAllPrivilegeCheckboxes(page);
	} catch (e) {
		const msg = 'Failed while resetting existing privileges';
		if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
		result.errors.push(msg);
	}

	if (delayMs > 0) await sleep(delayMs);

	// Check requested permissions
	for (const permissionId of gp) {
		const selector = `#manage_user_privileges_privileges_${permissionId}`;
		const handle = await page.$(selector);
		if (!handle) {
			result.errors.push(`Unknown permission_id: ${permissionId}`);
		}
	}

	if (result.errors.length === 0) {
		try {
			await applyPermissionsWithRetry(page, gp);
		} catch (e) {
			const msg = 'Failed to enable requested permissions';
			if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
			result.errors.push(msg);
		}
	}

	if (delayMs > 0) await sleep(delayMs);

	// Verify requested permissions were applied in the DOM before saving.
	try {
		const checked = await getCheckedPermissionIds(page);
		const expected = new Set(gp);
		let missing = gp.filter((id) => !checked.includes(id));
		let extra = checked.filter((id) => !expected.has(id));

		if (missing.length > 0) {
			// Fallback: inject hidden inputs so the form submits expected privileges.
			await injectPermissionInputs(page, gp);
			await sleep(100);

			const formValues = await getFormPermissionIds(page);
			missing = gp.filter((id) => !formValues.includes(id));
			extra = formValues.filter((id) => !expected.has(id));
		}

		if (missing.length > 0 || extra.length > 0) {
			result.errors.push(
				`Permissions mismatch before save. Missing: [${missing.join(', ')}], Extra: [${extra.join(', ')}]`,
			);
		}
	} catch (e) {
		const msg = 'Failed to verify permissions before saving';
		if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
		result.errors.push(msg);
	}

	// Save only if no errors
	if (result.errors.length === 0) {
		try {
			log?.('Submitting privileges form (Save)', { user_id: targetUserId });
			await clickSaveAndWait(page);
		} catch (e) {
			const msg = `Failed to save privileges for user_id ${targetUserId}`;
			if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
			result.errors.push(msg);
		}
	} else {
		log?.('Skipping Save due to errors', { user_id: targetUserId, errors: result.errors });
	}

	return result;
}

export async function setTroopTrackUserPermissions(
	page: any,
	input: TroopTrackSetPermissionsBatchInput | TroopTrackSetPermissionsInput,
	options: TroopTrackSetPermissionsOptions = {},
): Promise<TroopTrackSetPermissionsBatchResultItem[] | TroopTrackSetPermissionsResult> {
	const isBatch =
		input && typeof input === 'object' && Array.isArray((input as TroopTrackSetPermissionsBatchInput).items);

	if (!isBatch) {
		const single = input as TroopTrackSetPermissionsInput;
		const baseUrl = (input as any)?.baseUrl || '';
		if (!baseUrl) {
			throw new Error('Missing baseUrl for single permissions update.');
		}
		return await setTroopTrackUserPermissionsSingle(page, baseUrl, single, options);
	}

	const batch = input as TroopTrackSetPermissionsBatchInput;
	if (!batch.baseUrl || typeof batch.baseUrl !== 'string') {
		throw new Error('Missing or invalid baseUrl.');
	}
	if (!Array.isArray(batch.items) || batch.items.length === 0) return [];

	const opts: Required<TroopTrackSetPermissionsOptions> = {
		delayMs: batch.options?.delayMs ?? 300,
		batchSize: batch.options?.batchSize ?? 0,
		debugMode: batch.options?.debugMode ?? false,
		log: batch.options?.log ?? (() => undefined),
	};

	const results: TroopTrackSetPermissionsBatchResultItem[] = [];
	const batchSize = opts.batchSize > 0 ? opts.batchSize : batch.items.length;

	for (let start = 0; start < batch.items.length; start += batchSize) {
		const chunk = batch.items.slice(start, start + batchSize);

		for (let i = 0; i < chunk.length; i++) {
			const index = start + i;
			const item = chunk[i];
			const errors: string[] = [];

			if (!item) {
				errors.push('Internal error: item was undefined');
				results.push({ index, user_id: '', errors });
				if (opts.debugMode) {
					throw new Error('Internal error: item was undefined');
				}
				continue;
			}

			const userId = readMapped(item, batch.fieldNames.user_id);
			const accessLevel = readMapped(item, batch.fieldNames.access_level);
			const grantedPermissions = readMapped(item, batch.fieldNames.granted_permissions);

			if (userId === undefined || userId === null || userId === '') {
				errors.push(`Missing ${batch.fieldNames.user_id}`);
			}
			if (accessLevel === undefined || accessLevel === null || String(accessLevel).trim() === '') {
				errors.push(`Missing ${batch.fieldNames.access_level}`);
			}
			if (!Array.isArray(grantedPermissions)) {
				errors.push(`Invalid ${batch.fieldNames.granted_permissions}: expected array`);
			}

			if (errors.length > 0) {
				results.push({
					index,
					user_id: (userId as any) ?? '',
					errors,
				});
				if (opts.debugMode) {
					throw new Error(errors[0]);
				}
				continue;
			}

			const singleInput: TroopTrackSetPermissionsInput = {
				user_id: userId as any,
				access_level: String(accessLevel ?? ''),
				granted_permissions: grantedPermissions as any,
			};

			const res = await setTroopTrackUserPermissionsSingle(page, batch.baseUrl, singleInput, opts);
			results.push({
				index,
				user_id: res.user_id,
				errors: res.errors,
			});

			if (opts.delayMs > 0) {
				await sleep(opts.delayMs);
			}
		}
	}

	return results;
}
