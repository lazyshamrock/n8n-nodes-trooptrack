import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import type { IHttpRequestOptions, IHttpRequestMethods } from 'n8n-workflow';

const TOKEN_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

type TroopTrackCredentials = {
	subdomain: string;
	username: string;
	password: string;
	partnerToken: string;
};

type TokenCacheEntry = {
	token: string;
	fetchedAtMs: number;
};

const tokenCache: Record<string, TokenCacheEntry> = {};

function assertNonEmpty(value: string, label: string): void {
	if (!value || !value.trim()) {
		throw new Error(`${label} is required`);
	}
}

function normalizeSubdomain(subdomain: string): string {
	return subdomain.trim().toLowerCase();
}

function getBaseUrl(subdomain: string): string {
	const clean = normalizeSubdomain(subdomain);
	return `https://${clean}.trooptrack.com/api`;
}

function safeStringify(value: unknown, maxLen = 800): string {
	try {
		const seen = new WeakSet<object>();
		const json = JSON.stringify(
			value,
			(_key, val) => {
				if (typeof val === 'object' && val !== null) {
					if (seen.has(val as object)) return '[Circular]';
					seen.add(val as object);
				}
				if (typeof val === 'bigint') return val.toString();
				return val;
			},
			0,
		);

		return json.length > maxLen ? json.slice(0, maxLen) : json;
	} catch (e: any) {
		// Last resort
		const msg = e?.message ? String(e.message) : 'unknown stringify error';
		const str = String(value);
		return `${str.slice(0, maxLen)} (safeStringify fallback: ${msg})`;
	}
}

async function getCreds(
	ctx: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
): Promise<TroopTrackCredentials> {
	const creds = (await ctx.getCredentials('troopTrackApi')) as unknown as TroopTrackCredentials;

	assertNonEmpty(creds?.subdomain, 'TroopTrack subdomain');
	assertNonEmpty(creds?.username, 'TroopTrack username');
	assertNonEmpty(creds?.password, 'TroopTrack password');
	assertNonEmpty(creds?.partnerToken, 'TroopTrack partner token');

	const sub = normalizeSubdomain(creds.subdomain);

	// Enforce subdomain-only input
	if (
		sub.includes('http://') ||
		sub.includes('https://') ||
		sub.includes('.') ||
		sub.includes('/') ||
		sub.includes(':') ||
		sub.includes(' ')
	) {
		throw new Error(
			'TroopTrack subdomain must be only the subdomain value (example: "troop457zelie"), not a full URL or host.',
		);
	}

	return {
		subdomain: sub,
		username: creds.username,
		password: creds.password,
		partnerToken: creds.partnerToken,
	};
}

function makeTokenCacheKey(creds: TroopTrackCredentials): string {
	return `${normalizeSubdomain(creds.subdomain)}::${creds.username.trim().toLowerCase()}`;
}

async function fetchUserToken(
	ctx: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	creds: TroopTrackCredentials,
): Promise<string> {
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${getBaseUrl(creds.subdomain)}/v1/tokens`,
		headers: {
			'X-Partner-Token': creds.partnerToken,
			'X-Username': creds.username,
			'X-User-Password': creds.password,
			Accept: 'application/json',
		},
		json: true,
	};

	const resp = await ctx.helpers.httpRequest(options);

	let token: string | undefined;

	if (Array.isArray(resp)) {
		token = resp?.[0]?.token;
	} else if (resp && typeof resp === 'object') {
		if (Array.isArray((resp as any).users)) token = (resp as any).users?.[0]?.token;
		if (!token && Array.isArray((resp as any).user)) token = (resp as any).user?.[0]?.token;
		if (!token && (resp as any).token) token = (resp as any).token;
	}

	if (!token) {
		const preview = typeof resp === 'string' ? resp.slice(0, 800) : safeStringify(resp, 800);
		throw new Error(
			`TroopTrack token response did not include a token. Response type: ${typeof resp}. Preview: ${preview}`,
		);
	}

	return token;
}

async function getValidUserToken(
	ctx: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	creds: TroopTrackCredentials,
	forceRefresh = false,
): Promise<string> {
	const key = makeTokenCacheKey(creds);
	const cached = tokenCache[key];

	if (!forceRefresh && cached?.token) {
		const age = Date.now() - cached.fetchedAtMs;
		if (age < TOKEN_CACHE_TTL_MS) return cached.token;
	}

	const token = await fetchUserToken(ctx, creds);
	tokenCache[key] = { token, fetchedAtMs: Date.now() };
	return token;
}

function isUnauthorized(err: any): boolean {
	const code = err?.statusCode ?? err?.response?.status ?? err?.cause?.statusCode;
	return code === 401;
}

function formatHttpError(err: any, method: string, endpoint: string): Error {
	const status =
		err?.statusCode ??
		err?.response?.status ??
		err?.cause?.statusCode ??
		err?.response?.statusCode;

	// Prefer API response payloads when present, but never try to stringify the whole error object.
	const body =
		err?.response?.data ??
		err?.response?.body ??
		err?.error ??
		err?.message;

	let preview: string;

	if (typeof body === 'string') {
		preview = body.slice(0, 800);
	} else {
		preview = safeStringify(body ?? {}, 800);
	}

	const formatted = new Error(
		`TroopTrack API error${status ? ` ${status}` : ''} for ${method} ${endpoint}. Response: ${preview}`,
	) as Error & { statusCode?: number };

	if (typeof status === 'number') {
		formatted.statusCode = status;
	} else if (status !== undefined && status !== null) {
		const parsedStatus = Number(status);
		if (Number.isFinite(parsedStatus)) {
			formatted.statusCode = parsedStatus;
		}
	}

	return formatted;
}

export async function troopTrackRequest(
	ctx: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: Record<string, any> = {},
	body: any = undefined,
): Promise<any> {
	const creds = await getCreds(ctx);

	const doRequest = async (userToken: string) => {
		const options: IHttpRequestOptions = {
			method,
			url: `${getBaseUrl(creds.subdomain)}${endpoint}`,
			qs,
			headers: {
				'X-Partner-Token': creds.partnerToken,
				'X-User-Token': userToken,
				Accept: 'application/json',
			},
			json: true,
		};

		if (body !== undefined) options.body = body;

		return ctx.helpers.httpRequest(options);
	};

	const token = await getValidUserToken(ctx, creds, false);

	try {
		return await doRequest(token);
	} catch (err: any) {
		if (!isUnauthorized(err)) {
			throw formatHttpError(err, method, endpoint);
		}

		const refreshedToken = await getValidUserToken(ctx, creds, true);

		try {
			return await doRequest(refreshedToken);
		} catch (err2: any) {
			throw formatHttpError(err2, method, endpoint);
		}
	}
}
