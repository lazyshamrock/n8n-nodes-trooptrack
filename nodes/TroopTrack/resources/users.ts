import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';
import { TroopTrackPuppeteerSession } from '../puppeteer/PuppeteerSession';
import { scrapeTroopTrackUsernames } from '../puppeteer/scrapers/usernames';
import { scrapeTroopTrackHealthFormDates } from '../puppeteer/scrapers/healthForms';
import { scrapeTroopTrackTxtOptOut } from '../puppeteer/scrapers/txtOptOut';
import { scrapeTroopTrackCounseledMeritBadges } from '../puppeteer/scrapers/counseledMeritBadges';
import { scrapeTroopTrackProfileFields } from '../puppeteer/scrapers/profileFields';
import { positionsResource } from './positions';
import type { IExecuteFunctions } from 'n8n-workflow';

const USER_DETAIL_CONCURRENCY = 12;

const nullIfEmptyString = (value: any) => {
	if (typeof value === 'string' && value.trim() === '') return null;
	return value;
};

const toNumberOrNull = (value: any) => {
	if (value == null) return null;
	if (typeof value === 'string' && value.trim() === '') return null;
	const num = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(num) ? num : null;
};

const toBoolOrNull = (value: any) => {
	if (value == null) return null;
	if (typeof value === 'string' && value.trim() === '') return null;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
	if (typeof value === 'string') {
		const v = value.trim().toLowerCase();
		if (v === 'true' || v === '1') return true;
		if (v === 'false' || v === '0') return false;
	}
	return null;
};

const applySentinelDate = (value: any, sentinelValue: string) => {
	if (typeof value === 'string' && value.trim() === '') return sentinelValue;
	return value;
};

const cleanName = (value: any) => {
	if (value == null) return null;
	const s = String(value)
		.replace(/\s*\([^)]*\)\s*/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return s || null;
};

const parseExcludeUserIds = (raw: any) => {
	const text = typeof raw === 'string' ? raw.trim() : '';
	if (!text) return new Set<number>();

	let values: any[] = [];
	if (text.startsWith('[')) {
		try {
			const parsed = JSON.parse(text);
			if (!Array.isArray(parsed)) {
				throw new Error('excludeUserIds JSON must be an array');
			}
			values = parsed;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			throw new Error(`excludeUserIds parse error: ${msg}. Raw: ${text}`);
		}
	} else {
		values = text.split(',').map((v) => v.trim()).filter((v) => v !== '');
	}

	const ids = new Set<number>();
	for (const v of values) {
		const n = toNumberOrNull(v);
		if (n != null) ids.add(n);
	}
	return ids;
};

const normalizeExtendedUser = (user: Record<string, any>) => {
	const out: Record<string, any> = { ...user };

	out.user_id = toNumberOrNull(out.user_id);
	out.scout = toBoolOrNull(out.scout);

	out.born_on = nullIfEmptyString(out.born_on);
	out.PartA = nullIfEmptyString(out.PartA);
	out.PartB = nullIfEmptyString(out.PartB);
	out.PartC = nullIfEmptyString(out.PartC);
	out.date_joined = nullIfEmptyString(out.date_joined);

	if ('txtOptOut' in out) {
		out.txtOptOut = toBoolOrNull(out.txtOptOut);
	}

	if (Array.isArray(out.patrol_id)) {
		out.patrol_id = out.patrol_id.map((p: any) => toNumberOrNull(p)).filter((p: any) => p != null);
	}

	if (Array.isArray(out.households)) {
		out.households = out.households
			.map((h: any) => {
				if (h && typeof h === 'object') {
					const household_id = toNumberOrNull((h as any).household_id);
					return household_id == null ? null : { ...h, household_id };
				}
				return h;
			})
			.filter((h: any) => h != null);
	}

	if (Array.isArray(out.leadership_positions)) {
		out.leadership_positions = out.leadership_positions
			.map((p: any) => {
				if (!p || typeof p !== 'object') return p;
				const position_number = toNumberOrNull((p as any).position_number);
				if (position_number == null) return null;
				return {
					...p,
					position_type_number: toNumberOrNull((p as any).position_type_number),
					position_number,
					start_date: applySentinelDate((p as any).start_date, '2000-01-01'),
					end_date: applySentinelDate((p as any).end_date, '2999-12-31'),
				};
			})
			.filter((p: any) => p != null);
	}

	if (Array.isArray(out.training)) {
		out.training = out.training
			.map((t: any) => {
				if (!t || typeof t !== 'object') return t;
				const training_id = toNumberOrNull((t as any).training_id);
				if (training_id == null) return null;
				return {
					...t,
					training_id,
					training_number: toNumberOrNull((t as any).training_number),
					completed_on: applySentinelDate((t as any).completed_on, '2000-01-01'),
					expires_on: applySentinelDate((t as any).expires_on, '2999-12-31'),
				};
			})
			.filter((t: any) => t != null);
	}

	if (Array.isArray(out.ranks)) {
		out.ranks = out.ranks
			.map((r: any) => {
				if (!r || typeof r !== 'object') return r;
				return {
					...r,
					name: cleanName((r as any).name),
					completed_on: nullIfEmptyString((r as any).completed_on),
				};
			})
			.filter((r: any) => r != null);
	}

	if (Array.isArray(out.merit_badges)) {
		out.merit_badges = out.merit_badges
			.map((r: any) => {
				if (!r || typeof r !== 'object') return r;
				return {
					...r,
					name: cleanName((r as any).name),
					completed_on: nullIfEmptyString((r as any).completed_on),
				};
			})
			.filter((r: any) => r != null);
	}

	return out;
};

async function fetchDetailedUsersById(
	ctx: IExecuteFunctions,
	userIds: number[],
	options?: {
		debugMode?: boolean;
		fallbackById?: Map<number, any>;
		errorPrefix?: string;
	},
): Promise<Map<number, any>> {
	const debugMode = options?.debugMode ?? false;
	const fallbackById = options?.fallbackById;
	const errorPrefix = options?.errorPrefix ?? 'GET /v1/users/{id} failed';

	const out = new Map<number, any>();
	const workerCount = Math.min(USER_DETAIL_CONCURRENCY, Math.max(1, userIds.length));
	let cursor = 0;

	const worker = async () => {
		while (true) {
			const index = cursor++;
			if (index >= userIds.length) break;

			const userId = userIds[index];
			if (userId === undefined) break;
			try {
				const resp = await troopTrackRequest(ctx, 'GET', `/v1/users/${userId}`);
				const userObj = resp?.user ?? resp;
				if (userObj && typeof userObj === 'object') {
					out.set(userId, { ...userObj, user_id: (userObj as any).user_id ?? userId });
				} else if (fallbackById?.has(userId)) {
					out.set(userId, { ...(fallbackById.get(userId) as any), user_id: userId });
				} else {
					out.set(userId, { user_id: userId });
				}
			} catch (e) {
				if (debugMode) {
					const msg = e instanceof Error ? e.message : String(e);
					throw new Error(`${errorPrefix}: GET /v1/users/${userId} failed: ${msg}`);
				}

				if (fallbackById?.has(userId)) {
					out.set(userId, { ...(fallbackById.get(userId) as any), user_id: userId });
				} else {
					out.set(userId, { user_id: userId });
				}
			}
		}
	};

	if (workerCount === 0) {
		return out;
	}

	await Promise.all(Array.from({ length: workerCount }, async () => worker()));
	return out;
}

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
		'getHouseholdEmails',
		'createAssignments',
	]),
	async execute(ctx, items, itemIndex, operation) {
		if (operation === 'createAssignments') {
			return await positionsResource.execute(ctx, items, itemIndex, 'createAssignments');
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
			const excludeUserIdsRaw = ctx.getNodeParameter('excludeUserIds', itemIndex, '') as string;
			const excludeUserIds = parseExcludeUserIds(excludeUserIdsRaw);

			if (returnType === 'simple') {
				// Old Get Many (Simple) behavior
				const raw = await troopTrackRequest(ctx, 'GET', '/v1/events/types', {}, {});
				const wrapper = Array.isArray(raw) ? raw[0] : raw;

				const users = Array.isArray(wrapper?.users) ? wrapper.users : [];
				return users.map((u: any) => ({
					user_id: u?.user_id,
					name: u?.name,
					scout: u?.scout,
				})).filter((u: any) => {
					const id = toNumberOrNull(u?.user_id);
					return id == null || !excludeUserIds.has(id);
				});
			}

			if (returnType === 'extended') {
				const dataToInclude = ctx.getNodeParameter('dataToInclude', itemIndex, []) as string[];
				const debugMode = ctx.getNodeParameter('debugMode', itemIndex, false) as boolean;
				const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', itemIndex, '') as string;
				const normalizeForDatabaseLoad = ctx.getNodeParameter(
					'normalizeForDatabaseLoad',
					itemIndex,
					false,
				) as boolean;

				// 1) Seed via the same source as Simple: /v1/events/types -> wrapper.users
				const seedRaw = await troopTrackRequest(ctx, 'GET', '/v1/events/types', {}, {});
				const seedWrapper = Array.isArray(seedRaw) ? seedRaw[0] : seedRaw;
				const seedUsers: any[] = Array.isArray(seedWrapper?.users) ? seedWrapper.users : [];

				const userIds: number[] = seedUsers
					.map((u: any) => Number(u?.user_id))
					.filter((n: number) => Number.isFinite(n) && n > 0);

				// 2) Fetch full API payload for each user via GET /v1/users/{id} using bounded concurrency.
				const detailedById = await fetchDetailedUsersById(ctx, userIds, {
					debugMode,
					errorPrefix: 'Users > Get Many > Extended',
				});
				const detailedUsers: any[] = userIds.map((userId) => detailedById.get(userId) ?? { user_id: userId });

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

				let normalized = enriched.map((u) => normalizeExtendedUser(u));

				if (excludeUserIds.size > 0) {
					normalized = normalized.filter((u: any) => {
						const id = toNumberOrNull(u?.user_id);
						return id == null || !excludeUserIds.has(id);
					});
				}

				if (!normalizeForDatabaseLoad) {
					return normalized;
				}

				// Build database-ready rowsets (mirrors workflow Code nodes)
				const members_rows = normalized.map((j: any) =>
					Object.fromEntries(
						Object.entries({
							user_id: j.user_id,
							first_name: j.first_name,
							last_name: j.last_name,
							email: j.email,
							cell_phone: j.cell_phone,
							gender: j.gender,
							scout: j.scout,
							current_position: j.current_position,
							current_rank: j.current_rank,
							born_on: j.born_on,
							PartA: j.PartA,
							PartB: j.PartB,
							PartC: j.PartC,
							date_joined: j.date_joined,
							money_account_balance: j.money_account_balance,
							user_name: j.user_name,
							txtOptOut: j.txtOptOut,
							BSA_id: j.BSA_id,
							allergies: j.allergies,
						}).filter(([, v]) => v !== undefined),
					),
				);

				// Flatten Updates for Member Patrol Upsert
				const member_patrol_rows: Array<{ user_id: number | null; patrol_id: number }> = [];
				const seenPatrol = new Set<string>();
				for (const j of normalized) {
					const uid = j.user_id as number | null;
					const plist = Array.isArray(j.patrol_id) ? j.patrol_id : [];
					for (const p of plist) {
						const pid = toNumberOrNull(p);
						if (pid == null) continue;
						const key = `${uid}::${pid}`;
						if (seenPatrol.has(key)) continue;
						seenPatrol.add(key);
						member_patrol_rows.push({ user_id: uid, patrol_id: pid });
					}
				}

				// Flatten Updates for Member Household Upsert
				const member_household_rows: Array<{ user_id: number | null; household_id: number }> = [];
				const seenHousehold = new Set<string>();
				for (const j of normalized) {
					const uid = j.user_id as number | null;
					const households = Array.isArray(j.households) ? j.households : [];
					for (const h of households) {
						const hid = toNumberOrNull((h as any)?.household_id);
						if (hid == null) continue;
						const key = `${uid}::${hid}`;
						if (seenHousehold.has(key)) continue;
						seenHousehold.add(key);
						member_household_rows.push({ user_id: uid, household_id: hid });
					}
				}

				// Flatten Updates for Member Leadership Positions Upsert
				const member_leadership_rows: Array<{
					user_id: number | null;
					position_type_number: number | null;
					position_number: number;
					start_date: string | null;
					end_date: string | null;
				}> = [];
				const seenLeadership = new Set<string>();
				for (const j of normalized) {
					const uid = j.user_id as number | null;
					const plist = Array.isArray(j.leadership_positions) ? j.leadership_positions : [];
					for (const p of plist) {
						const position_type_number = toNumberOrNull((p as any)?.position_type_number);
						const position_number = toNumberOrNull((p as any)?.position_number);
						if (position_number == null) continue;
						const key = `${uid}::${position_number}`;
						if (seenLeadership.has(key)) continue;
						seenLeadership.add(key);
						member_leadership_rows.push({
							user_id: uid,
							position_type_number,
							position_number,
							start_date: (p as any)?.start_date ?? null,
							end_date: (p as any)?.end_date ?? null,
						});
					}
				}

				// Flatten Updates for Member Leadership Positions Upsert1 (training)
				const member_training_rows: Array<{
					user_id: number | null;
					training_id: number;
					training_number: number | null;
					completed_on: string | null;
					expires_on: string | null;
					name: string | null;
				}> = [];
				const seenTraining = new Set<string>();
				let hasTrainingSource = false;
				for (const j of normalized) {
					const uid = j.user_id as number | null;
					const plist = Array.isArray(j.training)
						? j.training
						: Array.isArray((j as any).training_trackers)
							? (j as any).training_trackers
							: [];
					if (plist.length > 0) hasTrainingSource = true;
					for (const p of plist) {
						if (!p || typeof p !== 'object') continue;
						const rr = Object.fromEntries(
							Object.entries({
								...(p as Record<string, any>),
								completed_on: applySentinelDate((p as any).completed_on, '2000-01-01'),
								expires_on: applySentinelDate((p as any).expires_on, '2999-12-31'),
							}).filter(([, v]) => v !== undefined),
						);
						const training_id = toNumberOrNull((rr as any)?.training_id);
						if (training_id == null) continue;
						const idPart =
							(training_id as number | null) ??
							toNumberOrNull((rr as any)?.training_number) ??
							(rr as any)?.name ??
							'';
						const key = `${uid}::${idPart}`;
						if (seenTraining.has(key)) continue;
						seenTraining.add(key);
						member_training_rows.push({
							user_id: uid,
							training_id,
							training_number: toNumberOrNull((rr as any)?.training_number),
							completed_on: (rr as any)?.completed_on ?? null,
							expires_on: (rr as any)?.expires_on ?? null,
							name: (rr as any)?.name ?? null,
						});
					}
				}

				// Flatten Updates for Member Counseled MB Upsert
				const member_counseled_mb_rows: Array<{ user_id: number | null; mb_name: string }> = [];
				const seenCounseled = new Set<string>();
				if (wants.counseledMeritBadges) {
					for (const j of normalized) {
						const uid = j.user_id as number | null;
						const plist = Array.isArray(j.counseled_MBs) ? j.counseled_MBs : [];
						for (const p of plist) {
							const mb_name = typeof p === 'string' ? p : String(p ?? '');
							if (!mb_name) continue;
							const key = `${uid}::${mb_name}`;
							if (seenCounseled.has(key)) continue;
							seenCounseled.add(key);
							member_counseled_mb_rows.push({ user_id: uid, mb_name });
						}
					}
				}

				// Create Rank Entries (Scouts only)
				const member_ranks_rows: Array<Record<string, any>> = [];
				const seenRanks = new Set<string>();
				let hasRanksSource = false;
				for (const j of normalized) {
					if (j.scout === false) continue;
					const uid = j.user_id as number | null;
					const ranks = Array.isArray(j.ranks)
						? j.ranks
						: Array.isArray((j as any).rank_trackers)
							? (j as any).rank_trackers
							: [];
					if (ranks.length > 0) hasRanksSource = true;
					for (const r of ranks) {
						if (!r || typeof r !== 'object') continue;
						const cleanedName = cleanName((r as any).name);
						const rr = Object.fromEntries(
							Object.entries({
								...(r as Record<string, any>),
								name: cleanedName,
								completed_on: nullIfEmptyString((r as any).completed_on),
							}).filter(([, v]) => v !== undefined),
						);
						const idPart =
							(rr as any).user_achievement_id ?? (rr as any).achievement_id ?? cleanedName ?? '';
						const key = `${uid}::${idPart}`;
						if (seenRanks.has(key)) continue;
						seenRanks.add(key);
						member_ranks_rows.push({ user_id: uid, ...rr });
					}
				}

				// Create MB Entries (Scouts only)
				const member_mbs_adv_rows: Array<Record<string, any>> = [];
				const seenMbs = new Set<string>();
				let hasMbsSource = false;
				for (const j of normalized) {
					if (j.scout === false) continue;
					const uid = j.user_id as number | null;
					const badges = Array.isArray(j.merit_badges)
						? j.merit_badges
						: Array.isArray((j as any).merit_badge_trackers)
							? (j as any).merit_badge_trackers
							: [];
					if (badges.length > 0) hasMbsSource = true;
					for (const r of badges) {
						if (!r || typeof r !== 'object') continue;
						const cleanedName = cleanName((r as any).name);
						const rr = Object.fromEntries(
							Object.entries({
								...(r as Record<string, any>),
								name: cleanedName,
								completed_on: nullIfEmptyString((r as any).completed_on),
							}).filter(([, v]) => v !== undefined),
						);
						const idPart =
							(rr as any).user_achievement_id ?? (rr as any).achievement_id ?? cleanedName ?? '';
						const key = `${uid}::${idPart}`;
						if (seenMbs.has(key)) continue;
						seenMbs.add(key);
						member_mbs_adv_rows.push({ user_id: uid, ...rr });
					}
				}

				const payload: Record<string, any> = {
					members_rows,
					member_household_rows,
					...(hasTrainingSource ? { member_training_rows } : {}),
					member_leadership_rows,
					member_patrol_rows,
					...(hasRanksSource ? { member_ranks_rows } : {}),
					...(hasMbsSource ? { member_mbs_adv_rows } : {}),
				};

				if (wants.counseledMeritBadges) {
					payload.member_counseled_mb_rows = member_counseled_mb_rows;
				}

				const DEBUG_DB_NORMALIZE = false;
				if (DEBUG_DB_NORMALIZE) {
					const firstRank = member_ranks_rows[0] ?? null;
					const firstMb = member_mbs_adv_rows[0] ?? null;
					const firstTraining = member_training_rows[0] ?? null;
					if (hasRanksSource && member_ranks_rows.length === 0) {
						console.log('DB normalize warning: ranks source present but no rows', { firstRank });
					}
					if (hasMbsSource && member_mbs_adv_rows.length === 0) {
						console.log('DB normalize warning: merit badges source present but no rows', { firstMb });
					}
					if (hasTrainingSource && member_training_rows.length === 0) {
						console.log('DB normalize warning: training source present but no rows', { firstTraining });
					}
				}

				return payload;
			}

			// returnType === 'api'
			const raw = await troopTrackRequest(ctx, 'GET', '/v1/users', {}, {});
			const wrapper = Array.isArray(raw) ? raw[0] : raw;

			// Adjust this depending on your existing /v1/users response shaping
			const users = Array.isArray(wrapper?.users) ? wrapper.users : Array.isArray(wrapper) ? wrapper : [];
			if (excludeUserIds.size === 0) return users;
			return users.filter((u: any) => {
				const id = toNumberOrNull(u?.user_id);
				return id == null || !excludeUserIds.has(id);
			});
		}

		if (operation === 'getHouseholdEmails') {
			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const excludeOtherAdultHouseholdEmailsForAdultsOnly = ctx.getNodeParameter(
				'excludeOtherAdultHouseholdEmailsForAdultsOnly',
				0,
				false,
			) as boolean;

			const rawUsers = await troopTrackRequest(ctx, 'GET', '/v1/users', {}, {});
			const usersWrapper = Array.isArray(rawUsers) ? rawUsers[0] : rawUsers;
			const seedUsers = Array.isArray(usersWrapper?.users)
				? usersWrapper.users
				: Array.isArray(usersWrapper)
					? usersWrapper
					: [];

			const seedById = new Map<number, any>();
			const seedUserIds: number[] = [];
			for (const user of seedUsers) {
				const userId = toNumberOrNull(user?.user_id);
				if (userId == null || userId <= 0) continue;
				if (!seedById.has(userId)) {
					seedById.set(userId, user);
					seedUserIds.push(userId);
				}
			}

			const detailedById = await fetchDetailedUsersById(ctx, seedUserIds, {
				fallbackById: seedById,
				errorPrefix: 'Users > Get Household Emails',
			});

			const householdToUsers = new Map<number, any[]>();
			for (const user of detailedById.values()) {
				const households = Array.isArray(user?.households) ? user.households : [];
				for (const household of households) {
					const householdId = toNumberOrNull((household as any)?.household_id);
					if (householdId == null || householdId <= 0) continue;
					const current = householdToUsers.get(householdId) ?? [];
					current.push(user);
					householdToUsers.set(householdId, current);
				}
			}

			const normalizeEmail = (value: any): string | null => {
				if (value == null) return null;
				const email = String(value).trim();
				return email === '' ? null : email;
			};

			const dedupeEmails = (emails: string[]): string[] => {
				const seen = new Set<string>();
				const out: string[] = [];
				for (const email of emails) {
					const normalized = email.trim();
					if (!normalized) continue;
					const key = normalized.toLowerCase();
					if (seen.has(key)) continue;
					seen.add(key);
					out.push(normalized);
				}
				return out;
			};

			const enriched = items.map((item) => {
				const row = item.json as Record<string, any>;
				const selectedUserId = toNumberOrNull(row?.[userIdField]);
				if (selectedUserId == null || selectedUserId <= 0) {
					return { ...row, household_emails: [] as string[] };
				}

				const selectedUser = detailedById.get(selectedUserId);
				if (!selectedUser) {
					return { ...row, household_emails: [] as string[] };
				}

				const selectedEmail = normalizeEmail(selectedUser?.email);
				const selectedIsAdult = toBoolOrNull(selectedUser?.scout) === false;

				if (selectedIsAdult && excludeOtherAdultHouseholdEmailsForAdultsOnly) {
					return {
						...row,
						household_emails: selectedEmail ? [selectedEmail] : [],
					};
				}

				const householdIds = (Array.isArray(selectedUser?.households) ? selectedUser.households : [])
					.map((household: any) => toNumberOrNull(household?.household_id))
					.filter((id: number | null): id is number => id != null && id > 0);

				const emailCandidates: string[] = [];
				if (selectedEmail) {
					emailCandidates.push(selectedEmail);
				}

				for (const householdId of householdIds) {
					const householdUsers = householdToUsers.get(householdId) ?? [];
					for (const householdUser of householdUsers) {
						const isAdult = toBoolOrNull(householdUser?.scout) === false;
						if (!isAdult) continue;
						const email = normalizeEmail(householdUser?.email);
						if (email) {
							emailCandidates.push(email);
						}
					}
				}

				return {
					...row,
					household_emails: dedupeEmails(emailCandidates),
				};
			});

			return enriched;
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
