import type { INodeProperties } from 'n8n-workflow';

export const achievementsCategoryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['achievementsCategory'] } },
		options: [
			{
				name: 'Achievements: Get Many',
				value: 'achievementsGetMany',
				description: 'GET /v1/achievements',
				action: 'Get all available TroopTrack achievements',
			},
			{
				name: 'Achievements: Get By ID',
				value: 'achievementsGetById',
				description: 'GET /v1/achievements/{ID} (requires award_type_id)',
				action: 'Get a TroopTrack achievement by id',
			},
			{
				name: 'Award Types: Get Many',
				value: 'awardTypesGetMany',
				description: 'GET /v1/award_types',
				action: 'Get many award types',
			},
			{
				name: 'Award Types: Get By ID',
				value: 'awardTypesGetById',
				description: 'GET /v1/award_types/{ID}',
				action: 'Get an award type by id',
			},
			{
				name: 'User Achievements: Get Many',
				value: 'userAchievementsGetMany',
				description: 'GET /v1/user_achievements/parameters',
				action: 'Get many user achievements',
			},
			{
				name: 'User Achievements: Get By ID',
				value: 'userAchievementsGetById',
				description: 'GET /v1/user_achievements/{ID}',
				action: 'Get a user achievement by id',
			},
		],
		default: 'achievementsGetMany',
	},
];

export const achievementsCategoryFields: INodeProperties[] = [
	{
		displayName: 'Achievement ID',
		name: 'achievementId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsGetById'],
			},
		},
		default: 0,
	},
	{
		displayName: 'Award Type Name or ID',
		name: 'awardTypeId',
		type: 'options',
		required: true,
		default: 999999998,
		description: 'Select the award type to return its achievements list. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsMethod: 'getAwardTypes',
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsGetMany', 'achievementsGetById'],
			},
		},
	},
	{
		displayName: 'Award Type Name or ID',
		name: 'awardTypeId',
		type: 'options',
		required: true,
		default: 999999998,
		description: 'Required by TroopTrack for GET /v1/achievements/{ID}. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsMethod: 'getAwardTypes',
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsGetById'],
			},
		},
	},
	{
		displayName: 'Award Type ID',
		name: 'awardTypeId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['awardTypesGetById'],
			},
		},
		default: 0,
	},
	{
		displayName: 'User Achievement ID',
		name: 'userAchievementId',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['userAchievementsGetById'],
			},
		},
		description: 'The ID used in GET /v1/user_achievement/{id}',
	},
	{
		displayName: 'Award Type Name or ID',
		name: 'awardTypeId',
		type: 'options',
		required: true,
		default: 999999998,
		description: 'The Award Type associated with the User Achievement. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		typeOptions: {
			loadOptionsMethod: 'getAwardTypes',
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['userAchievementsGetMany', 'userAchievementsGetById'],
			},
		},
	},
];
