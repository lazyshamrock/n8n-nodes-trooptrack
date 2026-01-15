import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

export const achievementsResource: ResourceHandler = {
	resource: 'achievements',
	async execute(ctx, _items, itemIndex, operation) {
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
