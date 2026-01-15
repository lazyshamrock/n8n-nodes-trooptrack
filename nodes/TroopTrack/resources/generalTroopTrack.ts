import type { ResourceHandler } from './types';
import { tokensResource } from './tokens';
import { permissionsResource } from './permissions';
import { positionsResource } from './positions';
import { patrolsResource } from './patrols';

export const generalTroopTrackResource: ResourceHandler = {
	resource: 'generalTroopTrack',
	runOnceOperations: new Set([
		'permissionsGetMany',
		'positionsGetMany',
	]),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'tokensGetPrivileges') {
			return await tokensResource.execute(ctx, items, itemIndex, 'getPrivileges');
		}
		if (operation === 'tokensGetMyBasicInfo') {
			return await tokensResource.execute(ctx, items, itemIndex, 'getMyBasicInfo');
		}
		if (operation === 'permissionsGetMany') {
			return await permissionsResource.execute(ctx, items, itemIndex, 'getMany');
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
