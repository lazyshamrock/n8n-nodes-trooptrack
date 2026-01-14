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

export type TroopTrackSetPermissionsOptions = {
	/**
	 * Used only for pacing / stability. Caller controls batching and iteration.
	 */
	delayMs?: number;

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

const ACCESS_LEVEL_SELECT_ID = '#manage_user_privileges_access_level';
const SAVE_BUTTON_SELECTOR =
	'form#new_manage_user_privileges input[type="submit"][value="Save"], form#new_manage_user_privileges button[type="submit"]';

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

			// Click tends to trigger the right listeners, but some sites do custom handlers.
			try {
				input.click();
			} catch {
				input.checked = nextChecked;
				if (EventCtor) {
					input.dispatchEvent(new EventCtor('input', { bubbles: true }));
					input.dispatchEvent(new EventCtor('change', { bubbles: true }));
				}
				if (MouseEventCtor) {
					input.dispatchEvent(new MouseEventCtor('click', { bubbles: true }));
				}
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

	return true;
}

async function clickSaveAndWait(page: any) {
	await safeWaitForSelector(page, SAVE_BUTTON_SELECTOR, 30000);

	// Use navigation wait with a fallback to a brief delay since TroopTrack can do Turbo/partial reloads.
	const navPromise = page
		.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
		.catch(() => null);

	await page.click(SAVE_BUTTON_SELECTOR);

	await navPromise;
	// Extra small settle time for UI post-processing
	await sleep(250);
}

/**
 * Update permissions for a single user on:
 * https://troop457zelie.trooptrack.com/manage/users/{{user_id}}?tab=privileges
 *
 * This function DOES NOT validate that you have "Edit user profile" and "Manage privileges".
 * That check belongs in the node operation flow before you start iterating.
 */
export async function setTroopTrackUserPermissions(
	page: any,
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

	const url = `https://troop457zelie.trooptrack.com/manage/users/${encodeURIComponent(
		String(targetUserId),
	)}?tab=privileges`;

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
			continue;
		}
		try {
			// Make sure it ends up checked
			await setCheckboxChecked(page, handle, true);
		} catch (e) {
			const msg = `Failed to enable permission_id: ${permissionId}`;
			if (debugMode) throw new Error(`${msg}: ${(e as any)?.message || e}`);
			result.errors.push(msg);
		}
	}

	if (delayMs > 0) await sleep(delayMs);

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