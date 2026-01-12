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

export const usersOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['users'] } },
		options: [
			{ name: 'Get Many', value: 'getMany', description: 'GET /v1/users', action: 'Get all TroopTrack users in unit' },
			{ name: 'Get By Id', value: 'getById', description: 'GET /v1/users/{id}', action: 'Get a TroopTrack user by ID' },
			{ name: 'Get TroopTrack Usernames', value: 'getUsernames', description: 'Get the TroopTrack username associated with a specific user_id.  [Scrapes data from the web UI (/manage/users)]', action: 'Get TroopTrack usernames' },
			{ name: 'Get Health Form Dates', value: 'getHealthFormDates', description: 'Get Health Form dates (PartA, PartB, PartC) for users keyed by user_id. [Scrapes data from the web UI (/manage/medical_book)]', action: 'Get health form dates' },
			{ name: 'Get Text Message Opt Out', value: 'getTxtOptOut', description: 'Get text message opt-out status (txtOptOut) for users keyed by user_id. [Scrapes data from the web UI (/communicate/text_message_settings)]', action: 'Get text message opt out status'},
			{ name: 'Get Counseled Merit Badges', value: 'getCounseledMeritBadges', description: 'Get counseled merit badges (counseled_MBs) for users keyed by user_id. [Scrapes data from the web UI (/manage/counseled_merit_badges)]', action: 'Get counseled merit badges' },
			{ name: 'Update User', value: 'update', description: 'POST /v1/users/{id}' },
		],
		default: 'getMany',
	},
];

// Define shared fields once
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
	description:
		'When enabled, the node will throw errors and include debug details to help troubleshoot Puppeteer',
};

export const usersFields: INodeProperties[] = [
	{ 	displayName: 'User Id',
		name: 'userId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['users'], operation: ['getById', 'update'] } },
		default: 0,
	},
	{ 	displayName: 'Return Type',
		name: 'returnType',
		type: 'options',
		noDataExpression: true,
		required: true,
		default: 'api',
		options: [
			{ name: 'Simple', value: 'simple', description: 'Lightweight user list (user_id, name, scout)' },
			{ name: 'API', value: 'api', description: 'Raw API user payload from /v1/users' },
			{ name: 'Extended', value: 'extended', description: 'Future: richer user view using other API calls and Puppeteer scraping' },
		],
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getMany'],
			},
		},
	},
	{ 	displayName: 'Data to Include',
		name: 'dataToInclude',
		type: 'multiOptions',
		noDataExpression: true,
		required: true,
		description:
			'Extract additional data for all users based on other API Calls ("Detailed User Data", "Advancement Data") or webscraping via Puppeteer.',
		default: [
			'detailedUserData',
			'advancementData',
			'counseledMeritBadges',
			'troopTrackUsername',
			'healthFormDates',
			'textMessageOptOut',
			'bsaId',
			'dateJoined',
			'allergies',
		],
		options: [
			{ name: 'Detailed User Data', value: 'detailedUserData' },
			{ name: 'Detailed Advancement Data', value: 'advancementData' },
			{ name: 'Counseled Merit Badges', value: 'counseledMeritBadges' },
			{ name: 'TroopTrack Username', value: 'troopTrackUsername' },
			{ name: 'Health Form Dates', value: 'healthFormDates' },
			{ name: 'Text Message Opt Out', value: 'textMessageOptOut' },
			{ name: 'BSA ID', value: 'bsaId' },
			{ name: 'Date Joined', value: 'dateJoined' },
			{ name: 'Allergies', value: 'allergies' },
		],
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getMany'],
				returnType: ['extended'],
			},
		},
	},
	{ 	displayName: 'Award Type',
		name: 'advancementAwardTypeIds',
		type: 'multiOptions',
		noDataExpression: true,
		required: true,
		default: [999999998, 999999999],
		description: 'Filter advancement data by award type (multi-select).',
		typeOptions: {
			loadOptionsMethod: 'getAwardTypes',
		},
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getMany'],
				returnType: ['extended'],
				dataToInclude: ['advancementData'],
			},
		},
	},
	{	displayName: 'Advancement Status',
		name: 'advancementStatuses',
		type: 'multiOptions',
		noDataExpression: true,
		required: true,
		default: ['incomplete', 'complete'],
		description: 'Filter advancement data by completion status (multi-select).',
		options: [
			{ name: 'Incomplete', value: 'incomplete' },
			{ name: 'Complete', value: 'complete' },
		],
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getMany'],
				returnType: ['extended'],
				dataToInclude: ['advancementData'],
			},
		},
	},
	{	displayName: 'User ID Field Name',
		name: 'userIdField',
		type: 'string',
		required: true,
		default: 'user_id',
		description: 'Field on each input item that contains the TroopTrack user id',
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getUsernames', 'getHealthFormDates', 'getTxtOptOut', 'getCounseledMeritBadges'],
			},
		},
	},
	{
		displayName: 'Update Body',
		name: 'updateBody',
		type: 'json',
		required: true,
		displayOptions: { show: { resource: ['users'], operation: ['update'] } },
		default: '{}',
		description: 'JSON body matching postV1UsersId in TroopTrack Swagger',
	},

	// Reuse the same Browserless field with different show rules
	withShow(browserlessWsEndpointBase, {
		resource: ['users'],
		operation: ['getMany'],
		returnType: ['extended'],
	}),
	withShow(browserlessWsEndpointBase, {
		resource: ['users'],
		operation: ['getUsernames', 'getHealthFormDates', 'getTxtOptOut', 'getCounseledMeritBadges'],
	}),

	withShow(debugModeBase, {
		resource: ['users'],
		operation: ['getMany'],
		returnType: ['extended'],
	}),

	withShow(debugModeBase, {
		resource: ['users'],
		operation: ['getUsernames', 'getHealthFormDates', 'getTxtOptOut', 'getCounseledMeritBadges'],
	}),
];