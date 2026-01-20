import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';
import { TroopTrackPuppeteerSession } from '../puppeteer/PuppeteerSession';
import { scrapeTroopTrackUsernames } from '../puppeteer/scrapers/usernames';
import { scrapeTroopTrackHealthFormDates } from '../puppeteer/scrapers/healthForms';
import { scrapeTroopTrackTxtOptOut } from '../puppeteer/scrapers/txtOptOut';
import { scrapeTroopTrackCounseledMeritBadges } from '../puppeteer/scrapers/counseledMeritBadges';
import { scrapeTroopTrackProfileFields } from '../puppeteer/scrapers/profileFields';
import { permissionsResource } from './permissions';
import { positionsResource } from './positions';
import { achievementsResource } from './achievements';

export const usersResource: ResourceHandler = {
	resource: 'users',
	runOnceOperations: new Set([
		'getUsernames',
		'getHealthFormDates',
		'getTxtOptOut',
		'getCounseledMeritBadges',
		'getBsaId',
		'getDateJoined',
		'getAllergies',
		'setPermissions',
		'createAssignments',
		'startMeritBadge',
	]),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'setPermissions') {
			return await permissionsResource.execute(ctx, items, itemIndex, 'setPermissions');
		}

		if (operation === 'createAssignments') {
			return await positionsResource.execute(ctx, items, itemIndex, 'createAssignments');
		}

		if (operation === 'startMeritBadge') {
			return await achievementsResource.execute(ctx, items, itemIndex, 'startMeritBadge');
		}

		const runProfileFieldScrape = async (field: 'BSA_id' | 'date_joined' | 'allergies') => {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

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

			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0) as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}

			// Default null field on every item (requirement: always exists)
			let enriched: Array<Record<string, any>> = items.map((it) => ({
				...(it.json as Record<string, any>),
				[field]: null,
			}));

			try {
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;

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
			const returnType = ctx.getNodeParameter('returnType', itemIndex, 'api') as string;

			if (returnType === 'simple') {
				// Old Get Many (Simple) behavior
				const raw = await troopTrackRequest(ctx, 'GET', '/v1/events/types', {}, {});
				const wrapper = Array.isArray(raw) ? raw[0] : raw;

				const users = Array.isArray(wrapper?.users) ? wrapper.users : [];
				return users.map((u: any) => ({
					user_id: u?.user_id,
					name: u?.name,
					scout: u?.scout,
				}));
			}

			if (returnType === 'extended') {
				const dataToInclude = ctx.getNodeParameter('dataToInclude', itemIndex, []) as string[];
				const debugMode = ctx.getNodeParameter('debugMode', itemIndex, false) as boolean;
				const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', itemIndex, '') as string;

				// 1) Seed via the same source as Simple: /v1/events/types -> wrapper.users
				const seedRaw = await troopTrackRequest(ctx, 'GET', '/v1/events/types', {}, {});
				const seedWrapper = Array.isArray(seedRaw) ? seedRaw[0] : seedRaw;
				const seedUsers: any[] = Array.isArray(seedWrapper?.users) ? seedWrapper.users : [];

				const userIds: number[] = seedUsers
					.map((u: any) => Number(u?.user_id))
					.filter((n: number) => Number.isFinite(n) && n > 0);

				// 2) Fetch full API payload for each user via GET /v1/users/{id} (sequential)
				const detailedUsers: any[] = [];
				for (const userId of userIds) {
					try {
						const resp = await troopTrackRequest(ctx, 'GET', `/v1/users/${userId}`);
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
						const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;

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
								if (wants.bsaId) {
									out.BSA_id = hit && Object.prototype.hasOwnProperty.call(hit, 'BSA_id') ? hit.BSA_id : null;
								}
								if (wants.dateJoined) {
									out.date_joined =
										hit && Object.prototype.hasOwnProperty.call(hit, 'date_joined') ? hit.date_joined : null;
								}
								if (wants.allergies) {
									out.allergies =
										hit && Object.prototype.hasOwnProperty.call(hit, 'allergies') ? hit.allergies : null;
								}
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

				return enriched;
			}

			// returnType === 'api'
			const raw = await troopTrackRequest(ctx, 'GET', '/v1/users', {}, {});
			const wrapper = Array.isArray(raw) ? raw[0] : raw;

			// Adjust this depending on your existing /v1/users response shaping
			return Array.isArray(wrapper?.users) ? wrapper.users : Array.isArray(wrapper) ? wrapper : [];
		}

		if (operation === 'getById') {
			const userId = ctx.getNodeParameter('userId', itemIndex) as number;
			const resp = await troopTrackRequest(ctx, 'GET', `/v1/users/${userId}`);
			// resp is expected to be { user: {...} }
			return resp?.user ?? resp;
		}

		if (operation === 'getUsernames') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;
			const debug: Record<string, any> = {
				puppeteer: {
					launched: false,
					loggedIn: false,
					finalUrl: null,
					usersPageUrl: null,
					rowCount: null,
				},
			};

			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0) as string;

			const inputItems = items;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}

			// Mirror the input items as plain JSON records, with a nullable field
			let enriched: Array<Record<string, any>> = inputItems.map((it) => ({
				...(it.json as Record<string, any>),
				user_name: null as string | null,
			}));

			try {
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;

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
					const rowCount0 = await page
						.$$eval('#DataTables_Table_0 > tbody tr', (els) => els.length)
						.catch(() => 0);
					const rowCount1 = await page
						.$$eval('#DataTables_Table_1 > tbody tr', (els) => els.length)
						.catch(() => 0);
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
				enriched = enriched.map((u) => ({ ...u, _debug: debug }));
			}
			return enriched;
		}

		if (operation === 'getHealthFormDates') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;
			const debug: Record<string, any> = {
				puppeteer: {
					launched: false,
					loggedIn: false,
					finalUrl: null,
					medicalBookUrl: null,
					rowCount: null,
				},
			};

			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0) as string;

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
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;

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

			return enriched;
		}

		if (operation === 'getTxtOptOut') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			const debug: Record<string, any> = {
				puppeteer: {
					launched: false,
					finalUrl: null,
					textSettingsUrl: null,
					rowCount: null,
				},
			};

			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0) as string;

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
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;

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

			return enriched;
		}

		if (operation === 'getCounseledMeritBadges') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			const debug: Record<string, any> = {
				puppeteer: {
					launched: false,
					finalUrl: null,
					counseledMeritBadgesUrl: null,
					rowCount: null,
				},
			};

			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0) as string;

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
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;

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

			return enriched;
		}

		if (operation === 'getBsaId') {
			return await runProfileFieldScrape('BSA_id');
		}
		if (operation === 'getDateJoined') {
			return await runProfileFieldScrape('date_joined');
		}
		if (operation === 'getAllergies') {
			return await runProfileFieldScrape('allergies');
		}

		throw new Error(`Unsupported users operation: ${operation} (index ${itemIndex})`);
	},
};
