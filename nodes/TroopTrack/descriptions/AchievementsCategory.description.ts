/* eslint-disable n8n-nodes-base/node-param-description-miscased-id */
/* eslint-disable n8n-nodes-base/node-param-options-type-unsorted-items */
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
				action: 'Achievements: Get all available TroopTrack achievements',
			},
			{
				name: 'Achievements: Get By ID',
				value: 'achievementsGetById',
				description: 'GET /v1/achievements/{ID} (requires award_type_id)',
				action: 'Achievements: Get a TroopTrack achievement by ID',
			},
			{
				name: 'Achievements: Start Other Achievement 🌐',
				value: 'achievementsStartOther',
				description: 'Updates TroopTrack via the web UI to indicate that members have started an OTHER achievement',
				action: 'Achievements: Start Other Achievement (Non Rank / Merit Badge) 🌐',
			},
			{
				name: 'Award Types: Get Many',
				value: 'awardTypesGetMany',
				description: 'GET /v1/award_types',
				action: 'Award Types: Get all TroopTrack Award Types',
			},
			{
				name: 'Award Types: Get By ID',
				value: 'awardTypesGetById',
				description: 'GET /v1/award_types/{ID}',
				action: 'Award Types: Get all awards associated with an award type ID',
			},
			{
				name: 'User Achievements: Get Many',
				value: 'userAchievementsGetMany',
				description: 'GET /v1/user_achievements/parameters',
				action: 'User Achievements: Get all user achievements',
			},
			{
				name: 'User Achievements: Get By ID',
				value: 'userAchievementsGetById',
				description: 'GET /v1/user_achievements/{ID}',
				action: 'User Achievements: Get a user achievement by id',
			},
			{
				name: 'User Achievement: Mark Completed',
				value: 'userAchievementMarkCompleted',
				description: 'POST /v1/user_achievements/{ID}',
				action: 'User Achievement: Mark a user achievement completed',
			},
		],
		default: 'achievementsGetMany',
	},
];

export const achievementsCategoryFields: INodeProperties[] = [
	{
		displayName: 'User ID Field',
		name: 'user_id',
		type: 'string',
		required: true,
		default: 'user_id',
		placeholder: 'user_id',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsStartOther'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack user_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},
	{
		displayName: 'Award Type ID Field',
		name: 'award_type_id',
		type: 'string',
		required: true,
		default: 'award_type_id',
		placeholder: 'award_type_id',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsStartOther'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack award_type_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},
	{
		displayName: 'Achievement ID Field',
		name: 'achievement_id',
		type: 'string',
		required: true,
		default: 'achievement_id',
		placeholder: 'achievement_id',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsStartOther'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack achievement_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},
	{
		displayName: 'Browserless WebSocket Endpoint',
		name: 'browserlessWsEndpoint',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'ws://browserless:3000?token=YOUR_TOKEN',
		description: 'Full Browserless WebSocket endpoint including token query parameter',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsStartOther'],
			},
		},
	},
	{
		displayName: 'Delay (Ms)',
		name: 'delayMs',
		type: 'number',
		default: 300,
		description: 'Delay between page loads to reduce flakiness and avoid hammering TroopTrack',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsStartOther'],
			},
		},
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		default: 0,
		description: 'Optional. Process items in chunks. 0 means no batching. Useful to reduce long-running sessions.',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['achievementsStartOther'],
			},
		},
	},
	{
		displayName: 'User Achievement ID Field',
		name: 'user_achievement_id',
		type: 'string',
		required: true,
		default: 'user_achievement_id',
		placeholder: 'user_achievement_id',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['userAchievementMarkCompleted'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack user_achievement_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},
	{
		displayName: 'Award Type ID Field',
		name: 'award_type_id',
		type: 'string',
		required: true,
		default: 'award_type_id',
		placeholder: 'award_type_id',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['userAchievementMarkCompleted'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack award_type_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},
	{
		displayName: 'Completed On Field',
		name: 'completed_on',
		type: 'string',
		required: true,
		default: 'completed_on',
		placeholder: 'completed_on',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['userAchievementMarkCompleted'],
			},
		},
		description: 'Name of the input field containing the completion date to send to TroopTrack. You can drag a field from the input sidebar. Only the field name will be used.',
	},
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
	}
];
