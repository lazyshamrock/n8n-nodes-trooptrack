import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

export const mailingListsResource: ResourceHandler = {
	resource: 'mailingLists',
	runOnceOperations: new Set([
		'getMany_mailing',
		'getMany_albums',
	]),
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/mailing_lists');

			// Shape: [ { mailing_lists: [ ... ] } ]
			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const lists = root?.mailing_lists;

			if (Array.isArray(lists)) {
				return lists;
			}
			if (Array.isArray(root)) {
				// Fallback: API returned array directly
				return root;
			}
			return [];
		}

		throw new Error(`Unsupported mailingLists operation: ${operation} (index ${itemIndex})`);
	},
};
