import type { INodeProperties } from 'n8n-workflow';

export const eventsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['events'] } },
		options: [
			{ name: 'Get Many', value: 'getMany', description: 'GET /v1/events', action: 'Get many an events',},
			{ name: 'Get By ID', value: 'getById', description: 'GET /v1/events/{ID}', action: 'Get by id an events',},
			{ name: 'Create', value: 'create', description: 'POST /v1/events', action: 'Create an events',},
			{ name: 'Get Types', value: 'getTypes', description: 'GET /v1/events/types', action: 'Get types an events',},
		],
		default: 'getMany',
	},
];

export const eventsFields: INodeProperties[] = [
	{
		displayName: 'Start On',
		name: 'startOn',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['events'], operation: ['getMany'] } },
		default: '',
		placeholder: '2026-01-01',
		description: 'ISO date (YYYY-MM-DD)',
	},
	{
		displayName: 'End On',
		name: 'endOn',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['events'], operation: ['getMany'] } },
		default: '',
		placeholder: '2026-01-31',
		description: 'ISO date (YYYY-MM-DD)',
	},
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['events'], operation: ['getById'] } },
		default: 0,
	},
	{
		displayName: 'Create Body',
		name: 'createBody',
		type: 'json',
		required: true,
		displayOptions: { show: { resource: ['events'], operation: ['create'] } },
		default: '{}',
		description: 'JSON body matching postV1Events in TroopTrack Swagger',
	},
];
