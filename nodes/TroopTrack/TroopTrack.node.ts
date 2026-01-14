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
import { positionsOperations, positionsFields } from './descriptions/Positions.description';
import { patrolsDescription } from './descriptions/Patrols.description';
import { TroopTrackPuppeteerSession } from './puppeteer/PuppeteerSession';
import { setNullFields, mergeFieldsByUserId } from './puppeteer/UserInput';
import { scrapeTroopTrackUsernames } from './puppeteer/scrapers/usernames';
import { scrapeTroopTrackHealthFormDates } from './puppeteer/scrapers/healthForms';
import { scrapeTroopTrackTxtOptOut } from './puppeteer/scrapers/txtOptOut';
import { scrapeTroopTrackCounseledMeritBadges } from './puppeteer/scrapers/counseledMeritBadges';
import { scrapeTroopTrackProfileFields } from './puppeteer/scrapers/profileFields';
import { scrapePositions } from './puppeteer/scrapers/positions';
import { createPositionAssignments } from './puppeteer/scrapers/positions.createAssignments';
import { permissionsOperations, permissionsFields } from './descriptions/Permissions.description';
import { scrapePermissions } from './puppeteer/scrapers/permissions';
import { setTroopTrackUserPermissions } from './puppeteer/scrapers/permissionsSet';


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
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Photo Albums', value: 'photoAlbums' },
					{ name: 'Positions', value: 'positions' },
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
			...permissionsOperations,
			...photoAlbumsOperations,
			...positionsOperations,
			...tokensOperations,
			...usersOperations,
			...userAchievementsOperations,
			...genericOperations,

			// Fields
			...achievementsFields,
			...awardTypesFields,
			...eventsFields,
			...mailingListsFields,
			...permissionsFields,
			...photoAlbumsFields,
			...positionsFields,
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

			// Run-once operations: these process the full input set in one pass
			if (
				(
					(resource === 'users' &&
						(
							operation === 'getUsernames' ||
							operation === 'getHealthFormDates' ||
							operation === 'getTxtOptOut' ||
							operation === 'getCounseledMeritBadges' ||
							operation === 'getBsaId' ||
							operation === 'getDateJoined' ||
							operation === 'getAllergies'
						)) ||
					(resource === 'positions' && 
						(
							operation === 'getMany' ||
							operation === 'createAssignments'
						)) ||
					(resource === 'permissions' && 
						(
							operation === 'getMany' ||
							operation === 'setPermissions'
						))
				) &&
				i !== 0
			) {
				continue;
			}


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

				const runProfileFieldScrape = async (field: 'BSA_id' | 'date_joined' | 'allergies') => {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					const debug: Record<string, any> = {
						puppeteer: {
							launched: false,
							finalUrl: null,
							scrapedField: field,
							userCount: items.length,
							firstUserId: null,
							firstProfileUrl: null,
							urlBeforeScrape: null,
							urlAfterScrape: null,
							firstScrapeDebug: null,
						},
					};

					const userIdField = this.getNodeParameter('userIdField', 0, 'user_id') as string;
					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0) as string;
					const delayMs = this.getNodeParameter('delayMs', 0, 300) as number;
					const batchSize = this.getNodeParameter('batchSize', 0, 0) as number;

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// Default null field on every item (requirement: always exists)
					let enriched: Array<Record<string, any>> = items.map((it) => ({
						...(it.json as Record<string, any>),
						[field]: null,
					}));

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						// Build list of user IDs from the incoming items
						const userIds: string[] = enriched
							.map((u) => String(u?.[userIdField] ?? '').trim())
							.filter((v) => v !== '');

						debug.puppeteer.firstUserId = userIds[0] ?? null;
						debug.puppeteer.firstProfileUrl = userIds[0] ? `${baseUrl}/manage/users/${userIds[0]}` : null;

						const profileMap = await session.withSession(async (page) => {
							debug.puppeteer.launched = true;
							debug.puppeteer.urlBeforeScrape = page.url();

							const map = await scrapeTroopTrackProfileFields(page, baseUrl, userIds, [field], {
								delayMs,
								retries: 1,
								debug: debugMode,
							});

							debug.puppeteer.urlAfterScrape = page.url();
							debug.puppeteer.finalUrl = page.url();

							// Pull the first-user evidence off the map (added by profileFields.ts when debug=true)
							const firstScrapeDebug = (map as any)?._debug_first ?? null;
							debug.puppeteer.firstScrapeDebug = firstScrapeDebug;

							if ((map as any)?._debug_first) {
								delete (map as any)._debug_first;
							}

							return map;
						});

						enriched = enriched.map((u) => {
							const id = String(u?.[userIdField] ?? '').trim();
							const hit = id ? profileMap[id] : undefined;

							return {
								...u,
								[field]:
									hit && Object.prototype.hasOwnProperty.call(hit, field)
										? (hit as any)[field]
										: null,
							};
						});
					} catch (e) {
						// Requirement: do not fail. Keep null field. Only fail in debug mode.
						if (debugMode) {
							const msg = e instanceof Error ? e.message : String(e);
							throw new Error(`profile scrape (${field}) failed: ${msg}. Debug: ${JSON.stringify(debug)}`);
						}
					}

					if (debugMode) {
						enriched = enriched.map((u) => ({ ...u, _debug: debug }));
					}

					return enriched;
				};

				if (operation === 'getMany') {
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
						const dataToInclude = this.getNodeParameter('dataToInclude', i, []) as string[];
						const debugMode = this.getNodeParameter('debugMode', i, false) as boolean;
						const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', i, '') as string;

						// 1) Seed via the same source as Simple: /v1/events/types -> wrapper.users
						const seedRaw = await troopTrackRequest(this, 'GET', '/v1/events/types', {}, {});
						const seedWrapper = Array.isArray(seedRaw) ? seedRaw[0] : seedRaw;
						const seedUsers: any[] = Array.isArray(seedWrapper?.users) ? seedWrapper.users : [];

						const userIds: number[] = seedUsers
							.map((u: any) => Number(u?.user_id))
							.filter((n: number) => Number.isFinite(n) && n > 0);

						// 2) Fetch full API payload for each user via GET /v1/users/{id} (sequential)
						const detailedUsers: any[] = [];
						for (const userId of userIds) {
							try {
								const resp = await troopTrackRequest(this, 'GET', `/v1/users/${userId}`);
								const userObj = resp?.user ?? resp;

								// Ensure user_id is always present for later merges
								if (userObj && typeof userObj === 'object') {
									(userObj as any).user_id = (userObj as any).user_id ?? userId;
									detailedUsers.push(userObj);
								} else {
									detailedUsers.push({ user_id: userId });
								}
							} catch (e) {
								if (debugMode) {
									const msg = e instanceof Error ? e.message : String(e);
									throw new Error(`Users > Get Many > Extended: GET /v1/users/${userId} failed: ${msg}`);
								}
								// Requirement: return as much as we can. Keep a record with at least user_id.
								detailedUsers.push({ user_id: userId });
							}
						}

						// 3) Optional enrichment (API + scraping), driven by dataToInclude
						const wants = {
							advancementData: dataToInclude.includes('advancementData'),
							counseledMeritBadges: dataToInclude.includes('counseledMeritBadges'),
							troopTrackUsername: dataToInclude.includes('troopTrackUsername'),
							healthFormDates: dataToInclude.includes('healthFormDates'),
							textMessageOptOut: dataToInclude.includes('textMessageOptOut'),
							bsaId: dataToInclude.includes('bsaId'),
							dateJoined: dataToInclude.includes('dateJoined'),
							allergies: dataToInclude.includes('allergies'),
						};

						const needsScrape =
							wants.counseledMeritBadges ||
							wants.troopTrackUsername ||
							wants.healthFormDates ||
							wants.textMessageOptOut ||
							wants.bsaId ||
							wants.dateJoined ||
							wants.allergies;

						// Only require browserless when scrape-based fields are requested
						if (needsScrape && (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '')) {
							throw new Error(
								'Browserless WebSocket Endpoint is required when one or more selected Data to Include options require web scraping.',
							);
						}

						// Default null fields for requested enrichments (keeps output predictable)
						let enriched: Array<Record<string, any>> = detailedUsers.map((u) => ({
							...(u as Record<string, any>),
							...(wants.troopTrackUsername ? { user_name: null as string | null } : {}),
							...(wants.healthFormDates
								? {
										PartA: null as string | null,
										PartB: null as string | null,
										PartC: null as string | null,
								}
								: {}),
							...(wants.textMessageOptOut ? { txtOptOut: null as boolean | null } : {}),
							...(wants.counseledMeritBadges ? { counseled_MBs: null as any } : {}),
							...(wants.bsaId ? { BSA_id: null as string | null } : {}),
							...(wants.dateJoined ? { date_joined: null as string | null } : {}),
							...(wants.allergies ? { allergies: null as string | null } : {}),
							// Placeholder per current requirement
							...(wants.advancementData ? { advancementData: null as any } : {}),
						}));

						if (needsScrape) {
							let usernameMap: Record<string, any> = {};
							let healthMap: Record<string, any> = {};
							let txtMap: Record<string, any> = {};
							let counseledMap: Record<string, any> = {};
							let profileMap: Record<string, any> = {};

							try {
								const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

								const auth = {
									tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
									tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
									tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
								};

								if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
									throw new Error('Missing TroopTrack credentials fields required for web login');
								}

								const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
								const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

								const userIdsForScrape: string[] = enriched
									.map((u) => String(u?.user_id ?? '').trim())
									.filter((v) => v !== '');

								// Union of profile fields requested
								const profileFields: Array<'BSA_id' | 'date_joined' | 'allergies'> = [];
								if (wants.bsaId) profileFields.push('BSA_id');
								if (wants.dateJoined) profileFields.push('date_joined');
								if (wants.allergies) profileFields.push('allergies');

								await session.withSession(async (page) => {
									if (wants.troopTrackUsername) {
										await page.goto(`${baseUrl}/manage/users`, {
											waitUntil: 'domcontentloaded',
											timeout: 120000,
										});
										usernameMap = await scrapeTroopTrackUsernames(page, baseUrl, 120000);
									}

									if (wants.healthFormDates) {
										await page.goto(`${baseUrl}/manage/medical_book`, {
											waitUntil: 'domcontentloaded',
											timeout: 120000,
										});
										healthMap = await scrapeTroopTrackHealthFormDates(page, baseUrl, 120000);
									}

									if (wants.textMessageOptOut) {
										await page.goto(`${baseUrl}/communicate/text_message_settings`, {
											waitUntil: 'domcontentloaded',
											timeout: 120000,
										});
										txtMap = await scrapeTroopTrackTxtOptOut(page, baseUrl, 120000);
									}

									if (wants.counseledMeritBadges) {
										await page.goto(`${baseUrl}/manage/counseled_merit_badges`, {
											waitUntil: 'domcontentloaded',
											timeout: 120000,
										});
										counseledMap = await scrapeTroopTrackCounseledMeritBadges(page, baseUrl, 120000);
									}

									// Profile pages: run once for the union of requested fields
									if (profileFields.length > 0) {
										profileMap = await scrapeTroopTrackProfileFields(page, baseUrl, userIdsForScrape, profileFields, {
											delayMs: 300,
											retries: 1,
											debug: debugMode,
										});
									}
								});

								// Merge scraped maps into each user record
								enriched = enriched.map((u) => {
									const id = String(u?.user_id ?? '').trim();
									const out: Record<string, any> = { ...u };

									if (wants.troopTrackUsername) out.user_name = usernameMap?.[id]?.user_name ?? null;

									if (wants.healthFormDates) {
										out.PartA = healthMap?.[id]?.PartA ?? null;
										out.PartB = healthMap?.[id]?.PartB ?? null;
										out.PartC = healthMap?.[id]?.PartC ?? null;
									}

									if (wants.textMessageOptOut) out.txtOptOut = txtMap?.[id]?.txtOptOut ?? null;
									if (wants.counseledMeritBadges) out.counseled_MBs = counseledMap?.[id]?.counseled_MBs ?? null;

									if (profileFields.length > 0) {
										const hit = profileMap?.[id];
										if (wants.bsaId) out.BSA_id = hit && Object.prototype.hasOwnProperty.call(hit, 'BSA_id') ? hit.BSA_id : null;
										if (wants.dateJoined) out.date_joined = hit && Object.prototype.hasOwnProperty.call(hit, 'date_joined') ? hit.date_joined : null;
										if (wants.allergies) out.allergies = hit && Object.prototype.hasOwnProperty.call(hit, 'allergies') ? hit.allergies : null;
									}

									return out;
								});
							} catch (e) {
								if (debugMode) {
									const msg = e instanceof Error ? e.message : String(e);
									throw new Error(`Users > Get Many > Extended: scraping failed: ${msg}`);
								}
								// Requirement: keep null fields rather than failing
							}
						}

						responseData = enriched;
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
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;
					const debug: Record<string, any> = {
						puppeteer: {
							launched: false,
							loggedIn: false,
							finalUrl: null,
							usersPageUrl: null,
							rowCount: null,
						},
					};

					const userIdField = this.getNodeParameter('userIdField', 0, 'user_id') as string;
					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0) as string;

					const inputItems = items;
					const fieldsToAdd = ['user_name'];

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// Mirror the input items as plain JSON records, with a nullable field
					let enriched: Array<Record<string, any>> = inputItems.map((it) => ({
						...(it.json as Record<string, any>),
						user_name: null as string | null,
					}));

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;

						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						const usernameMap = await session.withSession(async (page) => {
							debug.puppeteer.launched = true;

							debug.puppeteer.finalUrl = page.url();

							// Go to users page and record where we actually landed
							await page.goto(`${baseUrl}/manage/users`, { waitUntil: 'domcontentloaded', timeout: 120000 });
							debug.puppeteer.usersPageUrl = page.url();

							// Count rows using both common IDs
							const rowCount0 = await page.$$eval('#DataTables_Table_0 > tbody tr', els => els.length).catch(() => 0);
							const rowCount1 = await page.$$eval('#DataTables_Table_1 > tbody tr', els => els.length).catch(() => 0);
							debug.puppeteer.rowCount = { table0: rowCount0, table1: rowCount1 };

							// Now run your real scraper
							return await scrapeTroopTrackUsernames(page, baseUrl, 120000);
						});

						enriched = enriched.map((u) => {
							const id = String(u?.[userIdField] ?? '').trim();
							const hit = id ? usernameMap[id] : undefined;

							return {
								...u,
								user_name: hit?.user_name ?? null,
							};
						});
					} catch (e) {
						if (debugMode) {
							const msg = e instanceof Error ? e.message : String(e);
							throw new Error(`getUsernames failed: ${msg}. Debug: ${JSON.stringify(debug)}`);
						}
						// Requirement: null fields on error
					}


					// IMPORTANT: responseData must be an array of plain JSON objects
					if (debugMode) {
						enriched = enriched.map(u => ({ ...u, _debug: debug }));
					}
					responseData = enriched;
				}

				if (operation === 'getHealthFormDates') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;
					const debug: Record<string, any> = {
						puppeteer: {
							launched: false,
							loggedIn: false,
							finalUrl: null,
							medicalBookUrl: null,
							rowCount: null,
						},
					};

					const userIdField = this.getNodeParameter('userIdField', 0, 'user_id') as string;
					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0) as string;

					const inputItems = items;

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// Mirror the input items as plain JSON records, with nullable fields
					let enriched: Array<Record<string, any>> = inputItems.map((it) => ({
						...(it.json as Record<string, any>),
						PartA: null as string | null,
						PartB: null as string | null,
						PartC: null as string | null,
					}));

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;

						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						const healthMap = await session.withSession(async (page) => {
							debug.puppeteer.launched = true;
							debug.puppeteer.finalUrl = page.url();

							// Go to medical book page and record where we actually landed
							await page.goto(`${baseUrl}/manage/medical_book`, {
								waitUntil: 'domcontentloaded',
								timeout: 120000,
							});
							debug.puppeteer.medicalBookUrl = page.url();

							// Count rows using common DataTables IDs, for debugging only
							const rowCount0 = await page
								.$$eval('#DataTables_Table_0 > tbody tr', (els) => els.length)
								.catch(() => 0);
							const rowCount1 = await page
								.$$eval('#DataTables_Table_1 > tbody tr', (els) => els.length)
								.catch(() => 0);
							debug.puppeteer.rowCount = { table0: rowCount0, table1: rowCount1 };

							// Run the scraper (it returns {} if no access, which will keep nulls)
							return await scrapeTroopTrackHealthFormDates(page, baseUrl, 120000);
						});

						enriched = enriched.map((u) => {
							const id = String(u?.[userIdField] ?? '').trim();
							const hit = id ? healthMap[id] : undefined;

							return {
								...u,
								PartA: hit?.PartA ?? null,
								PartB: hit?.PartB ?? null,
								PartC: hit?.PartC ?? null,
							};
						});
					} catch (e) {
						// Requirement: if error or no access, return null fields rather than failing the whole node
						if (debugMode) {
							const msg = e instanceof Error ? e.message : String(e);
							throw new Error(`getHealthFormDates failed: ${msg}. Debug: ${JSON.stringify(debug)}`);
						}
					}

					if (debugMode) {
						enriched = enriched.map((u) => ({ ...u, _debug: debug }));
					}

					responseData = enriched;
				}
				
				if (operation === 'getTxtOptOut') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					const debug: Record<string, any> = {
						puppeteer: {
							launched: false,
							finalUrl: null,
							textSettingsUrl: null,
							rowCount: null,
						},
					};

					const userIdField = this.getNodeParameter('userIdField', 0, 'user_id') as string;
					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0) as string;

					const inputItems = items;

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// Always include txtOptOut. Default is null (unknown), per your "always exists" rule.
					// Scrape will populate false for users found on the page (meaning NOT opted out).
					let enriched: Array<Record<string, any>> = inputItems.map((it) => ({
						...(it.json as Record<string, any>),
						txtOptOut: null as boolean | null,
					}));

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						const txtMap = await session.withSession(async (page) => {
							debug.puppeteer.launched = true;
							debug.puppeteer.finalUrl = page.url();

							// For debug visibility only. Scraper navigates defensively too.
							await page.goto(`${baseUrl}/communicate/text_message_settings`, {
								waitUntil: 'domcontentloaded',
								timeout: 120000,
							});
							debug.puppeteer.textSettingsUrl = page.url();

							const rowCount = await page
								.$$eval('#text_message_setting > tbody tr', (els) => els.length)
								.catch(() => 0);
							debug.puppeteer.rowCount = rowCount;

							// Scraper should return {} on access issues. That keeps null defaults.
							return await scrapeTroopTrackTxtOptOut(page, baseUrl, 120000);
						});

						enriched = enriched.map((u) => {
							const id = String(u?.[userIdField] ?? '').trim();
							const hit = id ? txtMap[id] : undefined;

							// Semantics:
							// - If we have a hit, scraper sets txtOptOut = false (NOT opted out).
							// - If we do not have a hit, we keep null (unknown).
							return {
								...u,
								txtOptOut: hit?.txtOptOut ?? null,
							};
						});
					} catch (e) {
						// Requirement: do not fail the node. Keep txtOptOut present with null.
						if (debugMode) {
							const msg = e instanceof Error ? e.message : String(e);
							throw new Error(`getTxtOptOut failed: ${msg}. Debug: ${JSON.stringify(debug)}`);
						}
					}

					if (debugMode) {
						enriched = enriched.map((u) => ({ ...u, _debug: debug }));
					}

					responseData = enriched;
				}

				if (operation === 'getCounseledMeritBadges') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					const debug: Record<string, any> = {
						puppeteer: {
							launched: false,
							finalUrl: null,
							counseledMeritBadgesUrl: null,
							rowCount: null,
						},
					};

					const userIdField = this.getNodeParameter('userIdField', 0, 'user_id') as string;
					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0) as string;

					const inputItems = items;

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// Always include counseled_MBs, even if empty
					let enriched: Array<Record<string, any>> = inputItems.map((it) => ({
						...(it.json as Record<string, any>),
						counseled_MBs: [] as string[],
					}));

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						const mbcMap = await session.withSession(async (page) => {
							debug.puppeteer.launched = true;
							debug.puppeteer.finalUrl = page.url();

							// For debug visibility only. Scraper navigates defensively too.
							await page.goto(`${baseUrl}/manage/counseled_merit_badges`, {
								waitUntil: 'domcontentloaded',
								timeout: 120000,
							});
							debug.puppeteer.counseledMeritBadgesUrl = page.url();

							const rowCount = await page.$$eval('table tbody tr', (els) => els.length).catch(() => 0);
							debug.puppeteer.rowCount = rowCount;

							// Scraper returns {} on access issues. That keeps defaults.
							return await scrapeTroopTrackCounseledMeritBadges(page, baseUrl, 120000);
						});

						enriched = enriched.map((u) => {
							const id = String(u?.[userIdField] ?? '').trim();
							const hit = id ? mbcMap[id] : undefined;

							return {
								...u,
								counseled_MBs: Array.isArray(hit?.counseled_MBs) ? hit.counseled_MBs : [],
							};
						});
					} catch (e) {
						// Requirement: do not fail the node. Keep counseled_MBs present with [].
						if (debugMode) {
							const msg = e instanceof Error ? e.message : String(e);
							throw new Error(`getCounseledMeritBadges failed: ${msg}. Debug: ${JSON.stringify(debug)}`);
						}
					}

					if (debugMode) {
						enriched = enriched.map((u) => ({ ...u, _debug: debug }));
					}

					responseData = enriched;
				}

				if (operation === 'getBsaId') { responseData = await runProfileFieldScrape('BSA_id'); }
				if (operation === 'getDateJoined') { responseData = await runProfileFieldScrape('date_joined'); }
				if (operation === 'getAllergies') { responseData = await runProfileFieldScrape('allergies'); }

			}

			// PERMISSIONS
			if (resource === 'permissions') {
				if (operation === 'getMany') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					const debug: Record<string, any> = {
						puppeteer: {
							launched: false,
							finalUrl: null,
							privilegesUrl: null,
							resultCount: null,
						},
					};

					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
					const delayMs = this.getNodeParameter('delayMs', 0, 300) as number;
					const batchSize = this.getNodeParameter('batchSize', 0, 0) as number; // not used for this op, kept for consistency
					const demoAdultUserId = this.getNodeParameter('demoAdultUserId', 0) as number;

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}
					if (!demoAdultUserId) {
						throw new Error('demoAdultUserId is required');
					}

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						debug.puppeteer.privilegesUrl = `${baseUrl}/manage/users/${demoAdultUserId}?tab=privileges`;

						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						const permissions = await session.withSession(async (page) => {
							debug.puppeteer.launched = true;
							debug.puppeteer.finalUrl = page.url();

							if (delayMs > 0) {
								await new Promise((resolve) => setTimeout(resolve, delayMs));
							}

							const result = await scrapePermissions(page, { baseUrl, demoAdultUserId });
							debug.puppeteer.resultCount = Array.isArray(result) ? result.length : null;
							return result;
						});

						responseData = permissions;

						if (debugMode && Array.isArray(responseData)) {
							responseData = responseData.map((p: any) => ({ ...p, _debug: debug }));
						}
					} catch (e) {
						if (debugMode) throw e;
						responseData = [];
					}
				}

				if (operation === 'setPermissions') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					// These three parameters are the names of fields in the incoming JSON.
					// They should be strings like "user_id", "access_level", "granted_permissions".
					const userIdFieldName = this.getNodeParameter('user_id', 0) as string;
					const accessLevelFieldName = this.getNodeParameter('access_level', 0) as string;
					const grantedPermissionsFieldName = this.getNodeParameter('granted_permissions', 0) as string;

					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0, '') as string;

					// Support either delayMs/batchSize or delay/batch depending on how your description file is named.
					const getParamSafe = <T>(name: string, fallback: T): T => {
						try {
							return this.getNodeParameter(name, 0, fallback as any) as T;
						} catch {
							return fallback;
						}
					};

					const delayMs = getParamSafe<number>('delayMs', getParamSafe<number>('delay', 300));
					const batchSize = getParamSafe<number>('batchSize', getParamSafe<number>('batch', 0));

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// 1) Validate granted_permissions is an array of numbers on every item
					for (let idx = 0; idx < items.length; idx++) {
						const item = items[idx];
						if (!item || !item.json) {
							throw new Error(`Missing input item at index ${idx}`);
						}
						const row = item.json as Record<string, any>;

						const gp = row?.[grantedPermissionsFieldName];

						const isValid =
							Array.isArray(gp) &&
							gp.every((v: any) => typeof v === 'number' && Number.isFinite(v));

						if (!isValid) {
							throw new Error(
								`Invalid "${grantedPermissionsFieldName}" at item index ${idx}. Expected an array of numbers.`,
							);
						}
					}

					// 2) Call /v1/tokens and confirm required privileges
					const tokenResp: any = await troopTrackRequest(this, 'GET', '/v1/tokens');

					const usersArr: any[] = Array.isArray(tokenResp?.users) ? tokenResp.users : [];
					const me = usersArr[0];

					const my_user_id = Number(me?.user_id);
					const privileges: string[] = Array.isArray(me?.privileges) ? me.privileges : [];

					const hasEditUserProfile = privileges.includes('Edit user profile');
					const hasManagePrivileges = privileges.includes('Manage privileges');

					if (!Number.isFinite(my_user_id)) {
						throw new Error('Unable to determine your user_id from /v1/tokens.');
					}

					if (!hasEditUserProfile || !hasManagePrivileges) {
						throw new Error(
							'Insufficient privileges. You must have both "Edit user profile" and "Manage privileges".',
						);
					}

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;

						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						// Build a plain input array (one per incoming item)
						const inputRows = items.map((it) => (it.json ?? {}) as Record<string, any>);

						const result = await session.withSession(async (page) => {
							if (delayMs > 0) {
								await new Promise((resolve) => setTimeout(resolve, delayMs));
							}

							// Cast to any so TS does not get picky about argument counts while your scraper evolves.
							return await (setTroopTrackUserPermissions as any)(page, {
								baseUrl,
								my_user_id,
								items: inputRows,
								fieldNames: {
									user_id: userIdFieldName,
									access_level: accessLevelFieldName,
									granted_permissions: grantedPermissionsFieldName,
								},
								options: {
									debugMode,
									delayMs,
									batchSize,
								},
							});
						});

						// Expect scraper returns an array of output rows
						responseData = result;
					} catch (e) {
						if (debugMode) throw e;

						const msg = e instanceof Error ? e.message : String(e);
						// Non-debug mode: return inputs with an errors field populated
						responseData = items.map((it) => ({
							...(it.json as Record<string, any>),
							errors: [msg],
						}));
					}
				}
			}

			// POSITIONS
			if (resource === 'positions') {
				if (operation === 'getMany') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
					const delayMs = this.getNodeParameter('delayMs', 0, 300) as number;
					const batchSize = this.getNodeParameter('batchSize', 0, 0) as number; // currently unused
					const demoScoutUserId = this.getNodeParameter('demoScoutUserId', 0) as number;
					const demoAdultUserId = this.getNodeParameter('demoAdultUserId', 0) as number;

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}
					if (!demoScoutUserId || !demoAdultUserId) {
						throw new Error('demoScoutUserId and demoAdultUserId are required');
					}

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;
						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const baseUrl = `https://${auth.tt_sub_domain}.trooptrack.com`;
						const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);

						const positions = await session.withSession(async (page) => {
							if (delayMs > 0) {
								await new Promise((resolve) => setTimeout(resolve, delayMs));
							}

							return scrapePositions(page, {
								baseUrl,
								demoScoutUserId,
								demoAdultUserId,
							});
						});

						responseData = positions;
					} catch (e) {
						if (debugMode) {
							throw e;
						}
						responseData = [];
					}
				}

				if (operation === 'createAssignments') {
					const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

					const browserlessWsEndpoint = this.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
					const delayMs = this.getNodeParameter('delayMs', 0, 300) as number;
					const batchSize = this.getNodeParameter('batchSize', 0, 0) as number;

					// Field mapping (from node UI)
					const mapping = this.getNodeParameter('fieldMapping', 0, {}) as any;

					const userIdField = String(mapping.userIdField ?? 'user_id');
					const positionIdField = String(mapping.positionIdField ?? 'position_id');
					const startDateField = String(mapping.startDateField ?? 'start_date');
					const endDateField = String(mapping.endDateField ?? 'end_date');

					// Chromium options (from node UI)
					const chromiumParam = this.getNodeParameter('chromiumOptions', 0, {}) as any;
					const chromium = chromiumParam?.options ?? {};

					const navigationTimeoutMs = Number(chromium.navigationTimeoutMs ?? 120000);
					const waitUntil = String(chromium.waitUntil ?? 'domcontentloaded');
					const userAgent = String(chromium.userAgent ?? '');
					const viewportWidth = Number(chromium.viewportWidth ?? 1365);
					const viewportHeight = Number(chromium.viewportHeight ?? 768);
					const blockImagesAndMedia = Boolean(
						typeof chromium.blockImagesAndMedia === 'boolean' ? chromium.blockImagesAndMedia : true,
					);

					if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
						throw new Error('Browserless WebSocket endpoint is required (including token).');
					}

					// Build inputs for the scraper from all incoming items
					const inputRows: Array<Record<string, any>> = items.map((it) => (it.json ?? {}) as Record<string, any>);

					try {
						const credentials = (await this.getCredentials('troopTrackApi')) as Record<string, any>;
						const auth = {
							tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
							tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
							tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
						};

						if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
							throw new Error('Missing TroopTrack credentials fields required for web login');
						}

						const timeoutForSession = Number.isFinite(navigationTimeoutMs) && navigationTimeoutMs > 0 ? navigationTimeoutMs : 120000;
						const session = new TroopTrackPuppeteerSession(auth, timeoutForSession, browserlessWsEndpoint);

						const result = await session.withSession(async (page) => {
							// Optional: let session settle
							if (delayMs > 0) {
								await new Promise((resolve) => setTimeout(resolve, delayMs));
							}

							const scrapeResult = await createPositionAssignments(
								page,
								auth.tt_sub_domain,
								inputRows,
								{
									userIdField,
									positionIdField,
									startDateField,
									endDateField,
								},
								{
									delayMs,
									batchSize,
									debugMode,
									chromiumOptions: {
										navigationTimeoutMs: timeoutForSession,
										waitUntil: waitUntil as any,
										userAgent,
										viewportWidth,
										viewportHeight,
										blockImagesAndMedia,
									},
								},
							);

							return scrapeResult;
						});

						// Build per-item output, one output item per input item
						const errorsByIndex = new Map<number, any>();
						for (const e of result?.errors ?? []) {
							if (typeof e?.index === 'number') errorsByIndex.set(e.index, e);
						}

						responseData = inputRows.map((row, idx) => {
							const err = errorsByIndex.get(idx);
							return {
								...row,
								created: !err,
								error: err?.error ?? null,
								_url: err?.url ?? null,
							};
						});
					} catch (e) {
						if (debugMode) throw e;

						// In non-debug mode, return items with an error field populated
						responseData = inputRows.map((row) => ({
							...row,
							created: false,
							error: String((e as any)?.message ?? e),
						}));
					}
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
					const awardTypeId = this.getNodeParameter('awardTypeId', i) as number;

					responseData = await troopTrackRequest(
						this,
						'GET',
						`/v1/user_achievements/${userAchievementId}`,
						{ award_type_id: awardTypeId }, // query string
					);
				}
			}

			// PATROLS
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
			const op = String(operation || '').toLowerCase();
			const neverSplitOps = new Set([
				'getbyid',
				'getbyid ', // defensive, if any stray whitespace
				'update',
			]);
			const isByIdOperation = op.includes('getbyid') || op.includes('byid') || op.endsWith('byid') || op.endsWith('byid ');

			// Only split if responseData is an array and it is not a by-id style op.
			const shouldSplitIntoItems = Array.isArray(responseData) && !neverSplitOps.has(op) && !isByIdOperation;
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