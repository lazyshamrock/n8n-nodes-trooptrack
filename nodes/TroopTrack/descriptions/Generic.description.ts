import type { INodeProperties } from 'n8n-workflow';

export const genericOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['generic'] } },
		options: [{ name: 'Request', value: 'request', action: 'Request a generic',}],
		default: 'request',
	},
];

export const genericFields: INodeProperties[] = [
	{
		displayName: 'Method',
		name: 'method',
		type: 'options',
		displayOptions: { show: { resource: ['generic'], operation: ['request'] } },
		options: [
			{ name: 'GET', value: 'GET' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
			{ name: 'PATCH', value: 'PATCH' },
			{ name: 'DELETE', value: 'DELETE' },
		],
		default: 'GET',
	},
	{
		displayName: 'Endpoint',
		name: 'endpoint',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['generic'], operation: ['request'] } },
		default: '/v1/users',
		description: 'Path starting with /v1. Example: /v1/events or /v1/users/123.',
	},
	{
		displayName: 'Query Params',
		name: 'qs',
		type: 'json',
		displayOptions: { show: { resource: ['generic'], operation: ['request'] } },
		default: '{}',
		description: 'JSON object of query string params',
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'json',
		displayOptions: { show: { resource: ['generic'], operation: ['request'] } },
		default: '{}',
		description: 'JSON body for POST, PUT, PATCH',
	},
];
