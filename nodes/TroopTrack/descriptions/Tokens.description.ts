import type { INodeProperties } from 'n8n-workflow';

export const tokensOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tokens'] } },
		options: [
			{ name: 'Get My Privileges', value: 'getPrivileges', description: 'GET /v1/tokens' },
			{ name: 'Get My Basic Info', value: 'getMyBasicInfo', description: 'GET /v1/tokens/my_basic_info' },
		],
		default: 'getPrivileges',
	},
];