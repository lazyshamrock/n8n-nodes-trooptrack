import type { ResourceHandler } from './types.js';
import { TroopTrackPuppeteerSession } from '../puppeteer/PuppeteerSession.js';
import { scrapePositions } from '../puppeteer/scrapers/positions.js';
import { createPositionAssignments } from '../puppeteer/scrapers/positions.createAssignments.js';

export const positionsResource: ResourceHandler = {
	resource: 'positions',
	runOnceOperations: new Set(['getMany', 'createAssignments']),
	async execute(ctx, items, _itemIndex, operation) {
		if (operation === 'getMany') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number; // currently unused
			const demoScoutUserId = ctx.getNodeParameter('demoScoutUserId', 0) as number;
			const demoAdultUserId = ctx.getNodeParameter('demoAdultUserId', 0) as number;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}
			if (!demoScoutUserId || !demoAdultUserId) {
				throw new Error('demoScoutUserId and demoAdultUserId are required');
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

				return positions;
			} catch (e) {
				if (debugMode) {
					throw e;
				}
				return [];
			}
		}

		if (operation === 'createAssignments') {
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number;

			// Field mapping (from node UI)
			const mapping = ctx.getNodeParameter('fieldMapping', 0, {}) as any;

			const userIdField = String(mapping.userIdField ?? 'user_id');
			const positionIdField = String(mapping.positionIdField ?? 'position_id');
			const startDateField = String(mapping.startDateField ?? 'start_date');
			const endDateField = String(mapping.endDateField ?? 'end_date');

			// Chromium options (from node UI)
			const chromiumParam = ctx.getNodeParameter('chromiumOptions', 0, {}) as any;
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
				const credentials = (await ctx.getCredentials('troopTrackApi')) as Record<string, any>;
				const auth = {
					tt_sub_domain: String(credentials.tt_sub_domain ?? credentials.subdomain ?? '').trim(),
					tt_username: String(credentials.tt_username ?? credentials.username ?? '').trim(),
					tt_password: String(credentials.tt_password ?? credentials.password ?? '').trim(),
				};

				if (!auth.tt_sub_domain || !auth.tt_username || !auth.tt_password) {
					throw new Error('Missing TroopTrack credentials fields required for web login');
				}

				const timeoutForSession =
					Number.isFinite(navigationTimeoutMs) && navigationTimeoutMs > 0 ? navigationTimeoutMs : 120000;
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

				return inputRows.map((row, idx) => {
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
				return inputRows.map((row) => ({
					...row,
					created: false,
					error: String((e as any)?.message ?? e),
				}));
			}
		}

		throw new Error(`Unsupported positions operation: ${operation}`);
	},
};
