import puppeteer from 'puppeteer-extra';
import type { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export type TroopTrackWebAuth = {
  tt_sub_domain: string;
  tt_username: string;
  tt_password: string;
};

export class TroopTrackPuppeteerSession {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(
    private readonly auth: TroopTrackWebAuth,
    private readonly protocolTimeoutMs = 120000
  ) {}

  private get baseUrl(): string {
    const sub = this.auth.tt_sub_domain.trim();
    return `https://${sub}.trooptrack.com`;
  }

  async open(): Promise<{ browser: Browser; page: Page }> {
    if (this.browser && this.page) return { browser: this.browser, page: this.page };

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      protocolTimeout: this.protocolTimeoutMs,
    });

    this.page = await this.browser.newPage();

    // Default behavior required by you
    this.page.setDefaultNavigationTimeout(this.protocolTimeoutMs);

    return { browser: this.browser, page: this.page };
  }

  async login(): Promise<Page> {
    const { page } = await this.open();

    await page.goto(`${this.baseUrl}/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: this.protocolTimeoutMs,
    });

    // Fallback selectors. TroopTrack sometimes changes IDs.
    const loginSel = '#user_account_session_login';
    const passSel = '#user_account_session_password';

    await page.waitForSelector(loginSel, { timeout: this.protocolTimeoutMs });
    await page.type(loginSel, this.auth.tt_username);
    await page.type(passSel, this.auth.tt_password);

    // Primary button selector plus fallback
    const submitSelector = '#new_user_account_session > input.btn.btn-secondary';
    const submitFallback = 'form#new_user_account_session input[type="submit"], form#new_user_account_session button[type="submit"]';

    const btn = await page.$(submitSelector) ?? await page.$(submitFallback);
    if (!btn) throw new Error('Login submit button not found');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: this.protocolTimeoutMs }).catch(() => null),
      btn.click(),
    ]);

    return page;
  }

  async close(): Promise<void> {
    try {
      await this.page?.close().catch(() => null);
      await this.browser?.close().catch(() => null);
    } finally {
      this.page = null;
      this.browser = null;
    }
  }

  async withSession<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    try {
      const page = await this.login();
      return await fn(page);
    } finally {
      await this.close();
    }
  }
}