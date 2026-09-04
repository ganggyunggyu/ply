import { chromium, type Browser, type Frame, type Page } from 'playwright-core';
import { ERRORS } from '../messages';
import { MAIN_FRAME_NAME } from './urls';

const FRAME_POLL_INTERVAL = 500;

export const modifierKey = () => (process.platform === 'darwin' ? 'Meta' : 'Control');

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isSessionExpired = (url: string) =>
  url.includes('nid.naver.com') || url.includes('nidlogin');

export const connectBrowser = async (cdpPort: number): Promise<Browser> =>
  chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);

export const listPages = (browser: Browser): Page[] =>
  browser.contexts().flatMap((context) => context.pages());

export const findPageByUrl = (browser: Browser, matcher: (url: string) => boolean): Page | null =>
  listPages(browser).findLast((page) => matcher(page.url())) ?? null;

export const findPageByTabId = async (browser: Browser, tabId: number): Promise<Page | null> => {
  for (const page of listPages(browser)) {
    try {
      const found = await page.evaluate(() => (window as unknown as { __gngTabId?: number }).__gngTabId);
      if (found === tabId) return page;
    } catch {
      continue;
    }
  }

  return null;
};

export const waitForPageByTabId = async (
  browser: Browser,
  tabId: number,
  timeout = 20_000,
): Promise<Page> => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const page = await findPageByTabId(browser, tabId);
    if (page) return page;
    await sleep(FRAME_POLL_INTERVAL);
  }

  throw new Error(ERRORS.tabNotFound);
};

export const waitForPageByUrl = async (
  browser: Browser,
  matcher: (url: string) => boolean,
  timeout = 20_000,
): Promise<Page> => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const page = findPageByUrl(browser, matcher);
    if (page) return page;
    await sleep(FRAME_POLL_INTERVAL);
  }

  throw new Error(ERRORS.pageNotFound);
};

export const waitForMainFrame = async (page: Page, timeout = 20_000): Promise<Frame> => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const frame = page.frame({ name: MAIN_FRAME_NAME });
    if (frame) return frame;
    await sleep(FRAME_POLL_INTERVAL);
  }

  throw new Error(ERRORS.mainFrameNotFound);
};

export { dismissPopups } from './dismiss-popups';
