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

export const positionsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['positions'],
			},
		},
		options: [
			{
				name: 'Get All Positions',
				value: 'getMany',
				description: 'Scrape available Scout and Adult leadership positions (web UI)',
				action: 'Get many positions',
			},
		],
		default: 'getMany',
	},
];

// Define shared Puppeteer fields once
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
	description: 'When enabled, the node will throw errors and include debug details to help troubleshoot Puppeteer',
};

export const positionsFields: INodeProperties[] = [
	{
		displayName: 'Scout User ID',
		name: 'demoScoutUserId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['getMany'],
			},
		},
		default: 0,
		description:
			'A Scout user ID used only to open the Scout leadership position form',
	},
	{
		displayName: 'Adult User ID',
		name: 'demoAdultUserId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['getMany'],
			},
		},
		default: 0,
		description:
			'An Adult user ID used only to open the Adult leadership positions form',
	},

	// Same optional Puppeteer tuning knobs as Users > Get BSA ID
	{
		displayName: 'Delay (ms)',
		name: 'delayMs',
		type: 'number',
		default: 300,
		description: 'Delay between page loads to reduce flakiness and avoid hammering TroopTrack.',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['getMany'],
			},
		},
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		default: 0,
		description:
			'Optional. Process work in chunks. 0 means no batching. Useful to reduce long-running sessions.',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['getMany'],
			},
		},
	},

	// Reuse Browserless + Debug like Users.description.ts does for getBsaId
	withShow(browserlessWsEndpointBase, {
		resource: ['positions'],
		operation: ['getMany'],
	}),
	withShow(debugModeBase, {
		resource: ['positions'],
		operation: ['getMany'],
	}),
];