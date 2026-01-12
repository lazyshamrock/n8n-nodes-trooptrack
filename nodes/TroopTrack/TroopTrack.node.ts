import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
} from 'n8n-workflow';

import { troopTrackRequest } from './GenericFunctions';

import { tokensOperations } from './descriptions/Tokens.description';
import { usersOperations, usersFields } from './descriptions/Users.description';
import { eventsOperations, eventsFields } from './descriptions/Events.description';
import { genericOperations, genericFields } from './descriptions/Generic.description';
import { achievementsOperations, achievementsFields } from './descriptions/Achievements.description';
import { awardTypesOperations, awardTypesFields } from './descriptions/AwardTypes.description';
import { mailingListsOperations, mailingListsFields } from './descriptions/MailingLists.description';
import { photoAlbumsOperations, photoAlbumsFields } from './descriptions/PhotoAlbums.description';
import { userAchievementsOperations, userAchievementsFields } from './descriptions/UserAchievements.description';
import { patrolsDescription } from './descriptions/Patrols.description';


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
					{ name: 'Achievements', value: 'achievements' },
					{ name: 'Award Types', value: 'awardTypes' },
					{ name: 'Events', value: 'events' },
					{ name: 'Mailing Lists', value: 'mailingLists' },
					{ name: 'Patrols', value: 'patrols' },
					{ name: 'Photo Albums', value: 'photoAlbums' },
					{ name: 'Tokens', value: 'tokens' },
					{ name: 'Users', value: 'users' },
					{ name: 'User Achievements', value: 'userAchievements' },
					{ name: 'Generic', value: 'generic' },

				],
				default: 'tokens',
			},

			// Operations
			...achievementsOperations,
			...awardTypesOperations,
			...eventsOperations,
			...mailingListsOperations,
			...patrolsDescription,
			...photoAlbumsOperations,
			...tokensOperations,
			...usersOperations,
			...userAchievementsOperations,
			...genericOperations,

			// Fields
			...achievementsFields,
			...awardTypesFields,
			...eventsFields,
			...mailingListsFields,
			...photoAlbumsFields,
			...usersFields,
			...userAchievementsFields,
			...genericFields,
		],
	};

	methods = {
		loadOptions: {
			async getAwardTypes(this: import('n8n-workflow').ILoadOptionsFunctions) {
				const { troopTrackRequest } = await import('./GenericFunctions');

				const resp = await troopTrackRequest(this, 'GET', '/v1/user_achievements/parameters');

				let root: any = resp;
				if (Array.isArray(root) && root.length === 1) root = root[0];

				const awardTypes = Array.isArray(root?.award_types) ? root.award_types : [];

				return awardTypes.map((at: any) => ({
					name: at?.name ?? String(at?.id),
					value: at?.id,
				}));
			},
		},
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			let responseData: any;

			// TOKENS
			if (resource === 'tokens') {
				if (operation === 'getPrivileges') {
					responseData = await troopTrackRequest(this, 'GET', '/v1/tokens');
				}

				if (operation === 'getMyBasicInfo') {
					responseData = await troopTrackRequest(this, 'GET', '/v1/tokens/my_basic_info');
				}
			}

			// USERS
			if (resource === 'users') {
				if (operation === 'getMany') {
					const resp = await troopTrackRequest(this, 'GET', '/v1/users');
					// resp is expected to be { users: [...] }
					responseData = Array.isArray(resp?.users) ? resp.users : [];
				}

				if (operation === 'getById') {
					const userId = this.getNodeParameter('userId', i) as number;
					const resp = await troopTrackRequest(this, 'GET', `/v1/users/${userId}`);
					// resp is expected to be { user: {...} }
					responseData = resp?.user ?? resp;
				}

				if (operation === 'update') {
					const userId = this.getNodeParameter('userId', i) as number;
					const updateBody = this.getNodeParameter('updateBody', i) as object;
					const resp = await troopTrackRequest(this, 'POST', `/v1/users/${userId}`, {}, updateBody);
					responseData = resp?.user ?? resp;
				}

				if (operation === 'getManySimple') {
					// Users (Simple) comes from the same payload as Event Types: GET /v1/events/types
					const raw = await troopTrackRequest(this, 'GET', '/v1/events/types', {}, {});
					const wrapper = Array.isArray(raw) ? raw[0] : raw;

					const users = Array.isArray(wrapper?.users) ? wrapper.users : [];

					responseData = users.map((u: any) => ({
						user_id: u?.user_id,
						name: u?.name,
						scout: u?.scout,
					}));
					}

			}


			// EVENTS
			if (resource === 'events') {
				if (operation === 'getMany') {
					const startOn = this.getNodeParameter('startOn', i) as string;
					const endOn = this.getNodeParameter('endOn', i) as string;

					const resp = await troopTrackRequest(this, 'GET', '/v1/events', {
						start_on: startOn,
						end_on: endOn,
					});

					// TroopTrack returns { events: [...] }
					responseData = Array.isArray(resp?.events) ? resp.events : [];
				}

				if (operation === 'getById') {
					const eventId = this.getNodeParameter('eventId', i) as number;
					const resp = await troopTrackRequest(this, 'GET', `/v1/events/${eventId}`);

					// Some APIs return { event: {...} }, others return the object directly.
					responseData = resp?.event ?? resp;
				}

				if (operation === 'create') {
					const createBody = this.getNodeParameter('createBody', i) as object;
					const resp = await troopTrackRequest(this, 'POST', '/v1/events', {}, createBody);

					responseData = resp?.event ?? resp;
				}

				if (operation === 'getTypes') {
					const resp = await troopTrackRequest(this, 'GET', '/v1/events/types');

					// Prefer the common wrapper shape; fall back to resp if it's already an array.
					if (Array.isArray(resp?.event_types)) {
						responseData = resp.event_types;
					} else if (Array.isArray(resp?.types)) {
						responseData = resp.types;
					} else if (Array.isArray(resp)) {
						responseData = resp;
					} else {
						responseData = [];
					}
				}

			}

			// ACHIEVEMENTS
			if (resource === 'achievements') {
				if (operation === 'getMany') {
					const awardTypeId = this.getNodeParameter('awardTypeId', 0) as number;

					const resp = await troopTrackRequest(this, 'GET', '/v1/user_achievements/parameters');

					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					const awardTypes = Array.isArray(root?.award_types) ? root.award_types : [];
					const selected = awardTypes.find((at: any) => Number(at?.id) === Number(awardTypeId));

					const achievements = Array.isArray(selected?.achievements) ? selected.achievements : [];

					// Return a bare array, consistent with your Users and Events behavior
					responseData = achievements.map((a: any) => ({
						achievement_id: a?.id,
						name: a?.name,
					}));
				}

				if (operation === 'getById') {
					const achievementId = this.getNodeParameter('achievementId', i) as number;
					const awardTypeId = this.getNodeParameter('awardTypeId', i) as number;

					const resp = await troopTrackRequest(
						this,
						'GET',
						`/v1/achievements/${achievementId}`,
						{ award_type_id: awardTypeId },
					);

					// Normalize "children" maps -> arrays recursively
					const normalizeChildren = (node: any): any => {
						if (!node || typeof node !== 'object') return node;

						const out: any = { ...node };

						if (out.children && typeof out.children === 'object') {
							if (Array.isArray(out.children)) {
								out.children = out.children.map((c: any) => normalizeChildren(c));
							} else {
								out.children = Object.values(out.children).map((c: any) => normalizeChildren(c));
							}
						}

						return out;
					};

					/**
					 * Observed shapes:
					 * A) [ { "1010": { ... } } ]
					 * B) { "1010": { ... } }
					 * C) { achievement_id: 1010, achievement: { "1010": { ... } } }
					 * D) { achievement: { ... } } or { achievement: { "1010": { ... } } }
					 * E) { achievement_id: 1010, name: ..., children: ... } (already flat)
					 */
					let root: any = resp;

					// If array wrapper, unwrap first element
					if (Array.isArray(root) && root.length === 1) {
						root = root[0];
					}

					// If TroopTrack wraps under "achievement", unwrap it
					// Preserve a top-level achievement_id if present
					const topAchievementId =
						root && typeof root === 'object' && root.achievement_id != null
							? root.achievement_id
							: achievementId;

					if (root && typeof root === 'object' && root.achievement && typeof root.achievement === 'object') {
						root = root.achievement;
					}

					// If keyed by the ID string, unwrap that key
					if (root && typeof root === 'object' && root[String(achievementId)] && typeof root[String(achievementId)] === 'object') {
						root = root[String(achievementId)];
					}

					// At this point, root should be the AchievementEntity object
					// Inject achievement_id if missing
					if (root && typeof root === 'object' && (root.achievement_id == null)) {
						root = { achievement_id: topAchievementId, ...root };
					}

					responseData = normalizeChildren(root);
				}
			}

			// AWARD TYPES
			if (resource === 'awardTypes') {
				if (operation === 'getMany') {
					const resp = await troopTrackRequest(this, 'GET', '/v1/award_types');

					// Shape: [ { award_types: { "2": {name}, ... } } ]
					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					const map = root?.award_types ?? root;

					if (map && typeof map === 'object' && !Array.isArray(map)) {
						responseData = Object.entries(map).map(([id, obj]: [string, any]) => ({
							award_type_id: Number(id),
							...(obj ?? {}),
						}));
					} else if (Array.isArray(map)) {
						responseData = map;
					} else {
						responseData = [];
					}
				}

				if (operation === 'getById') {
					const awardTypeId = this.getNodeParameter('awardTypeId', i) as number;

					const resp = await troopTrackRequest(this, 'GET', `/v1/award_types/${awardTypeId}`);

					// Shape: [ { award_type: { "2": { award_type_id, name, active_achievements: [...] } } } ]
					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					if (root?.award_type && typeof root.award_type === 'object') root = root.award_type;

					if (root && typeof root === 'object' && root[String(awardTypeId)]) {
						root = root[String(awardTypeId)];
					}

					// Ensure award_type_id exists
					if (root && typeof root === 'object' && (root.award_type_id == null)) {
						root = { award_type_id: awardTypeId, ...root };
					}

					responseData = root;
				}
			}

			// MAILING LISTS
			if (resource === 'mailingLists') {
				if (operation === 'getMany') {
					const resp = await troopTrackRequest(this, 'GET', '/v1/mailing_lists');

					// Shape: [ { mailing_lists: [ ... ] } ]
					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					const lists = root?.mailing_lists;

					if (Array.isArray(lists)) {
						responseData = lists;
					} else if (Array.isArray(root)) {
						// Fallback: API returned array directly
						responseData = root;
					} else {
						responseData = [];
					}
				}
			}

			// PHOTO ALBUMS
			if (resource === 'photoAlbums') {
				if (operation === 'getMany') {
					const resp = await troopTrackRequest(this, 'GET', '/v1/photo_albums');

					// Shape: [ { photo_albums: [ ... ] } ]
					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					const albums = root?.photo_albums;

					if (Array.isArray(albums)) {
						responseData = albums;
					} else if (Array.isArray(root)) {
						// Fallback: API returned array directly
						responseData = root;
					} else {
						responseData = [];
					}
				}

				if (operation === 'getById') {
					const photoAlbumId = this.getNodeParameter('photoAlbumId', i) as number;

					const resp = await troopTrackRequest(this, 'GET', `/v1/photo_albums/${photoAlbumId}`);

					// Shape: [ { ...album... } ]
					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					// Ensure id exists even if API omits it (it currently includes it, but be safe)
					if (root && typeof root === 'object' && root.photo_album_id == null) {
						root = { photo_album_id: photoAlbumId, ...root };
					}

					responseData = root;
				}
			}

			// USER ACHIEVEMENTS
			if (resource === 'userAchievements') {
				if (operation === 'getMany') {
					const resp = await troopTrackRequest(this, 'GET', '/v1/user_achievements/parameters');

					let root: any = resp;
					if (Array.isArray(root) && root.length === 1) root = root[0];

					const awardTypes = root?.award_types;

					if (Array.isArray(awardTypes)) {
						responseData = awardTypes;
					} else {
						responseData = [];
					}
				}

				if (operation === 'getById') {
					const userAchievementId = this.getNodeParameter('userAchievementId', i) as number;

					const response = await troopTrackRequest(
						this,
						'GET',
						`/v1/user_achievement/${userAchievementId}`,
						{},   // body (required, even if unused)
						{},   // query (optional but keeps signature consistent)
					);

					// If the API returns a wrapper, unwrap it here.
					// Otherwise just return the object as-is.
					returnData.push(response);
				}
			}

			if (resource === 'patrols' && operation === 'getMany') {
				const resp = await troopTrackRequest(this, 'GET', '/v1/events/types');

				// Handle both shapes:
				// 1) { event_types: [...], patrols: [...], users: [...] }
				// 2) [ { event_types: [...], patrols: [...], users: [...] } ]
				const wrapper = Array.isArray(resp) ? resp[0] : resp;

				if (Array.isArray(wrapper?.patrols)) {
					responseData = wrapper.patrols;
				} else if (Array.isArray((resp as any)?.patrols)) {
					responseData = (resp as any).patrols;
				} else {
					responseData = [];
				}
				}


			// GENERIC
			if (resource === 'generic') {
				if (operation === 'request') {
					const method = this.getNodeParameter('method', i) as IHttpRequestMethods;
					const endpoint = this.getNodeParameter('endpoint', i) as string;
					const qs = this.getNodeParameter('qs', i) as Record<string, any>;
					const body = this.getNodeParameter('body', i) as any;

					const sendBody = method === 'GET' || method === 'DELETE' ? undefined : body;

					responseData = await troopTrackRequest(this, method, endpoint, qs, sendBody);
				}
			}

			// Output shaping
			const shouldSplitIntoItems =
				(resource === 'users' && (operation === 'getMany' || operation === 'getManySimple')) ||
				(resource === 'events' && (operation === 'getMany' || operation === 'getTypes')) ||
				(resource === 'achievements' && operation === 'getMany') ||
				(resource === 'awardTypes' && operation === 'getMany') ||
				(resource === 'mailingLists' && operation === 'getMany') ||
				(resource === 'photoAlbums' && operation === 'getMany') ||
				(resource === 'patrols' && operation === 'getMany') ||
				(resource === 'userAchievements' && operation === 'getMany');

			if (shouldSplitIntoItems) {
				for (const el of responseData as any[]) {
					returnData.push({ json: el });
				}
			} else {
				returnData.push({ json: responseData });
			}
		}

		return [returnData];
	}
}