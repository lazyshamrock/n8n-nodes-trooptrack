import type { ResourceHandler } from './types.js';
import { achievementsResource } from './achievements.js';

export const meritBadgesResource: ResourceHandler = {
	resource: 'meritBadges',
	runOnceOperations: new Set(['startMeritBadge', 'getSelectableMeritBadges', 'printMeritBadgeBlueCards']),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'startMeritBadge') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'startMeritBadge');
		}
		if (operation === 'getSelectableMeritBadges') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'getSelectableMeritBadges');
		}
		if (operation === 'printMeritBadgeBlueCards') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'printMeritBadgeBlueCards');
		}

		throw new Error(`Unsupported merit badge operation: ${operation} (index ${itemIndex})`);
	},
};
