import type { Frame, Page } from 'playwright-core';
import { ERRORS, PROGRESS } from '../messages';
import { clickFirstAvailable } from './click-helpers';
import { sleep, isSessionExpired, waitForMainFrame, dismissPopups } from './browser-connect';
import { typeTitle, typeBody, openPublishDialog } from './editor';
import { isPublishedPostUrl } from './blog-id';
import { WRITE_URL } from './urls';

const PUBLISH_CONFIRM_SELECTORS = [
  '[data-click-area="tpb*i.publish"]',
  'button[class*="confirm_btn"]',
  '.confirm_btn__WEaBq',
];

export const confirmPublish = async (page: Page, frame: Frame) => {
  const confirmed = (await clickFirstAvailable(frame, PUBLISH_CONFIRM_SELECTORS)) ||
    (await clickFirstAvailable(page, PUBLISH_CONFIRM_SELECTORS));

  if (!confirmed) throw new Error(ERRORS.publishConfirmNotFound);

  try {
    await page.waitForURL((url) => isPublishedPostUrl(url.toString()), { timeout: 90_000 });
  } catch {
    // 주소가 안 바뀌어도 발행 자체는 됐을 수 있다. 목록에서 최신 글을 찾아본다.
    const recovered = await findLatestPostUrl(page);
    if (recovered) return recovered;
  }

  return page.url();
};

/** 발행 후 주소를 못 잡았을 때 내 블로그에서 가장 최근 글 주소를 읽어온다. */
export const findLatestPostUrl = async (page: Page): Promise<string | null> => {
  const blogId = /blog\.naver\.com\/([^/?#]+)/.exec(page.url())?.[1];
  if (!blogId) return null;

  try {
    await page.goto(`https://blog.naver.com/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const frame = await waitForMainFrame(page, 15_000).catch(() => null);
    const scope = frame ?? page;

    const logNo = await scope.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="logNo="], a[href*="PostView"]');
      const match = /logNo=(\d{6,})/.exec(link?.href ?? '');
      return match?.[1] ?? null;
    });

    return logNo ? `https://blog.naver.com/${blogId}/${logNo}` : null;
  } catch {
    return null;
  }
};

export type WriteBlogPostOptions = {
  title: string;
  body: string;
  onProgress?: (message: string) => void;
};

export const writeBlogPost = async (page: Page, { title, body, onProgress }: WriteBlogPostOptions) => {
  onProgress?.(PROGRESS.editorOpening);
  await page.goto(WRITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(5000);

  if (isSessionExpired(page.url())) throw new Error(ERRORS.sessionExpired);

  const frame = await waitForMainFrame(page);
  await sleep(3000);
  await dismissPopups(frame);

  onProgress?.(PROGRESS.titleTyping);
  await typeTitle(page, frame, title);

  onProgress?.(PROGRESS.bodyTyping);
  await typeBody(page, frame, body);

  await dismissPopups(frame);

  onProgress?.(PROGRESS.publishDialogOpening);
  await openPublishDialog(page, frame);

  onProgress?.(PROGRESS.publishConfirming);
  const url = await confirmPublish(page, frame);

  return url;
};
