import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

export const eventsResource: ResourceHandler = {
	resource: 'events',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const startOn = ctx.getNodeParameter('startOn', itemIndex) as string;
			const endOn = ctx.getNodeParameter('endOn', itemIndex) as string;

			const resp = await troopTrackRequest(ctx, 'GET', '/v1/events', {
				start_on: startOn,
				end_on: endOn,
			});

			// TroopTrack returns { events: [...] }
			return Array.isArray(resp?.events) ? resp.events : [];
		}

		if (operation === 'getById') {
			const eventId = ctx.getNodeParameter('eventId', itemIndex) as number;
			const resp = await troopTrackRequest(ctx, 'GET', `/v1/events/${eventId}`);

			// Some APIs return { event: {...} }, others return the object directly.
			return resp;
		}

		if (operation === 'create') {
			const createBody = ctx.getNodeParameter('createBody', itemIndex) as object;
			const resp = await troopTrackRequest(ctx, 'POST', '/v1/events', {}, createBody);

			return resp?.event ?? resp;
		}

		if (operation === 'getTypes') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/events/types');

			// Prefer the common wrapper shape; fall back to resp if it is already an array.
			if (Array.isArray(resp?.event_types)) {
				return resp.event_types;
			}
			if (Array.isArray(resp?.types)) {
				return resp.types;
			}
			if (Array.isArray(resp)) {
				return resp;
			}
			return [];
		}

		throw new Error(`Unsupported events operation: ${operation} (index ${itemIndex})`);
	},
};
