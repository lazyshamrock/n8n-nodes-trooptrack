import type { INodeProperties } from 'n8n-workflow';

export const achievementsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['achievements'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'GET /v1/achievements',
				action: 'Get All available TroopTrack Achievements',
			},
			{
				name: 'Get By Id',
				value: 'getById',
				description: 'GET /v1/achievements/{id} (requires award_type_id)',
				action: 'Get a TroopTrack Achievement by ID',
			},
		],
		default: 'getMany',
	},
];

export const achievementsFields: INodeProperties[] = [
	{
		displayName: 'Achievement Id',
		name: 'achievementId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['achievements'], operation: ['getById'] } },
		default: 0,
	},
	{
		displayName: 'Award Type Id',
		name: 'awardTypeId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['achievements'], operation: ['getById'] } },
		default: 0,
		description: 'Required by TroopTrack for /v1/achievements/{id}',
	},
	{
		displayName: 'Award Type',
		name: 'awardTypeId',
		type: 'options',
		required: true,
		default: 999999999,
		description: 'Select the award type to return its achievements list',
		typeOptions: {
			loadOptionsMethod: 'getAwardTypes',
		},
		displayOptions: {
			show: {
				resource: ['achievements'],
				operation: ['getMany'],
			},
		},
	},

];
