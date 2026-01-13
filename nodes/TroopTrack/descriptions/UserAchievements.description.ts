import type { INodeProperties } from 'n8n-workflow';

export const userAchievementsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['userAchievements'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'GET /v1/user_achievements/parameters',
			},
			{
				name: 'Get By ID',
				value: 'getById',
				description: 'GET /v1/user_achievements/{id}',
			},
		],
		default: 'getMany',
	},
];

export const userAchievementsFields: INodeProperties[] = [
	{
		displayName: 'User Achievement ID',
		name: 'userAchievementId',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['userAchievements'],
				operation: ['getById'],
			},
		},
		description: 'The ID used in GET /v1/user_achievement/{id}',
	},
	// Award Type for Get Many
	{
		displayName: 'Award Type',
		name: 'awardTypeId',
		type: 'options',
		required: true,
		default: 999999998,
		description: 'The Award Type associated with the User Achievement',
		typeOptions: {
			loadOptionsMethod: 'getAwardTypes',
		},
		displayOptions: {
			show: {
				resource: ['userAchievements'],
				operation: ['getMany', 'getById'],
			},
		},
	},
];