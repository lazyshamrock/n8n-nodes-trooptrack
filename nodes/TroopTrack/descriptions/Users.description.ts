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
			{ name: 'Get Many', value: 'getMany', description: 'GET /v1/users', action: 'Get all TroopTrack users in unit (API or 🌐)' },
			{ name: 'Get By ID', value: 'getById', description: 'GET /v1/users/{ID}', action: 'Get a TroopTrack user by id' },
			{ name: 'Get TroopTrack Usernames', value: 'getUsernames', description: 'Get the TroopTrack username associated with a specific user_id. [Scrapes data from the web UI (/manage/users)]', action: 'Get TroopTrack usernames 🌐' },
			{ name: 'Get Health Form Dates', value: 'getHealthFormDates', description: 'Get Health Form dates (PartA, PartB, PartC) for users keyed by user_id. [Scrapes data from the web UI (/manage/medical_book)].', action: 'Get health form dates 🌐' },
			{ name: 'Get Text Message Opt Out', value: 'getTxtOptOut', description: 'Get text message opt-out status (txtOptOut) for users keyed by user_id. [Scrapes data from the web UI (/communicate/text_message_settings)].', action: 'Get text message opt out status 🌐'},
			{ name: 'Get Counseled Merit Badges', value: 'getCounseledMeritBadges', description: 'Get counseled merit badges (counseled_MBs) for users keyed by user_id. [Scrapes data from the web UI (/manage/counseled_merit_badges)].', action: 'Get counseled merit badges 🌐' },
			{ name: 'Get BSA ID', value: 'getBsaId', description: 'Get BSA membership ID (BSA_id) for users keyed by user_id. [Scrapes profile pages from the web UI (/manage/users/{id})]', action: 'Get BSA ID 🌐' },
			{ name: 'Get Date Joined', value: 'getDateJoined', description: 'Get date joined (date_joined) for users keyed by user_id. [Scrapes profile pages from the web UI (/manage/users/{ID})]', action: 'Get date joined 🌐' },
			{ name: 'Get Allergies', value: 'getAllergies', description: 'Get allergies (allergies) for users keyed by user_id. [Scrapes profile pages from the web UI (/manage/users/{ID})]', action: 'Get allergies 🌐', },
			{ name: 'Set Permissions', value: 'setPermissions', description: 'Update TroopTrack user permissions (Privileges tab) via the web UI', action: 'Set TroopTrack Permission 🌐' },
			{ name: 'Assign Scouts to Positions', value: 'createAssignments', description: 'Create new leadership tracker entries for Scouts based on incoming items (web UI)', action: 'Assign scouts to position 🌐' },
			{ name: 'Add a User', value: 'update', description: 'POST /v1/users/{ID}', action: 'Add a User',},
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
	{ 	displayName: 'User ID',
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
	{ 	displayName: 'Additional Data to Include',
		name: 'dataToInclude',
		type: 'multiOptions',
		noDataExpression: true,
		description: 'Extract additional data for all users based on other API Calls ("Detailed User Data", "Advancement Data") or webscraping via Puppeteer',
		default: [
			'counseledMeritBadges',
			'troopTrackUsername',
			'healthFormDates',
			'textMessageOptOut',
			'bsaId',
			'dateJoined',
			'allergies',
		],
		options: [
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
	{	displayName: 'User ID Field Name',
		name: 'userIdField',
		type: 'string',
		required: true,
		default: 'user_id',
		description: 'Field on each input item that contains the TroopTrack user ID',
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getUsernames', 'getHealthFormDates', 'getTxtOptOut', 'getCounseledMeritBadges', 'getBsaId', 'getDateJoined', 'getAllergies', 'createAssignments',],
			},
		},
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
				resource: ['users'],
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
				resource: ['users'],
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
				resource: ['users'],
				operation: ['setPermissions'],
			},
		},
		description: 'Name of the input field containing an array of permission IDs (numbers) to grant. You can drag a field from the input sidebar. Only the field name will be used.',
	},

	{
		displayName: 'Position ID Field Name',
		name: 'positionIdField',
		type: 'string',
		required: true,
		default: 'position_id',
		description: 'Field on each input item that contains the TroopTrack position ID',
		displayOptions: {
			show: {
				resource: ['users'],
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
				resource: ['users'],
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
				resource: ['users'],
				operation: ['createAssignments'],
			},
		},
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
				resource: ['users'],
				operation: ['setPermissions'],
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
				resource: ['users'],
				operation: ['createAssignments'],
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
				resource: ['users'],
				operation: ['setPermissions'],
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
				resource: ['users'],
				operation: ['createAssignments'],
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
		dataToInclude: ['counseledMeritBadges',
			'troopTrackUsername',
			'healthFormDates',
			'textMessageOptOut',
			'bsaId',
			'dateJoined',
			'allergies',],
	}),
	withShow(browserlessWsEndpointBase, {
		resource: ['users'],
		operation: ['getUsernames', 'getHealthFormDates', 'getTxtOptOut', 'getCounseledMeritBadges', 'getBsaId', 'getDateJoined', 'getAllergies',],
	}),
	withShow(browserlessWsEndpointBase, {
		resource: ['users'],
		operation: ['setPermissions', 'createAssignments'],
	}),

	withShow(debugModeBase, {
		resource: ['users'],
		operation: ['getMany'],
		returnType: ['extended'],
	}),

	withShow(debugModeBase, {
		resource: ['users'],
		operation: ['getUsernames', 'getHealthFormDates', 'getTxtOptOut', 'getCounseledMeritBadges', 'getBsaId', 'getDateJoined', 'getAllergies',],
	}),
	withShow({
		...debugModeBase,
		required: true,
	}, {
		resource: ['users'],
		operation: ['setPermissions'],
	}),
	withShow(debugModeBase, {
		resource: ['users'],
		operation: ['createAssignments'],
	}),
	{
		displayName: 'Delay (Ms)',
		name: 'delayMs',
		type: 'number',
		default: 300,
		description: 'Delay between profile page loads to reduce flakiness and avoid hammering TroopTrack',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getBsaId', 'getDateJoined', 'getAllergies'],
			},
		},
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		default: 0,
		description:
			'Optional. Process users in chunks. 0 means no batching. Useful for large units to reduce long-running sessions.',
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getBsaId', 'getDateJoined', 'getAllergies'],
			},
		},
	},

];