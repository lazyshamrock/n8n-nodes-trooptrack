import type { ResourceHandler } from './types';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
<<<<<<< HEAD
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
=======
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
>>>>>>> 44105df (2026-04-08)
import { troopTrackRequest } from '../GenericFunctions';
import { TroopTrackPuppeteerSession } from '../puppeteer/PuppeteerSession';
import { startTroopTrackMeritBadges } from '../puppeteer/scrapers/achievements.startMeritBadge';

type BlueCardInput = {
	user_id: number;
	achievement_id: number;
	counselor_id?: number;
	blue_card_remarks?: string;
};

const sleep = async (ms: number) => {
	if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
};

const normalizeId = (value: any): number | null => {
	if (value == null) return null;
	if (typeof value === 'string' && value.trim() === '') return null;
	const num = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(num) ? num : null;
};

const sanitizeRemarks = (value: any): string => {
	if (value == null) return '';
	const text = String(value);
	return text.trim();
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

const formatTimestamp = () => {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(
		d.getMinutes(),
	)}`;
};

const ensureDir = async (dir: string) => {
	await fs.mkdir(dir, { recursive: true });
};

const waitForPdfDownload = async (dir: string, timeoutMs: number) => {
	const start = Date.now();
	let lastPath = '';
	let lastSize = -1;

		while (Date.now() - start < timeoutMs) {
			const entries = await fs.readdir(dir);
			const pdfs = entries.filter((f) => f.toLowerCase().endsWith('.pdf'));
			if (pdfs.length > 0) {
				const firstPdf = pdfs[0];
				if (!firstPdf) {
					await sleep(500);
					continue;
				}
				const full = path.join(dir, firstPdf);
				const stat = await fs.stat(full);
				if (stat.size > 0 && full === lastPath && stat.size === lastSize) {
					return full;
				}
			lastPath = full;
			lastSize = stat.size;
		}
		await sleep(500);
	}

	throw new Error('Timed out waiting for blue card PDF download');
};

const waitForNamedPdf = async (dir: string, fileName: string, timeoutMs: number) => {
	const start = Date.now();
	const target = path.join(dir, fileName);
	let lastSize = -1;

	while (Date.now() - start < timeoutMs) {
		try {
			const stat = await fs.stat(target);
			if (stat.size > 0 && stat.size === lastSize) {
				return target;
			}
			lastSize = stat.size;
		} catch {
			// file not ready yet
		}
		await sleep(500);
	}

	throw new Error('Timed out waiting for blue card PDF download');
};

const dismissNotificationPopup = async (page: any) => {
	try {
		await page.evaluate(() => {
			const doc = (globalThis as any).document;
			const buttons = Array.from(doc.querySelectorAll('button, a')) as any[];
			const target = buttons.find((b) => ((b?.textContent || '').trim() || '').toLowerCase() === 'no thanks');
			if (target) {
				target.click();
			}
		});
	} catch {
		// ignore
	}
};

const waitForPdfInNewTab = async (page: any, timeoutMs: number) => {
	const browser = page.browser();
	const opener = page.target();
	const target = await browser.waitForTarget(
		(t: any) => t.opener() === opener || String(t.url() ?? '').toLowerCase().includes('blue_card_printer.pdf'),
		{ timeout: timeoutMs },
	);
	const pdfPage = await target.page();
	if (!pdfPage) throw new Error('Unable to access blue card PDF tab');

	try {
		await pdfPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => null);
	} catch {
		// ignore
	}

	const pdfResponse = await pdfPage.waitForResponse(
		(res: any) => {
			const url = String(res?.url?.() ?? '').toLowerCase();
			const headers = res?.headers ? res.headers() : {};
			const contentType = String(headers?.['content-type'] ?? '').toLowerCase();
			return (contentType.includes('application/pdf') && res?.status?.() === 200) || url.includes('blue_card_printer.pdf');
		},
		{ timeout: timeoutMs },
	);
	const buffer = await pdfResponse.buffer();
	await pdfPage.close().catch(() => {});
	return buffer;
};

const fetchPdfWithCookies = async (page: any, url: string): Promise<Uint8Array> => {
	const cookies = await page.cookies(url);
	const cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
	let userAgent = '';
	try {
		if (page && typeof page.userAgent === 'function') {
			userAgent = await page.userAgent();
		} else if (page && typeof page.evaluate === 'function') {
			userAgent = await page.evaluate(() => {
				const nav = (globalThis as any).navigator;
				return nav?.userAgent || '';
			});
		}
	} catch {
		userAgent = '';
	}
	const referer = page.url();

	const res = await fetch(url, {
		method: 'GET',
		headers: {
			Cookie: cookieHeader,
			...(userAgent ? { 'User-Agent': userAgent } : {}),
			Referer: referer,
			Accept: 'application/pdf',
		},
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch PDF ${res.status}`);
	}

	const arrayBuf = await res.arrayBuffer();
	return new Uint8Array(arrayBuf);
};

const pollFetchPdfWithCookies = async (
	page: any,
	url: string,
	timeoutMs: number,
	debug?: Record<string, any>,
): Promise<Uint8Array> => {
	const start = Date.now();
	let lastErr: string | null = null;
	while (Date.now() - start < timeoutMs) {
		try {
			const bytes = await fetchPdfWithCookies(page, url);
			if (isPdfBytes(bytes)) {
				return bytes;
			}
			lastErr = 'Fetched bytes were not a valid PDF';
		} catch (e) {
			lastErr = e instanceof Error ? e.message : String(e);
		}
		await sleep(500);
	}
	if (debug) {
		debug.pdfFetch = {
			url,
			lastErr,
		};
	}
	throw new Error(lastErr ?? 'Timed out waiting for PDF');
};

const waitForBlueCardPrinterResponse = async (page: any, timeoutMs: number) => {
	const resp = await page.waitForResponse(
		(res: any) => {
			const url = String(res?.url?.() ?? '');
			return url.includes('/achieve/blue_card_printer') && !url.endsWith('.pdf');
		},
		{ timeout: timeoutMs },
	);
	return resp;
};

const getLocationHeader = (res: any): string | null => {
	try {
		const headers = res?.headers ? res.headers() : {};
		const loc = headers?.location ?? headers?.Location ?? null;
		return typeof loc === 'string' && loc.trim() ? loc.trim() : null;
	} catch {
		return null;
	}
};

const waitForPdfResponseOnBrowser = async (browser: any, timeoutMs: number) => {
	return await new Promise<Uint8Array>((resolve, reject) => {
		let done = false;
		const timer = setTimeout(() => {
			if (done) return;
			done = true;
			cleanup();
			reject(new Error('Timed out waiting for PDF response'));
		}, timeoutMs);

		const onResponse = async (res: any) => {
			try {
				const url = String(res?.url?.() ?? '').toLowerCase();
				const headers = res?.headers ? res.headers() : {};
				const contentType = String(headers?.['content-type'] ?? '').toLowerCase();
				if (contentType.includes('application/pdf') || url.includes('blue_card_printer.pdf')) {
					const buf = await res.buffer();
					if (!done) {
						done = true;
						cleanup();
						resolve(buf);
					}
				}
			} catch (e) {
				if (!done) {
					done = true;
					cleanup();
					reject(e as Error);
				}
			}
		};

		const attachToPage = async (p: any) => {
			if (!p) return;
			p.on('response', onResponse);
		};

		const onTarget = async (t: any) => {
			try {
				const p = await t.page();
				if (p) await attachToPage(p);
			} catch {
				// ignore
			}
		};

		const cleanup = () => {
			clearTimeout(timer);
			try {
				browser.off('targetcreated', onTarget);
			} catch {
				// ignore
			}
			try {
				const pages = browser.pages?.();
				if (Array.isArray(pages)) {
					for (const p of pages) {
						try {
							p.off('response', onResponse);
						} catch {
							// ignore
						}
					}
				}
			} catch {
				// ignore
			}
		};

		browser.on('targetcreated', onTarget);

		try {
			const pages = browser.pages?.();
			if (Array.isArray(pages)) {
				for (const p of pages) {
					attachToPage(p);
				}
			}
		} catch {
			// ignore
		}
	});
};
<<<<<<< HEAD

const textWidthAtSize = (font: PDFFont, text: string, fontSize: number): number => {
	if (!text) return 0;
	return font.widthOfTextAtSize(text, fontSize);
};

const splitLongWordToWidth = (
	word: string,
	maxWidth: number,
	font: PDFFont,
	fontSize: number,
): string[] => {
	const parts: string[] = [];
	let current = '';

	for (const ch of word) {
		const next = `${current}${ch}`;
		if (textWidthAtSize(font, next, fontSize) <= maxWidth) {
			current = next;
			continue;
		}

		if (current) {
			parts.push(current);
			current = ch;
			continue;
		}

		// If a single glyph exceeds max width, emit it to avoid infinite loops.
		parts.push(ch);
		current = '';
	}

	if (current) {
		parts.push(current);
	}

	return parts;
};

const wrapTextToWidth = (
	text: string,
	maxWidth: number,
	font: PDFFont,
	fontSize: number,
): string[] => {
	const normalized = String(text ?? '').replace(/\r\n/g, '\n');
	const paragraphs = normalized.split('\n');
	const wrapped: string[] = [];

	for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
		const paragraph = paragraphs[pIndex] ?? '';
		const words = paragraph.trim().split(/\s+/).filter(Boolean);

		if (words.length === 0) {
			wrapped.push('');
			continue;
		}

		let line = '';
		for (const word of words) {
			const candidate = line ? `${line} ${word}` : word;
			if (textWidthAtSize(font, candidate, fontSize) <= maxWidth) {
				line = candidate;
				continue;
			}

			if (line) {
				wrapped.push(line);
			}

			if (textWidthAtSize(font, word, fontSize) <= maxWidth) {
				line = word;
				continue;
			}

			const parts = splitLongWordToWidth(word, maxWidth, font, fontSize);
			if (parts.length === 0) {
				line = '';
				continue;
			}

			for (let i = 0; i < parts.length - 1; i++) {
				const part = parts[i];
				if (part) wrapped.push(part);
			}

			line = parts[parts.length - 1] ?? '';
		}

		if (line) {
			wrapped.push(line);
		}

		if (pIndex < paragraphs.length - 1) {
			wrapped.push('');
		}
	}

	return wrapped;
};

const withEllipsisToFit = (
	line: string,
	maxWidth: number,
	font: PDFFont,
	fontSize: number,
): string => {
	const ellipsis = '...';
	if (textWidthAtSize(font, ellipsis, fontSize) > maxWidth) {
		return '';
	}

	let base = line.trimEnd();
	while (base && textWidthAtSize(font, `${base}${ellipsis}`, fontSize) > maxWidth) {
		base = base.slice(0, -1);
	}

	return base ? `${base}${ellipsis}` : ellipsis;
};

const truncateWrappedLines = (
	lines: string[],
	maxLines: number,
	maxWidth: number,
	font: PDFFont,
	fontSize: number,
): string[] => {
	if (maxLines <= 0) return [];
	if (lines.length <= maxLines) return lines;

	const out = lines.slice(0, maxLines);
	out[maxLines - 1] = withEllipsisToFit(out[maxLines - 1] ?? '', maxWidth, font, fontSize);
	return out;
};

=======
>>>>>>> 44105df (2026-04-08)
const signBlueCardsPdf = async (pdfBytes: Uint8Array, signatureBytes: Buffer, batch: BlueCardInput[]) => {
	const x = 470;
	const xBack = 250;
	const width = 95;
	const height = 30;
	const textX = 405;
<<<<<<< HEAD
	const remarksMaxWidth = 170;
	const remarksMaxLines = 5;
=======
>>>>>>> 44105df (2026-04-08)
	const fontSize = 10;
	const lineHeight = 12;

	const pdfDoc = await PDFDocument.load(pdfBytes);
	const signatureImage = await pdfDoc.embedPng(signatureBytes);
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

	const pages = pdfDoc.getPages();
	const firstPage = pages[0];
	const secondPage = pages[1];

	if (!firstPage || !secondPage) {
		return pdfBytes;
	}

	const drawRemarks = (remarks: string, startY: number) => {
<<<<<<< HEAD
		const textLines = truncateWrappedLines(
			wrapTextToWidth(remarks, remarksMaxWidth, font, fontSize),
			remarksMaxLines,
			remarksMaxWidth,
			font,
			fontSize,
		);
=======
		const textLines = remarks.split('\n');
>>>>>>> 44105df (2026-04-08)
		let currentY = startY;
		for (const line of textLines) {
			secondPage.drawText(line, {
				x: textX,
				y: currentY,
				size: fontSize,
				font,
				color: rgb(0, 0, 0),
			});
			currentY -= lineHeight;
		}
	};

		const first = batch[0];
		if (first) {
			firstPage.drawImage(signatureImage, { x, y: 588, width, height });
			secondPage.drawImage(signatureImage, { x: xBack, y: 623, width, height });
			drawRemarks(first.blue_card_remarks ?? '', 608);
		}

		const second = batch[1];
		if (second) {
			firstPage.drawImage(signatureImage, { x, y: 325, width, height });
			secondPage.drawImage(signatureImage, { x: xBack, y: 335, width, height });
			drawRemarks(second.blue_card_remarks ?? '', 345);
		}

		const third = batch[2];
		if (third) {
			firstPage.drawImage(signatureImage, { x, y: 62, width, height });
			secondPage.drawImage(signatureImage, { x: xBack, y: 105, width, height });
			drawRemarks(third.blue_card_remarks ?? '', 90);
		}

	return await pdfDoc.save();
};

const mergePdfs = async (pdfBuffers: Uint8Array[]): Promise<Uint8Array> => {
	if (pdfBuffers.length === 0) {
		throw new Error('No PDFs provided to merge');
	}
	if (pdfBuffers.length === 1) {
		const first = pdfBuffers[0];
		if (!first) {
			throw new Error('Missing PDF buffer');
		}
		return first;
	}

	const merged = await PDFDocument.create();
	for (const bytes of pdfBuffers) {
		const doc = await PDFDocument.load(bytes);
		const pages = await merged.copyPages(doc, doc.getPageIndices());
		for (const page of pages) {
			merged.addPage(page);
		}
	}
	return await merged.save();
};

const isPdfBytes = (bytes: Uint8Array | null): boolean => {
	if (!bytes || bytes.length < 4) return false;
	const header = Buffer.from(bytes.slice(0, 4));
	return header.equals(Buffer.from('%PDF'));
};

export const achievementsResource: ResourceHandler = {
	resource: 'achievements',
	async execute(ctx, _items, itemIndex, operation) {
		if (operation === 'printMeritBadgeBlueCards') {
			const items = _items;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number;
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;

			const userIdField = ctx.getNodeParameter('userIdField', 0, 'user_id') as string;
			const achievementIdField = ctx.getNodeParameter('achievementIdField', 0, 'achievement_id') as string;
			const counselorIdField = ctx.getNodeParameter('counselorIdField', 0, '') as string;
			const commentsField = ctx.getNodeParameter('commentsField', 0, '') as string;
			const signatureBinaryField = ctx.getNodeParameter('signatureBinaryField', 0, '') as string;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}
			if (!userIdField || !achievementIdField) {
				throw new Error('User ID Field and Achievement ID Field are required.');
			}

				const debug: Record<string, any> = {
					puppeteer: {
						launched: false,
						targetUrl: null,
						batches: [],
					},
				};
				const debugScreenshots: Array<{ key: string; data: Buffer }> = [];
				let screenshotIndex = 0;
				const addScreenshot = async (page: any, label: string) => {
					if (!debugMode || !page) return;
					const buf = (await page.screenshot({ fullPage: true })) as Buffer;
					screenshotIndex += 1;
					const safeLabel = label.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
					debugScreenshots.push({
						key: `debug_shot_${String(screenshotIndex).padStart(2, '0')}_${safeLabel}`,
						data: buf,
					});
				};

			let inputRows = items.map((it) => (it.json ?? {}) as Record<string, any>);
			if (batchSize > 0) {
				inputRows = inputRows.slice(0, batchSize);
			}

			const meritBadges = inputRows.map((row) => {
				const copy = { ...row };
				if (signatureBinaryField && signatureBinaryField in copy) {
					delete copy[signatureBinaryField];
				}
				return copy;
			});

			const MBs: BlueCardInput[] = inputRows.map((row) => {
				const userRaw = readMapped(row, userIdField);
				const achievementRaw = readMapped(row, achievementIdField);
				const user_id = normalizeId(userRaw);
				const achievement_id = normalizeId(achievementRaw);
				if (user_id == null || achievement_id == null) {
					throw new Error(
						`Missing or invalid user_id or achievement_id in input. user_id: ${userRaw}, achievement_id: ${achievementRaw}`,
					);
				}
				const counselorRaw = counselorIdField ? readMapped(row, counselorIdField) : null;
				const counselor_id = normalizeId(counselorRaw);
				const remarksRaw = commentsField ? readMapped(row, commentsField) : null;
				const blue_card_remarks = sanitizeRemarks(remarksRaw);
				return {
					user_id,
					achievement_id,
					...(counselor_id != null ? { counselor_id } : {}),
					...(blue_card_remarks ? { blue_card_remarks } : {}),
				};
			});

			if (MBs.length === 0) {
				throw new Error('No merit badge inputs were provided.');
			}

			let signatureBytes: Buffer | null = null;
			if (signatureBinaryField && signatureBinaryField.trim() !== '') {
				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					if (!item) continue;
					const bin = item.binary as Record<string, any> | undefined;
					if (bin && bin[signatureBinaryField]) {
						signatureBytes = await (ctx.helpers as any).getBinaryDataBuffer(i, signatureBinaryField);
						break;
					}
				}
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
				const targetUrl = `${baseUrl}/achieve/blue_card_printer/new`;
				debug.puppeteer.targetUrl = targetUrl;

				const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);
				const pdfBuffers = await session.withSession(async (page) => {
					debug.puppeteer.launched = true;

					const results: Uint8Array[] = [];
					for (let i = 0; i < MBs.length; i += 3) {
						const batch = MBs.slice(i, i + 3);
						const batchIndex = Math.floor(i / 3) + 1;
						debug.puppeteer.batches.push({ batchIndex, count: batch.length, status: 'started' });
						const workDir = path.join(os.tmpdir(), `tt_blue_cards_${Date.now()}_${batchIndex}`);
						await ensureDir(workDir);

						const client = await page.createCDPSession();
						await client.send('Page.setDownloadBehavior', {
							behavior: 'allow',
							downloadPath: workDir,
						});

						await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
						await sleep(delayMs);
						await dismissNotificationPopup(page);
						await addScreenshot(page, `batch_${batchIndex}_loaded`);

						await page.waitForSelector('#blue_card_printer_merit_badge_1_id', { timeout: 30000 });

						for (let j = 0; j < batch.length; j++) {
							const entry = batch[j];
							if (!entry) continue;
							const mbSel = `#blue_card_printer_merit_badge_${j + 1}_id`;
							const scoutSel = `#blue_card_printer_scout_${j + 1}_id`;
							await page.select(mbSel, String(entry.achievement_id));
							await page.select(scoutSel, String(entry.user_id));
							if (entry.counselor_id != null) {
								const counselorSel = `#blue_card_printer_counselor_${j + 1}_id`;
								try {
									await page.select(counselorSel, String(entry.counselor_id));
								} catch {
									// counselor select may not be present
								}
							}
						}

					await sleep(delayMs);
					await addScreenshot(page, `batch_${batchIndex}_filled`);

					const formInfo = await page.evaluate(() => {
						const doc = (globalThis as any).document;
						const form = doc.querySelector('#new_blue_card_printer');
						if (!form) {
							return { error: 'form_not_found' };
						}

						const action = form.getAttribute('action') || '';
						const method = (form.getAttribute('method') || 'post').toLowerCase();
						const target = form.getAttribute('target') || '';

						const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
						const pairs: Array<[string, string]> = [];
						const selected: Record<string, string> = {};

						for (const el of inputs as any[]) {
							const name = el.getAttribute?.('name') || '';
							if (!name) continue;
							const tag = String(el.tagName || '').toLowerCase();
							const type = (el.getAttribute?.('type') || '').toLowerCase();

							if (tag === 'select') {
								const sel = el as any;
								const opt = sel.options?.[sel.selectedIndex];
								const value = opt ? String(opt.value ?? '') : '';
								selected[name] = value;
								pairs.push([name, value]);
								continue;
							}

							if (type === 'checkbox' || type === 'radio') {
								if (!el.checked) continue;
								pairs.push([name, String(el.value ?? 'on')]);
								continue;
							}

							pairs.push([name, String(el.value ?? '')]);
						}

						const submit =
							form.querySelector('input[type="submit"]') || form.querySelector('button[type="submit"]');
						const printDisabled = Boolean(
							submit && (submit.disabled || submit.getAttribute('disabled') !== null),
						);
						if (submit && printDisabled) {
							submit.removeAttribute('disabled');
							submit.disabled = false;
						}

						const body = pairs
							.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
							.join('&');

						return { action, method, target, body, printDisabled, selected };
					});

					if (debugMode) {
						debug.form = {
							action: formInfo?.action,
							method: formInfo?.method,
							target: formInfo?.target,
							printDisabled: formInfo?.printDisabled,
							selected: formInfo?.selected,
							error: formInfo?.error,
						};
					}

					const trackedResponses: Array<{ url: string; status?: number; headers?: Record<string, any> }> = [];
					const onResponse = (res: any) => {
						try {
							const url = String(res?.url?.() ?? '');
							if (!url.includes('blue_card_printer')) return;
							trackedResponses.push({
								url,
								status: res?.status?.(),
								headers: res?.headers ? res.headers() : {},
							});
							if (trackedResponses.length > 5) trackedResponses.shift();
						} catch {
							// ignore
						}
					};
					const onRequestFailed = (req: any) => {
						try {
							const url = String(req?.url?.() ?? '');
							if (!url.includes('blue_card_printer')) return;
							trackedResponses.push({
								url,
								status: 0,
								headers: { errorText: req?.failure?.()?.errorText },
							});
							if (trackedResponses.length > 5) trackedResponses.shift();
						} catch {
							// ignore
						}
					};
					page.on('response', onResponse);
					page.on('requestfailed', onRequestFailed);

					const pagePdfResponsePromise = page
						.waitForResponse(
							(res: any) => {
								const url = String(res?.url?.() ?? '').toLowerCase();
								const headers = res?.headers ? res.headers() : {};
								const contentType = String(headers?.['content-type'] ?? '').toLowerCase();
								const isTroopTrack = url.includes('trooptrack.com');
								const isBlueCard = url.includes('blue_card_printer');
								return isTroopTrack && isBlueCard && contentType.includes('application/pdf');
							},
							{ timeout: 45000 },
						)
						.then(async (res: any) => {
							if (debugMode) {
								try {
									debug.pdfResponse = {
										url: String(res?.url?.() ?? ''),
										status: res?.status?.(),
										headers: res?.headers ? res.headers() : {},
									};
								} catch {
									// ignore
								}
							}
							return res.buffer();
						})
						.catch(() => null);

					const pdfResponsePromise = waitForPdfResponseOnBrowser(page.browser(), 45000);
					const newTabPdfPromise = waitForPdfInNewTab(page, 45000).catch(() => null);

					let pdfBytes: Uint8Array | null = null;
					let printerUrl: string | null = null;
					let pdfUrlFromLocation: string | null = null;

					if (formInfo && !formInfo.error && formInfo.body) {
						const postUrl = formInfo.action
							? formInfo.action.startsWith('http')
								? formInfo.action
								: `${baseUrl}${formInfo.action}`
							: `${baseUrl}/achieve/blue_card_printer.pdf`;
						try {
							const postResult = await page.evaluate(
								async ({ url, body, method }) => {
									const res = await fetch(url, {
										method: method || 'post',
										headers: {
											'Content-Type': 'application/x-www-form-urlencoded',
										},
										body,
									});
									const headers: Record<string, string> = {};
									try {
										res.headers.forEach((value, key) => {
											headers[key] = value;
										});
									} catch {
										// ignore
									}
									const buf = await res.arrayBuffer();
									return {
										ok: res.ok,
										status: res.status,
										headers,
										bytes: Array.from(new Uint8Array(buf)),
									};
								},
								{ url: postUrl, body: formInfo.body, method: formInfo.method },
							);

							if (debugMode) {
								debug.pdfPost = {
									url: postUrl,
									status: postResult?.status,
									ok: postResult?.ok,
									headers: postResult?.headers,
								};
							}

							if (postResult?.bytes?.length) {
								pdfBytes = new Uint8Array(postResult.bytes);
							}
						} catch (e) {
							if (debugMode) {
								debug.pdfPost = {
									url: postUrl,
									error: e instanceof Error ? e.message : String(e),
								};
							}
						}
					}

					if (isPdfBytes(pdfBytes)) {
						// captured via direct POST, skip submit
					} else {
						await page.evaluate(() => {
							const doc = (globalThis as any).document;
							const submit =
								doc.querySelector('#new_blue_card_printer input[type=\"submit\"]') ||
								doc.querySelector('#new_blue_card_printer button[type=\"submit\"]');
							if (submit) {
								submit.click();
								return;
							}
							const form = doc.querySelector('#new_blue_card_printer');
							if (form) {
								form.submit();
							}
						});
						await dismissNotificationPopup(page);
						await addScreenshot(page, `batch_${batchIndex}_submitted`);
					}

					try {
						const firstPdf = await Promise.race([pagePdfResponsePromise, newTabPdfPromise]);
						if (firstPdf) {
							pdfBytes = firstPdf;
						}
					} catch {
						// ignore
					}

						try {
							const printerResp = await waitForBlueCardPrinterResponse(page, 15000);
							printerUrl = String(printerResp?.url?.() ?? '');
							const loc = getLocationHeader(printerResp);
							if (loc) {
								pdfUrlFromLocation = loc.startsWith('http') ? loc : `${baseUrl}${loc}`;
							}
							if (pdfUrlFromLocation) {
								pdfBytes = await pollFetchPdfWithCookies(page, pdfUrlFromLocation, 20000, debug);
							} else if (printerUrl) {
								pdfBytes = await pollFetchPdfWithCookies(page, printerUrl, 15000, debug);
							}
						} catch {
							// ignore
						}

						if (!isPdfBytes(pdfBytes)) {
							try {
								const browser = page.browser();
								const opener = page.target();
								const target = await browser.waitForTarget((t: any) => t.opener() === opener, {
									timeout: 30000,
								});
								const targetUrl = String(target.url() ?? '');
								if (targetUrl) {
									pdfBytes = await pollFetchPdfWithCookies(page, targetUrl, 20000, debug);
								}
							} catch {
								// ignore
							}
						}

						if (!isPdfBytes(pdfBytes)) {
							try {
								pdfBytes = await pollFetchPdfWithCookies(
									page,
									`${baseUrl}/achieve/blue_card_printer`,
									20000,
									debug,
								);
							} catch {
								// ignore
							}
						}

						if (!isPdfBytes(pdfBytes)) {
							try {
								pdfBytes = await pollFetchPdfWithCookies(
									page,
									`${baseUrl}/achieve/blue_card_printer.pdf`,
									20000,
									debug,
								);
							} catch {
								// ignore
							}
						}

						if (!isPdfBytes(pdfBytes)) {
							try {
								pdfBytes = await waitForPdfResponseOnBrowser(page.browser(), 30000);
							} catch {
								// ignore
							}
						}

					if (!isPdfBytes(pdfBytes)) {
						try {
							pdfBytes = await pdfResponsePromise;
						} catch {
							// ignore
						}
					}

					if (!isPdfBytes(pdfBytes)) {
						const pdfPath = await waitForNamedPdf(workDir, 'blue_card.pdf', 45000);
						pdfBytes = await fs.readFile(pdfPath);
					}

					try {
						page.off('response', onResponse);
						page.off('requestfailed', onRequestFailed);
					} catch {
						// ignore
					}
					if (debugMode && trackedResponses.length > 0) {
						debug.blueCardResponses = trackedResponses;
					}

					if (!isPdfBytes(pdfBytes)) {
						throw new Error('Failed to capture blue card PDF');
					}

						const safePdfBytes = pdfBytes as Uint8Array;

						if (signatureBytes) {
							pdfBytes = await signBlueCardsPdf(safePdfBytes, signatureBytes, batch);
						} else {
							pdfBytes = safePdfBytes;
						}

						results.push(pdfBytes);
						debug.puppeteer.batches.push({ batchIndex, count: batch.length, status: 'completed' });
					}

					return results;
				});

				if (pdfBuffers.length === 0) {
					throw new Error('No PDF files were generated from the blue card printer.');
				}
				const merged = await mergePdfs(pdfBuffers);
				const fileName = `${formatTimestamp()}_blue_cards.pdf`;

				const binaryData = await (ctx.helpers as any).prepareBinaryData(
					Buffer.from(merged),
					fileName,
					'application/pdf',
				);

				const binary: Record<string, any> = {
					blue_cards: binaryData,
				};
				for (const shot of debugScreenshots) {
					binary[shot.key] = await (ctx.helpers as any).prepareBinaryData(
						shot.data,
						`${shot.key}.png`,
						'image/png',
					);
				}

				return [
					{
						json: {
							meritBadges,
						},
						binary,
					},
				];
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (debugMode) {
					const binary: Record<string, any> = {};
					for (const shot of debugScreenshots) {
						binary[shot.key] = await (ctx.helpers as any).prepareBinaryData(
							shot.data,
							`${shot.key}.png`,
							'image/png',
						);
					}
					return [
						{
							json: {
								meritBadges,
								error: msg,
								debug,
							},
							binary,
						},
					];
				}
				throw new Error(`Merit Badges: Print Blue Cards failed: ${msg}`);
			}
			}
		if (operation === 'getSelectableMeritBadges') {
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const debugMode = ctx.getNodeParameter('debugMode', 0, false) as boolean;
			const demoScoutId = ctx.getNodeParameter('demoScoutId', 0) as number;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}
			if (!Number.isFinite(demoScoutId) || demoScoutId <= 0) {
				throw new Error('Demo Scout ID must be a positive number.');
			}

			const debug: Record<string, any> = {
				puppeteer: {
					launched: false,
					finalUrl: null,
					targetUrl: null,
					badgeCount: 0,
					firstBadge: null,
				},
			};

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
				const targetUrl = `${baseUrl}/manage/users/${demoScoutId}?tab=achievements`;
				debug.puppeteer.targetUrl = targetUrl;

				const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);
				const results = await session.withSession(async (page) => {
					debug.puppeteer.launched = true;

					await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
					if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

					await page.evaluate(() => {
						const doc = (globalThis as any).document;
						const actionBtn = Array.from(doc.querySelectorAll('a, button') as any).find(
							(el: any) => (el.textContent ?? '').trim() === 'Actions',
						);
						if (!actionBtn) throw new Error('Actions button not found');
						(actionBtn as any).click();
					});
					if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

					await page.evaluate(() => {
						const doc = (globalThis as any).document;
						const items = Array.from(doc.querySelectorAll('.dropdown-menu .dropdown-item') as any);
						const startMb = items.find((el: any) => (el.textContent ?? '').trim() === 'Start Merit Badge');
						if (!startMb) throw new Error('Start Merit Badge menu item not found');
						(startMb as any).click();
					});
					if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

					const availableMBs = await page.$$eval('.form-check-label', (labels: any[]) => {
						const win = (globalThis as any).window;
						const doc = (globalThis as any).document;
						return labels
							.filter((label: any) => {
								const style = win.getComputedStyle(label);
								if (
									style.display === 'none' ||
									style.visibility === 'hidden' ||
									label.offsetParent === null
								) {
									return false;
								}
								const inputId = label.getAttribute('for');
								if (!inputId) return false;
								const inputEl = doc.getElementById(inputId);
								return inputEl && !inputEl.disabled;
							})
							.map((label: any) => {
								const forAttr = label.getAttribute('for') ?? '';
								const idNum = parseInt(forAttr.split('_').pop() ?? '', 10);
								return {
									achievement_id: Number.isFinite(idNum) ? idNum : null,
									name: (label.textContent ?? '').trim(),
								};
							})
							.filter((row: any) => row.achievement_id !== null && row.name);
					});

					debug.puppeteer.finalUrl = page.url();
					debug.puppeteer.badgeCount = availableMBs.length;
					debug.puppeteer.firstBadge = availableMBs[0] ?? null;

					return availableMBs;
				});

				return results ?? [];
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (debugMode) {
					throw new Error(
						`Merit Badges: Get Selectable in TroopTrack failed: ${msg}. Debug: ${JSON.stringify(debug)}`,
					);
				}
				return [];
			}
		}

		if (operation === 'startMeritBadge') {
			const items = _items;
			const browserlessWsEndpoint = ctx.getNodeParameter('browserlessWsEndpoint', 0, '') as string;
			const delayMs = ctx.getNodeParameter('delayMs', 0, 300) as number;
			const batchSize = ctx.getNodeParameter('batchSize', 0, 0) as number;

			const userIdFieldName = ctx.getNodeParameter('user_id', 0) as string;
			const achievementIdFieldName = ctx.getNodeParameter('achievement_id', 0) as string;

			if (!browserlessWsEndpoint || browserlessWsEndpoint.trim() === '') {
				throw new Error('Browserless WebSocket endpoint is required (including token).');
			}

			const inputRows = items.map((it) => (it.json ?? {}) as Record<string, any>);

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

				const session = new TroopTrackPuppeteerSession(auth, 120000, browserlessWsEndpoint);
				const result = await session.withSession(async (page) => {
					if (delayMs > 0) {
						await new Promise((resolve) => setTimeout(resolve, delayMs));
					}

					return await startTroopTrackMeritBadges(
						page,
						auth.tt_sub_domain,
						inputRows,
						{
							user_id: userIdFieldName,
							achievement_id: achievementIdFieldName,
						},
						{
							delayMs,
							batchSize,
						},
					);
				});

				const resultByIndex = new Map<number, { mb_added: boolean; errors: string[] }>();
				for (const entry of result ?? []) {
					if (typeof entry?.index === 'number') {
						resultByIndex.set(entry.index, {
							mb_added: Boolean(entry?.mb_added),
							errors: Array.isArray(entry?.errors) ? entry.errors : ['Unknown error'],
						});
					}
				}

				return inputRows.map((row, idx) => {
					const entry = resultByIndex.get(idx);
					return {
						...row,
						mb_added: entry ? entry.mb_added : false,
						errors: entry ? entry.errors : ['No result returned for item'],
					};
				});
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return inputRows.map((row) => ({
					...row,
					mb_added: false,
					errors: [msg],
				}));
			}
		}

		if (operation === 'getMany') {
			const awardTypeId = ctx.getNodeParameter('awardTypeId', 0) as number;

			const resp = await troopTrackRequest(ctx, 'GET', '/v1/user_achievements/parameters');

			let root: any = resp;
			if (Array.isArray(root) && root.length === 1) root = root[0];

			const awardTypes = Array.isArray(root?.award_types) ? root.award_types : [];
			const selected = awardTypes.find((at: any) => Number(at?.id) === Number(awardTypeId));

			const achievements = Array.isArray(selected?.achievements) ? selected.achievements : [];

			// Return a bare array, consistent with your Users and Events behavior
			return achievements.map((a: any) => ({
				achievement_id: a?.id,
				name: a?.name,
			}));
		}

		if (operation === 'getById') {
			const achievementId = ctx.getNodeParameter('achievementId', itemIndex) as number;
			const awardTypeId = ctx.getNodeParameter('awardTypeId', itemIndex) as number;

			const resp = await troopTrackRequest(
				ctx,
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
				root && typeof root === 'object' && root.achievement_id != null ? root.achievement_id : achievementId;

			if (root && typeof root === 'object' && root.achievement && typeof root.achievement === 'object') {
				root = root.achievement;
			}

			// If keyed by the ID string, unwrap that key
			if (root && typeof root === 'object' && root[String(achievementId)] && typeof root[String(achievementId)] === 'object') {
				root = root[String(achievementId)];
			}

			// At this point, root should be the AchievementEntity object
			// Inject achievement_id if missing
			if (root && typeof root === 'object' && root.achievement_id == null) {
				root = { achievement_id: topAchievementId, ...root };
			}

			return normalizeChildren(root);
		}

		throw new Error(`Unsupported achievements operation: ${operation} (index ${itemIndex})`);
	},
};
