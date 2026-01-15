import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

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

		throw new Error(`Unsupported userAchievements operation: ${operation} (index ${itemIndex})`);
	},
};
