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
				action: 'Get all available troop track achievements',
			},
			{
				name: 'Achievements: Get By ID',
				value: 'achievementsGetById',
				description: 'GET /v1/achievements/{ID} (requires award_type_id)',
				action: 'Get a troop track achievement by id',
			},
			{
				name: 'Merit Badges: Start',
				value: 'startMeritBadge',
				description: 'Start a merit badge for each user_id/achievement_id pair (web UI)',
				action: 'Start merit badge',
			},
			{
				name: 'Merit Badges: Get Selectable in TroopTrack',
				value: 'getSelectableMeritBadges',
				description: 'Scrape the TroopTrack UI to list merit badges available to start (web UI)',
				action: 'Get selectable merit badges',
			},
			{
				name: 'Merit Badges: Print Blue Cards',
				value: 'printMeritBadgeBlueCards',
				description: 'Print and sign merit badge blue cards (web UI)',
				action: 'Print merit badge blue cards',
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
				operation: ['startMeritBadge'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack user_id. You can drag a field from the input sidebar. Only the field name will be used.',
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
				operation: ['startMeritBadge'],
			},
		},
		description: 'Name of the input field containing the target TroopTrack achievement_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},
	{
		displayName: 'User ID Field',
		name: 'userIdField',
		type: 'string',
		required: true,
		default: 'user_id',
		description: 'Field on each input item that contains the TroopTrack user_id',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['printMeritBadgeBlueCards'],
			},
		},
	},
	{
		displayName: 'Achievement ID Field',
		name: 'achievementIdField',
		type: 'string',
		required: true,
		default: 'achievement_id',
		description: 'Field on each input item that contains the TroopTrack achievement_id',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['printMeritBadgeBlueCards'],
			},
		},
	},
	{
		displayName: 'Counselor ID Field',
		name: 'counselorIdField',
		type: 'string',
		required: false,
		default: 'counselor_id',
		description: 'Optional field containing the TroopTrack counselor_id',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['printMeritBadgeBlueCards'],
			},
		},
	},
	{
		displayName: 'Comments Field',
		name: 'commentsField',
		type: 'string',
		required: false,
		default: 'blue_card_remarks',
		description: 'Optional field containing blue card remarks text',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['printMeritBadgeBlueCards'],
			},
		},
	},
	{
		displayName: 'Signature Binary Field',
		name: 'signatureBinaryField',
		type: 'string',
		required: false,
		default: 'signature',
		description: 'Binary field containing the signature image. If empty or missing, signing is skipped.',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['printMeritBadgeBlueCards'],
			},
		},
	},
	{
		displayName: 'Demo Scout ID',
		name: 'demoScoutId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['getSelectableMeritBadges'],
			},
		},
		description: 'TroopTrack user ID to use when opening the Start Merit Badge dialog',
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
				operation: ['startMeritBadge', 'getSelectableMeritBadges', 'printMeritBadgeBlueCards'],
			},
		},
	},
	{
		displayName: 'Debug Mode',
		name: 'debugMode',
		type: 'boolean',
		default: false,
		description:
			'When enabled, the node will throw errors and include debug details to help troubleshoot Puppeteer',
		displayOptions: {
			show: {
				resource: ['achievementsCategory'],
				operation: ['getSelectableMeritBadges', 'printMeritBadgeBlueCards'],
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
				operation: ['startMeritBadge', 'getSelectableMeritBadges', 'printMeritBadgeBlueCards'],
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
				operation: ['startMeritBadge', 'getSelectableMeritBadges', 'printMeritBadgeBlueCards'],
			},
		},
	},
];
