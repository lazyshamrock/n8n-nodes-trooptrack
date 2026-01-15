import type { ResourceHandler } from './types';
import type { IHttpRequestMethods } from 'n8n-workflow';
import { troopTrackRequest } from '../GenericFunctions';

export const genericResource: ResourceHandler = {
	resource: 'generic',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'request') {
			const method = ctx.getNodeParameter('method', itemIndex) as IHttpRequestMethods;
			const endpoint = ctx.getNodeParameter('endpoint', itemIndex) as string;
			const qs = ctx.getNodeParameter('qs', itemIndex) as Record<string, any>;
			const body = ctx.getNodeParameter('body', itemIndex) as any;

			const sendBody = method === 'GET' || method === 'DELETE' ? undefined : body;

			return await troopTrackRequest(ctx, method, endpoint, qs, sendBody);
		}

		throw new Error(`Unsupported generic operation: ${operation} (index ${itemIndex})`);
	},
};
