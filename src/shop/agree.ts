import type { Page } from 'playwright-core';
import { agreementUrl } from './urls';
import { AGREE_ALL, AGREE_NEXT } from './selectors';

export type ShopStepResult = {
  ok: boolean;
  detail: string;
};

/**
 * 스킨이 체크박스를 커스텀 스타일로 감춰 두는 경우가 있어 세 경로로 시도한다:
 * 직접 check → label 클릭 → JS 로 checked + 이벤트 디스패치. 마지막까지 안 되면 던진다.
 */
const checkAgreeAll = async (page: Page) => {
  try {
    await page.locator(AGREE_ALL).check({ timeout: 5000 });
    return;
  } catch {
    /* 다음 경로로 */
  }

  try {
    await page.locator(`label[for="${AGREE_ALL.slice(1)}"]`).click({ timeout: 5000 });
    if (await page.locator(AGREE_ALL).isChecked()) return;
  } catch {
    /* 다음 경로로 */
  }

  await page.evaluate((selector) => {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (!el) return;
    el.checked = true;
    el.dispatchEvent(new Event('click', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, AGREE_ALL);

  if (!(await page.locator(AGREE_ALL).isChecked())) throw new Error('전체 동의 체크박스를 선택하지 못했다');
};

/** 회원가입 약관 페이지에서 전체 동의하고 다음(가입 폼)으로 넘긴다. */
export const agreeTerms = async (page: Page, baseUrl: string): Promise<ShopStepResult> => {
  try {
    await page.goto(agreementUrl(baseUrl), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await checkAgreeAll(page);
    await page.click(AGREE_NEXT);
    await page.waitForURL('**/member/join.html**', { timeout: 10_000 });
    return { ok: true, detail: '약관 동의 완료' };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
};
