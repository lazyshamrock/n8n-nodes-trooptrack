import type { ResourceHandler } from './types.js';
import { achievementsResource } from './achievements.js';
import { awardTypesResource } from './awardTypes.js';
import { userAchievementsResource } from './userAchievements.js';

export const achievementsCategoryResource: ResourceHandler = {
	resource: 'achievementsCategory',
	runOnceOperations: new Set(['achievementsStartOther']),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'achievementsStartOther') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'startOtherAchievement');
		}
		if (operation === 'achievementsGetMany') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'getMany');
		}
		if (operation === 'achievementsGetById') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'getById');
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
		if (operation === 'userAchievementMarkCompleted') {
			return await userAchievementsResource.execute(ctx, items, itemIndex, 'markCompleted');
		}

		throw new Error(`Unsupported achievements category operation: ${operation} (index ${itemIndex})`);
	},
};
