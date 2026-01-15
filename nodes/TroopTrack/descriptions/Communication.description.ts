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
				name: 'Get all Mailing Lists',
				value: 'getMany_mailing',
				description: 'GET /v1/mailing_lists',
				action: 'Get all Mailing Lists',
			},
			{
				name: 'Get all Unit Photo Albums',
				value: 'getMany_albums',
				description: 'GET /v1/photo_albums',
				action: 'Get all Unit Photo Albums',
			},
			{
				name: 'Get Photo Album by ID',
				value: 'getById',
				description: 'GET /v1/photo_albums/{ID}',
				action: 'Get Photo Album by ID',
			},
		],
		default: 'getMany',
	},
];

export const mailingListsFields: INodeProperties[] = [];
