import type { ResourceHandler } from './types';
import { troopTrackRequest } from '../GenericFunctions';

const RSVP_CONCURRENCY = 12;

function parseUserIds(value: unknown, fieldName: string): number[] {
	let raw: unknown[] = [];

	if (Array.isArray(value)) {
		raw = value;
	} else if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return [];
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				raw = parsed;
			} else {
				throw new Error(`Field "${fieldName}" must be a JSON array`);
			}
		} catch (error: any) {
			throw new Error(`Field "${fieldName}" must be a JSON array of user IDs. ${error?.message ?? ''}`.trim());
		}
	} else if (value == null) {
		return [];
	} else {
		throw new Error(`Field "${fieldName}" must be a JSON array of user IDs`);
	}

	const ids = raw.map((entry) => Number(entry));
	const invalid = ids.find((id) => !Number.isInteger(id) || id <= 0);
	if (invalid !== undefined) {
		throw new Error(`Field "${fieldName}" contains an invalid user ID: ${String(invalid)}`);
	}

	return Array.from(new Set(ids));
}

function buildEventTrackers(
	statusGroups: Array<{ statusKey: 'status_cd' | 'attendance_status_cd'; statusValue: string; userIds: number[] }>,
): Array<{ user_id: number; status_cd?: string; attendance_status_cd?: string }> {
	const seenUsers = new Map<number, string>();
	const trackers: Array<{ user_id: number; status_cd?: string; attendance_status_cd?: string }> = [];

	for (const group of statusGroups) {
		for (const userId of group.userIds) {
			const alreadyAssigned = seenUsers.get(userId);
			if (alreadyAssigned !== undefined) {
				throw new Error(
					`User ID ${userId} is assigned to multiple status groups (${alreadyAssigned}, ${group.statusValue})`,
				);
			}

			seenUsers.set(userId, group.statusValue);
			if (group.statusKey === 'status_cd') {
				trackers.push({ user_id: userId, status_cd: group.statusValue });
			} else {
				trackers.push({ user_id: userId, attendance_status_cd: group.statusValue });
			}
		}
	}

	return trackers;
}

function getErrorStatusCode(err: unknown): number | undefined {
	const status = (err as any)?.statusCode ?? (err as any)?.response?.status ?? (err as any)?.cause?.statusCode;

	if (typeof status === 'number') {
		return status;
	}

	if (status !== undefined && status !== null) {
		const parsed = Number(status);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return undefined;
}

async function submitRsvpsWithConcurrency(
	ctx: Parameters<ResourceHandler['execute']>[0],
	eventId: number,
	eventTrackers: Array<{ user_id: number; status_cd?: string; attendance_status_cd?: string }>,
): Promise<number[]> {
	const unauthorizedUserIds = new Set<number>();
	const workerCount = Math.min(RSVP_CONCURRENCY, Math.max(1, eventTrackers.length));
	let cursor = 0;

	const worker = async () => {
		while (true) {
			const index = cursor++;
			if (index >= eventTrackers.length) break;

			const tracker = eventTrackers[index];
			if (!tracker) break;

			try {
				if (!tracker.status_cd) {
					throw new Error(`Missing RSVP status for user ID ${tracker.user_id}`);
				}

				await troopTrackRequest(ctx, 'PUT', `/v1/events/${eventId}/rsvp`, {}, {
					user_id: tracker.user_id,
					status_cd: tracker.status_cd,
				});
			} catch (error: any) {
				if (getErrorStatusCode(error) === 401) {
					unauthorizedUserIds.add(tracker.user_id);
					continue;
				}
				throw error;
			}
		}
	};

	if (workerCount === 0) {
		return [];
	}

	await Promise.all(Array.from({ length: workerCount }, async () => worker()));
	return eventTrackers
		.map((tracker) => tracker.user_id)
		.filter((userId) => unauthorizedUserIds.has(userId));
}

export const eventsResource: ResourceHandler = {
	resource: 'events',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const startOn = ctx.getNodeParameter('startOn', itemIndex) as string;
			const endOn = ctx.getNodeParameter('endOn', itemIndex) as string;

			const resp = await troopTrackRequest(ctx, 'GET', '/v1/events', {
				start_on: startOn,
				end_on: endOn,
			});

			// TroopTrack returns { events: [...] }
			return Array.isArray(resp?.events) ? resp.events : [];
		}

		if (operation === 'getById') {
			const eventId = ctx.getNodeParameter('eventId', itemIndex) as number;
			const resp = await troopTrackRequest(ctx, 'GET', `/v1/events/${eventId}`);

			// Some APIs return { event: {...} }, others return the object directly.
			return resp;
		}

		if (operation === 'create') {
			const createBody = ctx.getNodeParameter('createBody', itemIndex) as object;
			const resp = await troopTrackRequest(ctx, 'POST', '/v1/events', {}, createBody);

			return resp;
		}

		if (operation === 'getTypes') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/events/types');

			// Prefer the common wrapper shape; fall back to resp if it is already an array.
			if (Array.isArray(resp?.event_types)) {
				return resp.event_types;
			}
			if (Array.isArray(resp?.types)) {
				return resp.types;
			}
			if (Array.isArray(resp)) {
				return resp;
			}
			return [];
		}

		if (operation === 'rsvp') {
			const eventId = ctx.getNodeParameter('eventId', itemIndex) as number;
			const rsvpYesUserIds = parseUserIds(
				ctx.getNodeParameter('rsvpYesUserIds', itemIndex, []),
				'rsvpYesUserIds',
			);
			const rsvpNoUserIds = parseUserIds(
				ctx.getNodeParameter('rsvpNoUserIds', itemIndex, []),
				'rsvpNoUserIds',
			);
			const rsvpTbdUserIds = parseUserIds(
				ctx.getNodeParameter('rsvpTbdUserIds', itemIndex, []),
				'rsvpTbdUserIds',
			);

			const eventTrackers = buildEventTrackers([
				{ statusKey: 'status_cd', statusValue: 'yes', userIds: rsvpYesUserIds },
				{ statusKey: 'status_cd', statusValue: 'no', userIds: rsvpNoUserIds },
				{ statusKey: 'status_cd', statusValue: 'tbd', userIds: rsvpTbdUserIds },
			]);

			if (eventTrackers.length === 0) {
				throw new Error('At least one RSVP user ID is required');
			}

			const notInvited = await submitRsvpsWithConcurrency(
				ctx,
				eventId,
				eventTrackers,
			);

			const latestEventDetails = await troopTrackRequest(ctx, 'GET', `/v1/events/${eventId}`);
			if (latestEventDetails && typeof latestEventDetails === 'object' && !Array.isArray(latestEventDetails)) {
				return {
					...latestEventDetails,
					not_invited: notInvited,
				};
			}

			return {
				event: latestEventDetails,
				not_invited: notInvited,
			};
		}

		if (operation === 'attendance') {
			const eventId = ctx.getNodeParameter('eventId', itemIndex) as number;
			const attendanceAttendedUserIds = parseUserIds(
				ctx.getNodeParameter('attendanceAttendedUserIds', itemIndex, []),
				'attendanceAttendedUserIds',
			);
			const attendanceDidNotAttendUserIds = parseUserIds(
				ctx.getNodeParameter('attendanceDidNotAttendUserIds', itemIndex, []),
				'attendanceDidNotAttendUserIds',
			);
			const attendanceNoClueUserIds = parseUserIds(
				ctx.getNodeParameter('attendanceNoClueUserIds', itemIndex, []),
				'attendanceNoClueUserIds',
			);

			const eventTrackers = buildEventTrackers([
				{ statusKey: 'attendance_status_cd', statusValue: '1', userIds: attendanceAttendedUserIds },
				{ statusKey: 'attendance_status_cd', statusValue: '0', userIds: attendanceDidNotAttendUserIds },
				{ statusKey: 'attendance_status_cd', statusValue: '2', userIds: attendanceNoClueUserIds },
			]);

			if (eventTrackers.length === 0) {
				throw new Error('At least one attendance user ID is required');
			}

			return troopTrackRequest(ctx, 'POST', `/v1/events/${eventId}/attendance`, {}, {
				event_trackers: eventTrackers,
			});
		}

		throw new Error(`Unsupported events operation: ${operation} (index ${itemIndex})`);
	},
};
