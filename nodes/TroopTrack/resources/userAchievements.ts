import type { ResourceHandler } from './types.js';
import { troopTrackRequest } from '../GenericFunctions.js';

const normalizeId = (value: any): number | null => {
	if (value == null) return null;
	if (typeof value === 'string' && value.trim() === '') return null;
	const num = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(num) ? num : null;
};

const readMapped = (item: Record<string, any>, field: string): unknown => {
	if (!field) return undefined;
	if (!field.includes('.')) return item[field];

	const parts = field.split('.');
	let cur: any = item;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = cur[p];
	}
	return cur;
};

const toScalarFieldValue = (value: unknown): string | number | null => {
	if (typeof value === 'string' || typeof value === 'number') return value;
	return null;
};

export const userAchievementsResource: ResourceHandler = {
	resource: 'userAchievements',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'getMany') {
			const resp = await troopTrackRequest(ctx, 'GET', '/v1/user_achievements/parameters');

			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const awardTypes = root?.award_types;

			if (Array.isArray(awardTypes)) {
				return awardTypes;
			}
			return [];
		}

		if (operation === 'getById') {
			const userAchievementId = ctx.getNodeParameter('userAchievementId', itemIndex) as number;
			const awardTypeId = ctx.getNodeParameter('awardTypeId', itemIndex) as number;

			return await troopTrackRequest(
				ctx,
				'GET',
				`/v1/user_achievements/${userAchievementId}`,
				{ award_type_id: awardTypeId },
			);
		}

		if (operation === 'markCompleted') {
			const items = _items;
			const userAchievementIdFieldName = ctx.getNodeParameter('user_achievement_id', 0) as string;
			const awardTypeIdFieldName = ctx.getNodeParameter('award_type_id', 0) as string;
			const completedOnFieldName = ctx.getNodeParameter('completed_on', 0) as string;

			const inputRows = items.map((it) => (it.json ?? {}) as Record<string, any>);
			const outputRows: Array<Record<string, any>> = [];

			for (const row of inputRows) {
				const userAchievementIdValue =
					toScalarFieldValue(readMapped(row, userAchievementIdFieldName)) ?? null;
				const awardTypeIdValue =
					toScalarFieldValue(readMapped(row, awardTypeIdFieldName)) ?? null;
				const completedOnValue =
					toScalarFieldValue(readMapped(row, completedOnFieldName)) ?? null;

				const userAchievementId = normalizeId(userAchievementIdValue);
				const awardTypeId = normalizeId(awardTypeIdValue);
				const completedOn =
					typeof completedOnValue === 'number'
						? String(completedOnValue)
						: typeof completedOnValue === 'string'
							? completedOnValue
							: null;

				const errors: string[] = [];
				if (userAchievementId == null) {
					errors.push(`Invalid ${userAchievementIdFieldName}`);
				}
				if (awardTypeId == null) {
					errors.push(`Invalid ${awardTypeIdFieldName}`);
				}
				if (completedOn == null || completedOn.trim() === '') {
					errors.push(`Invalid ${completedOnFieldName}`);
				}

				if (errors.length > 0) {
					outputRows.push({
						...row,
						achievement_completed: false,
						errors,
					});
					continue;
				}

				try {
					const response = await troopTrackRequest(
						ctx,
						'POST',
						`/v1/user_achievements/${userAchievementId}`,
						{},
						{
							award_type_id: awardTypeId,
							achievement: {
								completed_on: completedOn,
								percent_complete: 100,
							},
						},
					);

					outputRows.push({
						...row,
						achievement_completed: true,
						response,
					});
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					outputRows.push({
						...row,
						achievement_completed: false,
						errors: [msg],
					});
				}
			}

			return outputRows;
		}

		throw new Error(`Unsupported userAchievements operation: ${operation} (index ${itemIndex})`);
	},
};
