import type { INodeProperties } from 'n8n-workflow';

export const meritBadgeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['meritBadges'] } },
		options: [
			{
				name: 'Merit Badge: Start',
				value: 'startMeritBadge',
				description: 'Start a merit badge for each user_id/achievement_id pair (web UI)',
				action: 'Merit Badge: Start merit badge 🌐',
			},
			{
				name: 'Merit Badge: Get Selectable in TroopTrack',
				value: 'getSelectableMeritBadges',
				description: 'Scrape the TroopTrack UI to list merit badges available to start (web UI)',
				action: 'Merit Badge: Get selectable merit badges 🌐',
			},
			{
				name: 'Merit Badge: Print Blue Cards',
				value: 'printMeritBadgeBlueCards',
				description: 'Print and sign merit badge blue cards (web UI)',
				action: 'Merit Badge: Print merit badge blue cards 🌐',
			},
		],
		default: 'startMeritBadge',
	},
];

export const meritBadgeFields: INodeProperties[] = [
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
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
				resource: ['meritBadges'],
				operation: ['startMeritBadge', 'getSelectableMeritBadges', 'printMeritBadgeBlueCards'],
			},
		},
	},
];
