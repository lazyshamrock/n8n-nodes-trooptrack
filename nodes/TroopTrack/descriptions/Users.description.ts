import type { INodeProperties } from 'n8n-workflow';

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
			{ name: 'Get TroopTrack Usernames', value: 'getUsernames', description: 'Scrape TroopTrack usernames from the web UI (/manage/users)', action: 'Get TroopTrack usernames'},
			{ name: 'Update', value: 'update', description: 'POST /v1/users/{id}' },
		],
		default: 'getMany',
	},
];

export const usersFields: INodeProperties[] = [
	{
		displayName: 'User Id',
		name: 'userId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['users'], operation: ['getById', 'update'] } },
		default: 0,
	},
	{
		displayName: 'Return Type',
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
	{
		displayName: 'Data to Include',
		name: 'dataToInclude',
		type: 'multiOptions',
		noDataExpression: true,
		required: true,
		description: 'Extract additional data for all users based on other API Calls ("Detailed User Data", "Advancement Data") or webscraping via Puppeteer.',
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
	// Award Type (multi-select), shown only when Detailed Advancement Data is selected
	{
		displayName: 'Award Type',
		name: 'advancementAwardTypeIds',
		type: 'multiOptions',
		noDataExpression: true,
		required: true,
		// Best-effort defaults. In most TroopTrack setups:
		// 1 = Rank, 2 = Merit Badge.
		// If your instance differs, just change the selections in the UI.
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
	// Advancement Status (multi-select), shown only when Detailed Advancement Data is selected
	{
		displayName: 'Advancement Status',
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
	{
		displayName: 'User ID Field Name',
		name: 'userIdField',
		type: 'string',
		default: 'user_id',
		description: 'Field on each input item that contains the TroopTrack user id',
		displayOptions: {
			show: {
				resource: ['users'],
				operation: ['getUsernames'],
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
];