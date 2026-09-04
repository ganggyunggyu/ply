import type { Frame, Page } from 'playwright-core';
import { CAFE_MAIN_FRAME, COMMENT_ITEM, ERROR_POPUP } from './selectors';

export const readPageText = (page: Page, timeout = 8000): Promise<string> =>
  page
    .locator('body')
    .innerText({ timeout })
    .catch(() => '');

/** 첫 번째로 눈에 보이는 것만 누른다. 카페는 같은 문구의 숨은 버튼을 여러 개 둔다. */
export const clickFirstVisible = async (page: Page, selector: string): Promise<boolean> => {
  const candidates = page.locator(selector);
  const count = await candidates.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);

    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      return true;
    }
  }

  return false;
};

export const gotoWithRetry = async (page: Page, url: string, attempts = 3): Promise<void> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(2000).catch(() => {});
    }
  }

  throw lastError;
};

/**
 * 카페 PC 화면의 본문과 댓글은 `#cafe_main` iframe 안에 있다.
 * 프레임을 못 찾으면 페이지 자체를 돌려준다 — 모바일 화면은 iframe 이 없다.
 *
 * `ready` 를 따로 주는 이유: 로그인이 풀렸거나 카페 멤버가 아니면 네이버는 로그인 화면으로
 * 보내지 않는다. 주소도 프레임도 그대로 두고 **안쪽 내용만 비운다.** 프레임을 잡았다는 것만으로
 * 성공을 판단하면 그 뒤 셀렉터가 전부 0개로 나오고, 원인이 "입력창 없음" 으로 잘못 보고된다.
 */
export const getCommentRoot = async (page: Page): Promise<{ root: Page | Frame; ready: boolean }> => {
  const frame = await page
    .waitForSelector(CAFE_MAIN_FRAME, { timeout: 20_000 })
    .then((handle) => handle.contentFrame())
    .catch(() => null);

  const root = frame ?? page;

  if (!frame) await page.waitForSelector(COMMENT_ITEM, { timeout: 5000 }).catch(() => {});

  const body = await root
    .locator('body')
    .innerText({ timeout: 5000 })
    .catch(() => '');

  return { root, ready: body.trim().length > 0 };
};

export const readErrorPopup = async (page: Page): Promise<string | null> => {
  const popup = await page.$(ERROR_POPUP);
  if (!popup) return null;

  const text = (await popup.textContent())?.replace(/\s+/g, ' ').trim();

  return text ? text.slice(0, 120) : '팝업이 떠서 진행하지 못했다';
};
