import type { ResourceHandler } from './types.js';
import { troopTrackRequest } from '../GenericFunctions.js';

export const tokensResource: ResourceHandler = {
	resource: 'tokens',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getPrivileges') {
			return await troopTrackRequest(ctx, 'GET', '/v1/tokens');
		}

		if (operation === 'getMyBasicInfo') {
			return await troopTrackRequest(ctx, 'GET', '/v1/tokens/my_basic_info');
		}

		throw new Error(`Unsupported tokens operation: ${operation} (index ${itemIndex})`);
	},
};
