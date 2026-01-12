import type { INodeProperties } from 'n8n-workflow';

export const awardTypesOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['awardTypes'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'GET /v1/award_types',
			},
			{
				name: 'Get By Id',
				value: 'getById',
				description: 'GET /v1/award_types/{id}',
			},
		],
		default: 'getMany',
	},
];

export const awardTypesFields: INodeProperties[] = [
	{
		displayName: 'Award Type Id',
		name: 'awardTypeId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['awardTypes'], operation: ['getById'] } },
		default: 0,
	},
];
