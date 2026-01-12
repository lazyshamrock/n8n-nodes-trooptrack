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
import { TroopTrackPuppeteerSession } from './puppeteer/PuppeteerSession';
import { setNullFields, mergeFieldsByUserId } from './puppeteer/UserInput';
import { scrapeTroopTrackUsernames } from './puppeteer/scrapers/usernames';

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
				if (resource === 'users' && operation === 'getMany') {
					const returnType = this.getNodeParameter('returnType', i, 'api') as string;

					if (returnType === 'simple') {
						// Old Get Many (Simple) behavior
						const raw = await troopTrackRequest(this, 'GET', '/v1/events/types', {}, {});
						const wrapper = Array.isArray(raw) ? raw[0] : raw;

						const users = Array.isArray(wrapper?.users) ? wrapper.users : [];
						responseData = users.map((u: any) => ({
						user_id: u?.user_id,
						name: u?.name,
						scout: u?.scout,
						}));
					} else if (returnType === 'extended') {
						// Stub for now. Return API payload (same as 'api') plus metadata about the user's selection.
						const dataToInclude = this.getNodeParameter('dataToInclude', i, []) as string[];

						const raw = await troopTrackRequest(this, 'GET', '/v1/users', {}, {});
						const wrapper = Array.isArray(raw) ? raw[0] : raw;

						const users = Array.isArray(wrapper?.users) ? wrapper.users : Array.isArray(wrapper) ? wrapper : [];

						responseData = users.map((u: any) => ({
						...u,
						_extended: {
							enabled: true,
							dataToInclude,
							note: 'Extended return type is not implemented yet. Returning API payload as a placeholder.',
						},
						}));
					} else {
						// returnType === 'api'
						const raw = await troopTrackRequest(this, 'GET', '/v1/users', {}, {});
						const wrapper = Array.isArray(raw) ? raw[0] : raw;

						// Adjust this depending on your existing /v1/users response shaping
						responseData = Array.isArray(wrapper?.users)
						? wrapper.users
						: Array.isArray(wrapper)
							? wrapper
							: [];
					}
					}

				if (operation === 'getById') {
					const userId = this.getNodeParameter('userId', i) as number;
					const resp = await troopTrackRequest(this, 'GET', `/v1/users/${userId}`);
					// resp is expected to be { user: {...} }
					responseData = resp?.user ?? resp;
				}

				if (operation === 'getUsernames') {
					const userIdField = this.getNodeParameter('userIdField', i, 'user_id') as string;
					const inputItems = this.getInputData();

					const fieldsToAdd = ['troopTrackUsername'];

					// Default output with nulls
					let output = setNullFields(inputItems as any, fieldsToAdd);

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as any;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						const session = new TroopTrackPuppeteerSession(auth, 120000);

						output = await session.withSession(async (page) => {
							const usernameMap = await scrapeTroopTrackUsernames(page, baseUrl, 120000);
							return mergeFieldsByUserId(output as any, userIdField, usernameMap as any, fieldsToAdd) as any;
						});
					} catch (err) {
						// Requirement: on access error or any error, return null fields
						output = setNullFields(inputItems as any, fieldsToAdd) as any;
					}

					return output as any;
				}

				if (operation === 'update') {
					const userId = this.getNodeParameter('userId', i) as number;
					const updateBody = this.getNodeParameter('updateBody', i) as object;
					const resp = await troopTrackRequest(this, 'POST', `/v1/users/${userId}`, {}, updateBody);
					responseData = resp?.user ?? resp;
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