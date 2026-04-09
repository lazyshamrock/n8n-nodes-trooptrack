import type { ResourceHandler } from './types.js';
import { tokensResource } from './tokens.js';
import { positionsResource } from './positions.js';
import { patrolsResource } from './patrols.js';

export const generalTroopTrackResource: ResourceHandler = {
	resource: 'generalTroopTrack',
	runOnceOperations: new Set(['positionsGetMany']),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'tokensGetPrivileges') {
			return await tokensResource.execute(ctx, items, itemIndex, 'getPrivileges');
		}
		if (operation === 'tokensGetMyBasicInfo') {
			return await tokensResource.execute(ctx, items, itemIndex, 'getMyBasicInfo');
		}
		if (operation === 'positionsGetMany') {
			return await positionsResource.execute(ctx, items, itemIndex, 'getMany');
		}
		if (operation === 'patrolsGetMany') {
			return await patrolsResource.execute(ctx, items, itemIndex, 'getMany');
		}

		throw new Error(`Unsupported general TroopTrack operation: ${operation} (index ${itemIndex})`);
	},
};
