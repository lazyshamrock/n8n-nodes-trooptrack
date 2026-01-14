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
		displayOptions: { show: { resource: ['positions'] } },
		options: [
			{
				name: 'Get All Positions',
				value: 'getMany',
				description: 'Scrape available Scout and Adult leadership positions (web UI)',
				action: 'Get many positions',
			},
			{
				name: 'Assign Scouts to Positions',
				value: 'createAssignments',
				description: 'Create new leadership tracker entries for Scouts based on incoming items (web UI)',
				action: 'Assign Scouts to Positions',
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
	description: 'When enabled, the node will throw errors and include debug details to help troubleshoot Puppeteer',
};

export const positionsFields: INodeProperties[] = [
	// Get Many (scrape the dropdown options). Uses 1 demo Scout and 1 demo Adult to open each form.
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
		description: 'A Scout user ID used only to open the Scout leadership position form',
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
		description: 'An Adult user ID used only to open the Adult leadership positions form',
	},

	// Create Assignments field mapping (simple string params like Users does)
	{
		displayName: 'User ID Field Name',
		name: 'userIdField',
		type: 'string',
		required: true,
		default: 'user_id',
		description: 'Field on each input item that contains the TroopTrack user id',
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['createAssignments'],
			},
		},
	},
	{
		displayName: 'Position ID Field Name',
		name: 'positionIdField',
		type: 'string',
		required: true,
		default: 'position_id',
		description: 'Field on each input item that contains the TroopTrack position id',
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['createAssignments'],
			},
		},
	},
	{
		displayName: 'Start Date Field Name',
		name: 'startDateField',
		type: 'string',
		required: true,
		default: 'start_date',
		description: 'Field on each input item that contains the start date (expected YYYY-MM-DD)',
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['createAssignments'],
			},
		},
	},
	{
		displayName: 'End Date Field Name',
		name: 'endDateField',
		type: 'string',
		required: true,
		default: 'end_date',
		description: 'Field on each input item that contains the end date (expected YYYY-MM-DD)',
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['createAssignments'],
			},
		},
	},

	// Browserless and Debug (reused, same pattern as Users.description.ts)
	withShow(browserlessWsEndpointBase, {
		resource: ['positions'],
		operation: ['getMany'],
	}),
	withShow(browserlessWsEndpointBase, {
		resource: ['positions'],
		operation: ['createAssignments'],
	}),

	withShow(debugModeBase, {
		resource: ['positions'],
		operation: ['getMany'],
	}),
	withShow(debugModeBase, {
		resource: ['positions'],
		operation: ['createAssignments'],
	}),

	// Delay and Batch (mirrors Users.description.ts)
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
				operation: ['getMany', 'createAssignments'],
			},
		},
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		default: 0,
		description:
			'Optional. Process items in chunks. 0 means no batching. Useful to reduce long-running sessions.',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['positions'],
				operation: ['getMany', 'createAssignments'],
			},
		},
	},
];