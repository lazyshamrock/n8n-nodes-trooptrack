import type { ResourceHandler } from './types';
import { achievementsResource } from './achievements';
import { awardTypesResource } from './awardTypes';
import { userAchievementsResource } from './userAchievements';

export const achievementsCategoryResource: ResourceHandler = {
	resource: 'achievementsCategory',
	runOnceOperations: new Set(['startMeritBadge', 'getSelectableMeritBadges', 'printMeritBadgeBlueCards']),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'achievementsGetMany') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'getMany');
		}
		if (operation === 'achievementsGetById') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'getById');
		}
		if (operation === 'startMeritBadge') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'startMeritBadge');
		}
		if (operation === 'getSelectableMeritBadges') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'getSelectableMeritBadges');
		}
		if (operation === 'printMeritBadgeBlueCards') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'printMeritBadgeBlueCards');
		}
		if (operation === 'awardTypesGetMany') {
			return await awardTypesResource.execute(ctx, items, itemIndex, 'getMany');
		}
		if (operation === 'awardTypesGetById') {
			return await awardTypesResource.execute(ctx, items, itemIndex, 'getById');
		}
		if (operation === 'userAchievementsGetMany') {
			return await userAchievementsResource.execute(ctx, items, itemIndex, 'getMany');
		}
		if (operation === 'userAchievementsGetById') {
			return await userAchievementsResource.execute(ctx, items, itemIndex, 'getById');
		}

		throw new Error(`Unsupported achievements category operation: ${operation} (index ${itemIndex})`);
	},
};
