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
				name: 'Get All Mailing Lists',
				value: 'getMany_mailing',
				description: 'GET /v1/mailing_lists',
				action: 'Get all mailing lists',
			},
			{
				name: 'Get All Unit Photo Albums',
				value: 'getMany_albums',
				description: 'GET /v1/photo_albums',
				action: 'Get all unit photo albums',
			},
			{
				name: 'Get Photo Album by ID',
				value: 'getById',
				description: 'GET /v1/photo_albums/{ID}',
				action: 'Get photo album by id',
			},
		],
		default: 'getMany_mailing',
	},
];

export const mailingListsFields: INodeProperties[] = [];
