import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

export const mailingListsResource: ResourceHandler = {
	resource: 'mailingLists',
	runOnceOperations: new Set([
		'getMany_mailing',
		'getMany_albums',
	]),
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany' || operation === 'getMany_mailing') {
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

		if (operation === 'getMany_albums') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/photo_albums');

			// Shape: [ { photo_albums: [ ... ] } ]
			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const albums = root?.photo_albums;

			if (Array.isArray(albums)) {
				return albums;
			}
			if (Array.isArray(root)) {
				// Fallback: API returned array directly
				return root;
			}
			return [];
		}

		if (operation === 'getById') {
			const photoAlbumId = ctx.getNodeParameter('photoAlbumId', itemIndex) as number;

			const resp = await troopTrackRequest(ctx, 'GET', `/v1/photo_albums/${photoAlbumId}`);

			// Shape: [ { ...album... } ]
			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			// Ensure id exists even if API omits it (it currently includes it, but be safe)
			if (root && typeof root === 'object' && root.photo_album_id == null) {
				root = { photo_album_id: photoAlbumId, ...root };
			}

			return root;
		}

		throw new Error(`Unsupported mailingLists operation: ${operation} (index ${itemIndex})`);
	},
};
