import type { INodeProperties } from 'n8n-workflow';

export const mailingListsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['mailingLists'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'GET /v1/mailing_lists',
			},
		],
		default: 'getMany',
	},
];

export const mailingListsFields: INodeProperties[] = [];
