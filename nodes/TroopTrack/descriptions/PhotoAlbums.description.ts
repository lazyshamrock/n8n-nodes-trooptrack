import type { INodeProperties } from 'n8n-workflow';

export const photoAlbumsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['photoAlbums'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'GET /v1/photo_albums',
				action: 'Get many a photo albums',
			},
			{
				name: 'Get By ID',
				value: 'getById',
				description: 'GET /v1/photo_albums/{ID}',
				action: 'Get by id a photo albums',
			},
		],
		default: 'getMany',
	},
];

export const photoAlbumsFields: INodeProperties[] = [
	{
		displayName: 'Photo Album ID',
		name: 'photoAlbumId',
		type: 'number',
		required: true,
		displayOptions: { show: { resource: ['photoAlbums'], operation: ['getById'] } },
		default: 0,
	},
];