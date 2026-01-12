import type { INodeProperties } from 'n8n-workflow';

export const patrolsDescription: INodeProperties[] = [
	// -----------------------------
	// Operations: Patrols
	// -----------------------------
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['patrols'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Get All Patrols in the Unit',
				action: 'Get All Patrols in the Unit'
			},
		],
		default: 'getMany',
	},
];
