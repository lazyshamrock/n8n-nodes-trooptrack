import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

export const patrolsResource: ResourceHandler = {
	resource: 'patrols',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/events/types');

			// Handle both shapes:
			// 1) { event_types: [...], patrols: [...], users: [...] }
			// 2) [ { event_types: [...], patrols: [...], users: [...] } ]
			const wrapper = Array.isArray(resp) ? resp[0] : resp;

			if (Array.isArray(wrapper?.patrols)) {
				return wrapper.patrols;
			}
			if (Array.isArray((resp as any)?.patrols)) {
				return (resp as any).patrols;
			}
			return [];
		}

		throw new Error(`Unsupported patrols operation: ${operation} (index ${itemIndex})`);
	},
};
