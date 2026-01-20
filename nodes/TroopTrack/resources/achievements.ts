import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';
import { TroopTrackPuppeteerSession } from '../puppeteer/PuppeteerSession';
import { startTroopTrackMeritBadges } from '../puppeteer/scrapers/achievements.startMeritBadge';

export const achievementsResource: ResourceHandler = {
	resource: 'achievements',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'startMeritBadge') {
			const items = _items;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number;

			const userIdFieldName = ctx.getNodeParameter('user_id', 0) as string;
			const achievementIdFieldName = ctx.getNodeParameter('achievement_id', 0) as string;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}

			const inputRows = items.map((it) => (it.json ?? {}) as Record<string, any>);

			try {
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;
				const auth = {
					tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
					tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
					tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
				};

				if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
					throw new Error('Missing TroopTrack credentials fields required for web login');
				}

				const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);
				const result = await session.withSession(async (page) => {
					if (delayMs > 0) {
						await new Promise((resolve) => setTimeout(resolve, delayMs));
					}

					return await startTroopTrackMeritBadges(
						page,
						auth.tt_sub_domain,
						inputRows,
						{
							user_id: userIdFieldName,
							achievement_id: achievementIdFieldName,
						},
						{
							delayMs,
							batchSize,
						},
					);
				});

				const resultByIndex = new Map<number, { mb_added: boolean; errors: string[] }>();
				for (const entry of result ?? []) {
					if (typeof entry?.index === 'number') {
						resultByIndex.set(entry.index, {
							mb_added: Boolean(entry?.mb_added),
							errors: Array.isArray(entry?.errors) ? entry.errors : ['Unknown error'],
						});
					}
				}

				return inputRows.map((row, idx) => {
					const entry = resultByIndex.get(idx);
					return {
						...row,
						mb_added: entry ? entry.mb_added : false,
						errors: entry ? entry.errors : ['No result returned for item'],
					};
				});
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return inputRows.map((row) => ({
					...row,
					mb_added: false,
					errors: [msg],
				}));
			}
		}

		if (operation === 'getMany') {
			const awardTypeId = ctx.getNodeParameter('awardTypeId', 0) as number;

			const resp = await troopTrackRequest(ctx, 'GET', '/v1/user_achievements/parameters');

			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const awardTypes = Array.isArray(root?.award_types) ? root.award_types : [];
			const selected = awardTypes.find((at: any) => Number(at?.id) === Number(awardTypeId));

			const achievements = Array.isArray(selected?.achievements) ? selected.achievements : [];

			// Return a bare array, consistent with your Users and Events behavior
			return achievements.map((a: any) => ({
				achievement_id: a?.id,
				name: a?.name,
			}));
		}

		if (operation === 'getById') {
			const achievementId = ctx.getNodeParameter('achievementId', itemIndex) as number;
			const awardTypeId = ctx.getNodeParameter('awardTypeId', itemIndex) as number;

			const resp = await troopTrackRequest(
				ctx,
				'GET',
				`/v1/achievements/${achievementId}`,
				{ award_type_id: awardTypeId },
			);

			// Normalize "children" maps -> arrays recursively
			const normalizeChildren = (node: any): any => {
				if (!node || typeof node !== 'object') return node;

				const out: any = { ...node };

				if (out.children && typeof out.children === 'object') {
					if (Array.isArray(out.children)) {
						out.children = out.children.map((c: any) => normalizeChildren(c));
					} else {
						out.children = Object.values(out.children).map((c: any) => normalizeChildren(c));
					}
				}

				return out;
			};

			let root: any = resp;

			// If array wrapper, unwrap first element
			if (Array.isArray(root) && root.length === 1) {
				root = root[0];
			}

			// If TroopTrack wraps under "achievement", unwrap it
			// Preserve a top-level achievement_id if present
			const topAchievementId =
				root && typeof root === 'object' && root.achievement_id != null ? root.achievement_id : achievementId;

			if (root && typeof root === 'object' && root.achievement && typeof root.achievement === 'object') {
				root = root.achievement;
			}

			// If keyed by the ID string, unwrap that key
			if (root && typeof root === 'object' && root[String(achievementId)] && typeof root[String(achievementId)] === 'object') {
				root = root[String(achievementId)];
			}

			// At this point, root should be the AchievementEntity object
			// Inject achievement_id if missing
			if (root && typeof root === 'object' && root.achievement_id == null) {
				root = { achievement_id: topAchievementId, ...root };
			}

			return normalizeChildren(root);
		}

		throw new Error(`Unsupported achievements operation: ${operation} (index ${itemIndex})`);
	},
};
