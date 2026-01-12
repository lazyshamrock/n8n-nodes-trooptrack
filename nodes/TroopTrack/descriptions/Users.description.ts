import type { INodeProperties } from 'n8n-workflow';

export const usersOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['users'] } },
		options: [
			{ name: 'Get Many', value: 'getMany', description: 'GET /v1/users' ,action: 'Get All TroopTrack Users in Unit'},
			{ name: 'Get Many (Simple)', value: 'getManySimple', description: 'GET /v1/events/types (users)', action: 'Get many TroopTrack users (simple)' },
			{ name: 'Get By Id', value: 'getById', description: 'GET /v1/users/{id}' , action: 'Get a TroopTrack User by ID'},
		],
		default: 'getMany',
	},
];

export const usersFields: INodeProperties[] = [
	{
		displayName: 'User Id',
		name: 'userId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['users'], operation: ['getById', 'update'] } },
		default: 0,
	},
	{
		displayName: 'Update Body',
		name: 'updateBody',
		type: 'json',
		required: true,
		displayOptions: { show: { resource: ['users'], operation: ['update'] } },
		default: '{}',
		description: 'JSON body matching postV1UsersId in TroopTrack Swagger',
	},
];