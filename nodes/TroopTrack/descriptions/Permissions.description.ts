import type { INodeProperties } from 'n8n-workflow';

/**
 * Small helper so we can reuse a base field and only vary displayOptions.show.
 */
function withShow(
	base: INodeProperties,
	show: NonNullable<NonNullable<INodeProperties['displayOptions']>['show']>,
): INodeProperties {
	return {
		...base,
		displayOptions: { show },
	};
}

export const permissionsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['permissions'] } },
		options: [
			{
				name: 'Permissions: Get Many',
				value: 'getMany',
				description: 'Scrape TroopTrack permission list (Privileges tab) from the web UI',
				action: 'Permissions: Get TroopTrack permissions 🌐',
			},
			{
				name: 'Permissions: Set Permissions',
				value: 'setPermissions',
				description: 'Update TroopTrack user permissions (Privileges tab) via the web UI',
				action: 'Permissions: Set TroopTrack Permission 🌐',
			},
		],
		default: 'getMany',
	},
];

// Shared fields (mirrors Users.description.ts patterns)
const browserlessWsEndpointBase: INodeProperties = {
	displayName: 'Browserless WebSocket Endpoint',
	name: 'browserlessWsEndpoint',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'ws://browserless:3000?token=YOUR_TOKEN',
	description: 'Full Browserless WebSocket endpoint including token query parameter',
};

const debugModeBase: INodeProperties = {
	displayName: 'Debug Mode',
	name: 'debugMode',
	type: 'boolean',
	default: false,
	description: 'When enabled, the node will throw errors and include debug details for Puppeteer',
};

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
		description: 'An Adult user ID used only to open the Privileges tab and read the available permissions',
	},
	{	displayName: 'User ID Field',
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
		description: 'Name of the input field containing the target TroopTrack user_id. You can drag a field from the input sidebar. Only the field name will be used.',
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
		description: 'Name of the input field containing the access_level to set. You can drag a field from the input sidebar. Only the field name will be used.',
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
		description: 'Name of the input field containing an array of permission IDs (numbers) to grant. You can drag a field from the input sidebar. Only the field name will be used.',
	},

	withShow(browserlessWsEndpointBase, {
		resource: ['permissions'],
		operation: ['getMany', 'setPermissions'],
	}),
	withShow({
		...debugModeBase,
		required: true,
	}, {
		resource: ['permissions'],
		operation: ['getMany', 'setPermissions'],
	}),
	{
		displayName: 'Delay (Ms)',
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
				operation: ['getMany'],
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
				operation: ['getMany'],
			},
		},
		description: 'Optional. Process work in chunks. 0 means no batching.',
	},
	{
		displayName: 'Delay (Ms)',
		name: 'delayMs',
		type: 'number',
		required: true,
		default: 300,
		description: 'Delay between page loads to reduce flakiness and avoid hammering TroopTrack',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['setPermissions'],
			},
		},
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		required: true,
		default: 0,
		description: 'Optional. Process work in chunks. 0 means no batching.',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['permissions'],
				operation: ['setPermissions'],
			},
		},
	},
];
