import type { IHttpRequestOptions } from 'n8n-workflow';
import type { ResourceHandler } from './types.js';
import { troopTrackRequest } from '../GenericFunctions.js';

const normalizeId = (value: any): number | null => {
	if (value == null) return null;
	if (typeof value === 'string' && value.trim() === '') return null;
	const num = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(num) ? num : null;
};

const readMapped = (item: Record<string, any>, field: string): unknown => {
	if (!field) return undefined;
	if (!field.includes('.')) return item[field];

	const parts = field.split('.');
	let cur: any = item;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = cur[p];
	}
	return cur;
};

const toScalarFieldValue = (value: unknown): string | number | null => {
	if (typeof value === 'string' || typeof value === 'number') return value;
	return null;
};

const looksAbsoluteUrl = (u: string): boolean => /^https?:\/\//i.test(u);

const joinBase = (u: string, baseUrl: string): string => {
	if (looksAbsoluteUrl(u)) return u;
	if (!baseUrl) return u;
	return `${baseUrl.replace(/\/+$/, '')}/${u.replace(/^\/+/, '')}`;
};

// A mapped image field can arrive as a plain URL string, a JSON-encoded attachment,
// a NoCoDB attachment object, or an array of such. Pull the first usable URL out.
const resolveAttachmentUrl = (value: unknown, baseUrl: string): string | null => {
	if (value == null) return null;

	if (typeof value === 'string') {
		const s = value.trim();
		if (s === '') return null;
		if (s.startsWith('[') || s.startsWith('{')) {
			try {
				return resolveAttachmentUrl(JSON.parse(s), baseUrl);
			} catch {
				// not JSON, treat as a bare URL
			}
		}
		return joinBase(s, baseUrl);
	}

	if (Array.isArray(value)) {
		for (const el of value) {
			const u = resolveAttachmentUrl(el, baseUrl);
			if (u) return u;
		}
		return null;
	}

	if (typeof value === 'object') {
		const o = value as Record<string, any>;
		const candidate = o.signedUrl ?? o.signedPath ?? o.url ?? o.path ?? null;
		if (typeof candidate === 'string' && candidate.trim() !== '') {
			return joinBase(candidate.trim(), baseUrl);
		}
	}

	return null;
};

const hasValue = (value: unknown): boolean => {
	if (value == null) return false;
	if (typeof value === 'string') return value.trim() !== '';
	if (Array.isArray(value)) return value.length > 0;
	return true;
};

const CONTENT_TYPE_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'application/pdf': 'pdf',
};

const extFromContentType = (ct: unknown): string | null => {
	if (typeof ct !== 'string' || ct.trim() === '') return null;
	const t = (ct.split(';')[0] ?? '').trim().toLowerCase();
	return CONTENT_TYPE_EXT[t] ?? null;
};

const extFromUrl = (url: string): string | null => {
	const clean = (url.split('?')[0] ?? '').split('#')[0] ?? '';
	const m = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
	const ext = m?.[1]?.toLowerCase();
	if (!ext) return null;
	return ext === 'jpeg' ? 'jpg' : ext;
};

export const userAchievementsResource: ResourceHandler = {
	resource: 'userAchievements',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/user_achievements/parameters');

			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const awardTypes = root?.award_types;

			if (Array.isArray(awardTypes)) {
				return awardTypes;
			}
			return [];
		}

		if (operation === 'getById') {
			const userAchievementId = ctx.getNodeParameter('userAchievementId', itemIndex) as number;
			const awardTypeId = ctx.getNodeParameter('awardTypeId', itemIndex) as number;

			return await troopTrackRequest(
				ctx,
				'GET',
				`/v1/user_achievements/${userAchievementId}`,
				{ award_type_id: awardTypeId },
			);
		}

		if (operation === 'markCompleted') {
			const items = _items;
			const userAchievementIdFieldName = ctx.getNodeParameter('user_achievement_id', 0) as string;
			const awardTypeIdFieldName = ctx.getNodeParameter('award_type_id', 0) as string;
			const completedOnFieldName = ctx.getNodeParameter('completed_on', 0) as string;
			const frontFieldName = (ctx.getNodeParameter('blue_card_front_field', 0, '') as string) || '';
			const backFieldName = (ctx.getNodeParameter('blue_card_back_field', 0, '') as string) || '';
			const imagesTypeOverride = (
				(ctx.getNodeParameter('award_card_images_type', 0, '') as string) || ''
			)
				.replace(/^\./, '')
				.trim()
				.toLowerCase();
			const attachmentBaseUrl = (ctx.getNodeParameter('attachment_base_url', 0, '') as string) || '';

			// Fetch an image URL and return its base64 content plus a best-guess extension.
			const fetchImage = async (url: string): Promise<{ base64: string; ext: string | null }> => {
				const options: IHttpRequestOptions = {
					method: 'GET',
					url,
					encoding: 'arraybuffer',
					returnFullResponse: true,
				};
				const resp = (await ctx.helpers.httpRequest(options)) as any;
				const body = resp && typeof resp === 'object' && 'body' in resp ? resp.body : resp;
				const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
				const ext = extFromContentType(resp?.headers?.['content-type']) ?? extFromUrl(url);
				return { base64: buf.toString('base64'), ext };
			};

			// Resolve one mapped image field into { base64, ext } or null, collecting warnings.
			const resolveImage = async (
				fieldName: string,
				row: Record<string, any>,
				label: string,
				warnings: string[],
			): Promise<{ base64: string; ext: string | null } | null> => {
				if (!fieldName) return null;
				const raw = readMapped(row, fieldName);
				if (!hasValue(raw)) return null;
				const url = resolveAttachmentUrl(raw, attachmentBaseUrl);
				if (!url) {
					warnings.push(`Could not resolve a URL for the ${label} image field "${fieldName}"`);
					return null;
				}
				if (!looksAbsoluteUrl(url)) {
					warnings.push(
						`The ${label} image URL is relative ("${url}"). Set "Attachment Base URL" or map a field with an absolute/signed URL.`,
					);
					return null;
				}
				try {
					return await fetchImage(url);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					warnings.push(`Failed to fetch the ${label} image: ${msg}`);
					return null;
				}
			};

			const inputRows = items.map((it) => (it.json ?? {}) as Record<string, any>);
			const outputRows: Array<Record<string, any>> = [];

			for (const row of inputRows) {
				const userAchievementIdValue =
					toScalarFieldValue(readMapped(row, userAchievementIdFieldName)) ?? null;
				const awardTypeIdValue =
					toScalarFieldValue(readMapped(row, awardTypeIdFieldName)) ?? null;
				const completedOnValue =
					toScalarFieldValue(readMapped(row, completedOnFieldName)) ?? null;

				const userAchievementId = normalizeId(userAchievementIdValue);
				const awardTypeId = normalizeId(awardTypeIdValue);
				const completedOn =
					typeof completedOnValue === 'number'
						? String(completedOnValue)
						: typeof completedOnValue === 'string'
							? completedOnValue
							: null;

				const errors: string[] = [];
				if (userAchievementId == null) {
					errors.push(`Invalid ${userAchievementIdFieldName}`);
				}
				if (awardTypeId == null) {
					errors.push(`Invalid ${awardTypeIdFieldName}`);
				}
				if (completedOn == null || completedOn.trim() === '') {
					errors.push(`Invalid ${completedOnFieldName}`);
				}

				if (errors.length > 0) {
					outputRows.push({
						...row,
						achievement_completed: false,
						errors,
					});
					continue;
				}

				const imageWarnings: string[] = [];
				const frontImg = await resolveImage(frontFieldName, row, 'front', imageWarnings);
				const backImg = await resolveImage(backFieldName, row, 'back', imageWarnings);

				const achievement: Record<string, any> = {
					completed_on: completedOn,
					percent_complete: 100,
				};

				if (frontImg || backImg) {
					const imagesType =
						imagesTypeOverride || frontImg?.ext || backImg?.ext || 'jpg';
					achievement.award_card_images_type = imagesType;
					if (frontImg) achievement.award_card_front_image_content = frontImg.base64;
					if (backImg) achievement.award_card_back_image_content = backImg.base64;
				}

				try {
					const response = await troopTrackRequest(
						ctx,
						'POST',
						`/v1/user_achievements/${userAchievementId}`,
						{},
						{
							award_type_id: awardTypeId,
							achievement,
						},
					);

					outputRows.push({
						...row,
						achievement_completed: true,
						blue_card_images: {
							front: !!frontImg,
							back: !!backImg,
							type: achievement.award_card_images_type ?? null,
							warnings: imageWarnings.length ? imageWarnings : undefined,
						},
						response,
					});
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					outputRows.push({
						...row,
						achievement_completed: false,
						blue_card_images: {
							front: !!frontImg,
							back: !!backImg,
							warnings: imageWarnings.length ? imageWarnings : undefined,
						},
						errors: [msg],
					});
				}
			}

			return outputRows;
		}

		throw new Error(`Unsupported userAchievements operation: ${operation} (index ${itemIndex})`);
	},
};
