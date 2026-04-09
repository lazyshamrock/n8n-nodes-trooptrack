import type { ResourceHandler } from './types.js';
import { troopTrackRequest } from '../GenericFunctions.js';

export const awardTypesResource: ResourceHandler = {
	resource: 'awardTypes',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/award_types');

			// Shape: [ { award_types: { "2": {name}, ... } } ]
			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const map = root?.award_types ?? root;

			if (map && typeof map === 'object' && !Array.isArray(map)) {
				return Object.entries(map).map(([id, obj]: [string, any]) => ({
					award_type_id: Number(id),
					...(obj ?? {}),
				}));
			}
			if (Array.isArray(map)) {
				return map;
			}
			return [];
		}

		if (operation === 'getById') {
			const awardTypeId = ctx.getNodeParameter('awardTypeId', itemIndex) as number;

			const resp = await troopTrackRequest(ctx, 'GET', `/v1/award_types/${awardTypeId}`);

			// Shape: [ { award_type: { "2": { award_type_id, name, active_achievements: [...] } } } ]
			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			if (root?.award_type && typeof root.award_type === 'object') root = root.award_type;

			if (root && typeof root === 'object' && root[String(awardTypeId)]) {
				root = root[String(awardTypeId)];
			}

			// Ensure award_type_id exists
			if (root && typeof root === 'object' && root.award_type_id == null) {
				root = { award_type_id: awardTypeId, ...root };
			}

			return root;
		}

		throw new Error(`Unsupported awardTypes operation: ${operation} (index ${itemIndex})`);
	},
};
