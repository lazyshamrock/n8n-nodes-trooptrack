import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { troopTrackRequest } from './GenericFunctions';

import { usersOperations, usersFields } from './descriptions/Users.description';
import { eventsOperations, eventsFields } from './descriptions/Events.description';
import { genericOperations, genericFields } from './descriptions/Generic.description';
import { achievementsCategoryOperations, achievementsCategoryFields } from './descriptions/AchievementsCategory.description';
import { meritBadgeOperations, meritBadgeFields } from './descriptions/MeritBadge.description';
import { permissionsOperations, permissionsFields } from './descriptions/Permissions.description';
import { mailingListsOperations, mailingListsFields } from './descriptions/Communication.description';
import { generalTroopTrackOperations, generalTroopTrackFields } from './descriptions/GeneralTroopTrack.description';
import type { ResourceHandler } from './resources/types';
import { tokensResource } from './resources/tokens';
import { usersResource } from './resources/users';
import { permissionsResource } from './resources/permissions';
import { positionsResource } from './resources/positions';
import { generalTroopTrackResource } from './resources/generalTroopTrack';
import { eventsResource } from './resources/events';
import { achievementsResource } from './resources/achievements';
import { achievementsCategoryResource } from './resources/achievementsCategory';
import { awardTypesResource } from './resources/awardTypes';
import { mailingListsResource } from './resources/mailingLists';
import { userAchievementsResource } from './resources/userAchievements';
import { patrolsResource } from './resources/patrols';
import { genericResource } from './resources/generic';
import { meritBadgesResource } from './resources/meritBadges';

export class TroopTrack implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TroopTrack',
		name: 'troopTrack',
		icon: 'file:trooptrack.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'TroopTrack API',
		defaults: {
			name: 'TroopTrack',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'troopTrackApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Achievement', value: 'achievementsCategory' },
					{ name: 'Merit Badge', value: 'meritBadges' },
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'General TroopTrack', value: 'generalTroopTrack' },
					{ name: 'User', value: 'users' },
					{ name: 'Event', value: 'events' },
					{ name: 'Communicate', value: 'mailingLists' },
					{ name: 'Generic', value: 'generic' },
				],
				default: 'generalTroopTrack',
			},

			// Operations
			...achievementsCategoryOperations,
			...meritBadgeOperations,
			...permissionsOperations,
			...generalTroopTrackOperations,
			...eventsOperations,
			...mailingListsOperations,
			...usersOperations,
			...genericOperations,

			// Fields
			...achievementsCategoryFields,
			...meritBadgeFields,
			...permissionsFields,
			...generalTroopTrackFields,
			...eventsFields,
			...mailingListsFields,
			...usersFields,
			...genericFields,
		],
	};

	methods = {
		loadOptions: {
			async getAwardTypes(this: import('n8n-workflow').ILoadOptionsFunctions) {
				const { troopTrackRequest } = await import('./GenericFunctions');

				// Use the dedicated endpoint. It is the most consistent source for award types.
				const resp = await troopTrackRequest(this, 'GET', '/v1/award_types');

				let root: any = resp;
				if (Array.isArray(root) && root.length === 1) root = root[0];

				const mapOrArray = root?.award_types ?? root;

				let list: Array<{ award_type_id: number; name?: string }> = [];

				// Shape A: { award_types: { "2": { name: "..." }, ... } }
				if (mapOrArray && typeof mapOrArray === 'object' && !Array.isArray(mapOrArray)) {
					list = Object.entries(mapOrArray).map(([id, obj]: [string, any]) => ({
						award_type_id: Number(id),
						name: obj?.name,
					}));
				}
				// Shape B: [ { award_type_id: 2, name: "..." }, ... ]
				else if (Array.isArray(mapOrArray)) {
					list = mapOrArray.map((x: any) => ({
						award_type_id: Number(x?.award_type_id ?? x?.id),
						name: x?.name,
					}));
				}

				return list
					.filter((x) => Number.isFinite(x.award_type_id))
					.map((x) => ({
						name: x.name ?? String(x.award_type_id),
						value: x.award_type_id, // stays a number, which is what you want
					}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resourceHandlers: Record<string, ResourceHandler> = {
			achievementsCategory: achievementsCategoryResource,
			meritBadges: meritBadgesResource,
			generalTroopTrack: generalTroopTrackResource,
			tokens: tokensResource,
			users: usersResource,
			permissions: permissionsResource,
			positions: positionsResource,
			events: eventsResource,
			achievements: achievementsResource,
			awardTypes: awardTypesResource,
			mailingLists: mailingListsResource,
			userAchievements: userAchievementsResource,
			patrols: patrolsResource,
			generic: genericResource,
		};
		const runOnceCache = new Map<string, any>();
		const runOnceOutputDone = new Set<string>();

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			const handler = resourceHandlers[resource];
			if (!handler) {
				throw new Error(`Unsupported resource: ${resource}`);
			}

			const runOnceKey = `${resource}:${operation}`;
			let responseData: any;
			if (handler.runOnceOperations?.has(operation)) {
				if (!runOnceCache.has(runOnceKey)) {
					responseData = await handler.execute(this, items, i, operation);
					runOnceCache.set(runOnceKey, responseData);
				} else {
					responseData = runOnceCache.get(runOnceKey);
				}
				if (runOnceOutputDone.has(runOnceKey)) {
					continue;
				}
				runOnceOutputDone.add(runOnceKey);
			} else {
				responseData = await handler.execute(this, items, i, operation);
			}

			// Output shaping
			const op = String(operation || '').toLowerCase();
			const neverSplitOps = new Set([
				'getbyid',
				'getbyid ', // defensive, if any stray whitespace
				'update',
			]);
			const isByIdOperation = op.includes('getbyid') || op.includes('byid') || op.endsWith('byid') || op.endsWith('byid ');

			const isN8nItem = (val: any): boolean =>
				val != null && typeof val === 'object' && ('json' in val || 'binary' in val);

			if (Array.isArray(responseData)) {
				const looksLikeItems = responseData.every((el) => isN8nItem(el));
				if (looksLikeItems) {
					for (const el of responseData as any[]) {
						returnData.push(el);
					}
					continue;
				}
			}

			// Only split if responseData is an array and it is not a by-id style op.
			const shouldSplitIntoItems = Array.isArray(responseData) && !neverSplitOps.has(op) && !isByIdOperation;
			if (shouldSplitIntoItems) {
				for (const el of responseData as any[]) {
					returnData.push({ json: el });
				}
			} else if (isN8nItem(responseData)) {
				returnData.push(responseData);
			} else {
				returnData.push({ json: responseData });
			}
		}

		return [returnData];
	}
}
