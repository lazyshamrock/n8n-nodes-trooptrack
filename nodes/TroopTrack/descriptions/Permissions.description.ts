import type { INodeProperties } from 'n8n-workflow';

export const permissionsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['permissions'],
			},
		},
		options: [
			{
				name: 'Get TroopTrack Permissions',
				value: 'getMany',
				description: 'Scrape TroopTrack permission list (Privileges tab) from the web UI',
				action: 'Get TroopTrack permissions',
			},
			{
				name: 'Set Permissions',
				value: 'setPermissions',
				description: 'Update TroopTrack user permissions (Privileges tab) via the web UI',
				action: 'Set permissions',
			},
		],
		default: 'getMany',
	},
];

export const permissionsFields: INodeProperties[] = [
	{
		displayName: 'Demo Adult User ID',
		name: 'demoAdultUserId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany'],
			},
		},
		description:
			'An Adult user ID used only to open the Privileges tab and read the available permissions',
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
				resource: ['permissions'],
				operation: ['setPermissions'],
			},
		},
		description:
			'Name of the input field containing the target TroopTrack user_id. You can drag a field from the input sidebar. Only the field name will be used.',
	},

	{
		displayName: 'Access Level Field',
		name: 'access_level',
		type: 'string',
		required: true,
		default: 'access_level',
		placeholder: 'access_level',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['setPermissions'],
			},
		},
		description:
			'Name of the input field containing the access_level to set. You can drag a field from the input sidebar. Only the field name will be used.',
	},

	{
		displayName: 'Granted Permissions Field',
		name: 'granted_permissions',
		type: 'string',
		required: true,
		default: 'granted_permissions',
		placeholder: 'granted_permissions',
		typeOptions: {
			requiresDataPath: true,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['setPermissions'],
			},
		},
		description:
			'Name of the input field containing an array of permission IDs (numbers) to grant. You can drag a field from the input sidebar. Only the field name will be used.',
	},

	{
		displayName: 'Browserless WebSocket Endpoint',
		name: 'browserlessWsEndpoint',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'ws://browserless:3000?token=YOUR_TOKEN',
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany', 'setPermissions'],
			},
		},
		description: 'Full Browserless WebSocket endpoint including token query parameter',
	},

	{
		displayName: 'Debug Mode',
		name: 'debugMode',
		type: 'boolean',
		required: true,
		default: false,
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany', 'setPermissions'],
			},
		},
		description: 'When enabled, the node will throw errors and include debug details for Puppeteer',
	},

	{
		displayName: 'Delay (ms)',
		name: 'delayMs',
		type: 'number',
		required: true,
		default: 300,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany', 'setPermissions'],
			},
		},
		description: 'Delay between page loads to reduce flakiness and avoid hammering TroopTrack',
	},

	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		required: true,
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany', 'setPermissions'],
			},
		},
		description: 'Optional. Process work in chunks. 0 means no batching.',
	},
];