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
				description: 'GET /v1/user_achievement/{id}',
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
];