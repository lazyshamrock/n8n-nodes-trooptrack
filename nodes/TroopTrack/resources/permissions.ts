import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';
import { TroopTrackPuppeteerSession } from '../puppeteer/PuppeteerSession';
import { scrapePermissions } from '../puppeteer/scrapers/permissions';
import { setTroopTrackUserPermissions } from '../puppeteer/scrapers/permissionsSet';

export const permissionsResource: ResourceHandler = {
	resource: 'permissions',
	runOnceOperations: new Set(['getMany', 'setPermissions']),
	async execute(ctx, items, _itemIndex, operation) {
		if (operation === 'getMany') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			const debug: Record<string, any> = {
				puppeteer: {
					launched: false,
					finalUrl: null,
					privilegesUrl: null,
					resultCount: null,
				},
			};

			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number;
			const demoAdultUserId = ctx.getNodeParameter('demoAdultUserId', 0) as number;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}
			if (!demoAdultUserId) {
				throw new Error('demoAdultUserId is required');
			}

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

				let responseData: any = permissions;

				if (debugMode && Array.isArray(responseData)) {
					responseData = responseData.map((p: any) => ({ ...p, _debug: debug }));
				}

				return responseData;
			} catch (e) {
				if (debugMode) throw e;
				return [];
			}
		}

		if (operation === 'setPermissions') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			// These three parameters are the names of fields in the incoming JSON.
			// They should be strings like "user_id", "access_level", "granted_permissions".
			const userIdFieldName = ctx.getNodeParameter('user_id', 0) as string;
			const accessLevelFieldName = ctx.getNodeParameter('access_level', 0) as string;
			const grantedPermissionsFieldName = ctx.getNodeParameter('granted_permissions', 0) as string;

			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;

			// Support either delayMs/batchSize or delay/batch depending on how your description file is named.
			const getParamSafe = <T>(name: string, fallback: T): T => {
				try {
					return ctx.getNodeParameter(name, 0, fallback as any) as T;
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
			const tokenResp: any = await troopTrackRequest(ctx, 'GET', '/v1/tokens');

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
				return result;
			} catch (e) {
				if (debugMode) throw e;

				const msg = e instanceof Error ? e.message : String(e);
				// Non-debug mode: return inputs with an errors field populated
				return items.map((it) => ({
					...(it.json as Record<string, any>),
					errors: [msg],
				}));
			}
		}

		throw new Error(`Unsupported permissions operation: ${operation}`);
	},
};
