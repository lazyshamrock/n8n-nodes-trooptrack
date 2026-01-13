import type { Page } from 'puppeteer';

export interface TroopTrackPermission {
	permission_id: number | null;
	permission_name: string | null;
}

interface ScrapePermissionsInput {
	baseUrl: string;
	demoAdultUserId: number;
}

function toNumberOrNull(value: unknown): number | null {
	const n = Number.parseInt(String(value ?? ''), 10);
	return Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown): string | null {
	const s = String(value ?? '').replace(/\s+/g, ' ').trim();
	return s.length ? s : null;
}

export async function scrapePermissions(
	page: Page,
	input: ScrapePermissionsInput,
): Promise<TroopTrackPermission[]> {
	const baseUrl = String(input.baseUrl ?? '').replace(/\/+$/, '');
	const demoAdultUserId = input.demoAdultUserId;

	if (!baseUrl) throw new Error('baseUrl is required');
	if (!demoAdultUserId) throw new Error('demoAdultUserId is required');

	const privilegesUrl = `${baseUrl}/manage/users/${encodeURIComponent(
		String(demoAdultUserId),
	)}?tab=privileges`;

	try {
		await page.goto(privilegesUrl, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('input.form-check-input[type="checkbox"]', { timeout: 15000 });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Failed to load Privileges page or find checkbox UI.\nURL: ${privilegesUrl}\nSelector: input.form-check-input[type="checkbox"]\nReason: ${msg}`,
		);
	}

	const raw = await page.evaluate(() => {
		// IMPORTANT: Do not reference `document` directly. This project compiles without DOM libs.
		const d = (globalThis as any).document as any;

		const matchesIdPattern = (id: string) => /manage_user_privileges_privileges_(\d+)$/.exec(id);

		const isInsideCheckAllDiv = (node: any): boolean => {
			let cur = node;
			while (cur) {
				if (cur.id === 'check_all_div') return true;
				if (cur.classList && typeof cur.classList.contains === 'function' && cur.classList.contains('check_all_div')) {
					return true;
				}
				cur = cur.parentElement;
			}
			return false;
		};

		const all = Array.from(
			d.querySelectorAll('input.form-check-input[type="checkbox"]'),
		) as any[];

		const checkboxes = all.filter((cb) => {
			if (!cb) return false;
			if (cb.id === 'check_all_div') return false;
			if (cb.getAttribute && cb.getAttribute('name') === 'check_all_div') return false;
			if (isInsideCheckAllDiv(cb.parentElement)) return false;
			return true;
		});

		const out: Array<{ permission_id: number | null; permission_name: string | null }> = [];

		for (const cb of checkboxes) {
			const id = String(cb.id ?? '');
			const m = matchesIdPattern(id);
			const permission_id = m ? Number(m[1]) : null;

			let label: any = null;

			try {
				label = d.querySelector(`label.form-check-label[for="${id}"]`);
			} catch {
				label = null;
			}

			if (!label && cb.closest) {
				const wrapper = cb.closest('.form-check');
				label = wrapper ? wrapper.querySelector('label.form-check-label') : null;
			}

			const permission_name = label ? String(label.textContent ?? '').replace(/\s+/g, ' ').trim() : null;

			out.push({
				permission_id: Number.isFinite(permission_id as any) ? permission_id : null,
				permission_name: permission_name && permission_name.length ? permission_name : null,
			});
		}

		return out;
	});

	return raw.map((r) => ({
		permission_id: toNumberOrNull((r as any).permission_id),
		permission_name: cleanText((r as any).permission_name),
	}));
}