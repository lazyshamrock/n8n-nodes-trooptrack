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

export const generalTroopTrackOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['generalTroopTrack'] } },
		// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
		options: [
			{
				name: 'Tokens: Get Privileges',
				value: 'tokensGetPrivileges',
				description: 'GET /v1/tokens',
				action: 'Tokens: Get Token privileges',
			},
			{
				name: 'Tokens: Get My Basic Info',
				value: 'tokensGetMyBasicInfo',
				description: 'GET /v1/tokens/my_basic_info',
				action: 'Get my basic info',
			},
			{
				name: 'Permissions: Get Many',
				value: 'permissionsGetMany',
				description: 'Scrape TroopTrack permission list (Privileges tab) from the web UI',
				action: 'Permissions: Get TroopTrack permissions 🌐',
			},
			{
				name: 'Positions: Get Many',
				value: 'positionsGetMany',
				description: 'Scrape available Scout and Adult leadership positions (web UI)',
				action: 'Positions: Get Many 🌐',
			},
			{
				name: 'Get All Patrols: Get Many',
				value: 'patrolsGetMany',
				description: 'Get All Patrols in the Unit',
				action: 'Patrols: Get Many',
			},
		],
		default: 'tokensGetPrivileges',
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
	// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
	description: 'When enabled, the node will throw errors and include debug details for Puppeteer',
};

export const generalTroopTrackFields: INodeProperties[] = [
	{
		displayName: 'Scout User ID',
		name: 'demoScoutUserId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['generalTroopTrack'],
				operation: ['positionsGetMany'],
			},
		},
		default: 0,
		description: 'A Scout user ID used only to open the Scout leadership position form',
	},
	{
		displayName: 'Adult User ID',
		name: 'demoAdultUserId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['generalTroopTrack'],
				operation: ['positionsGetMany'],
			},
		},
		default: 0,
		description: 'An Adult user ID used only to open the Adult leadership positions form',
	},
	withShow(browserlessWsEndpointBase, {
		resource: ['generalTroopTrack'],
		operation: ['positionsGetMany'],
	}),
	withShow(debugModeBase, {
		resource: ['generalTroopTrack'],
		operation: ['positionsGetMany'],
	}),
	{
		displayName: 'Delay (Ms)',
		name: 'delayMs',
		type: 'number',
		default: 300,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['generalTroopTrack'],
				operation: ['positionsGetMany'],
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
				resource: ['generalTroopTrack'],
				operation: ['positionsGetMany'],
			},
		},
		description: 'Optional. Process work in chunks. 0 means no batching.',
	},
];
