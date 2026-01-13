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
		displayName: 'Browserless WebSocket Endpoint',
		name: 'browserlessWsEndpoint',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'ws://browserless:3000?token=YOUR_TOKEN',
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany'],
			},
		},
		description: 'Full Browserless WebSocket endpoint including token query parameter',
	},

	{
		displayName: 'Debug Mode',
		name: 'debugMode',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany'],
			},
		},
		description: 'When enabled, the node will throw errors and include debug details for Puppeteer',
	},

	{
		displayName: 'Delay (ms)',
		name: 'delayMs',
		type: 'number',
		default: 300,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany'],
			},
		},
		description: 'Delay between page loads to reduce flakiness and avoid hammering TroopTrack',
	},

	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		default: 0,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['getMany'],
			},
		},
		description: 'Optional. Process work in chunks. 0 means no batching.',
	},
];