import type { Page } from 'playwright-core';
import type { ShopStepResult } from './agree';
import {
  JOIN_ID,
  JOIN_PW,
  JOIN_PW_CONFIRM,
  JOIN_NAME,
  JOIN_MOBILE1,
  JOIN_MOBILE2,
  JOIN_MOBILE3,
  JOIN_EMAIL,
  JOIN_CONFIRM_LAYER,
} from './selectors';

export type JoinInput = {
  id: string;
  password: string;
  name: string;
  email: string;
  /** 010-1234-5678 형태. 앞자리/가운데/뒷자리로 쪼개 넣는다. */
  mobile1: string;
  mobile2: string;
  mobile3: string;
};

/**
 * 회원가입 폼을 채우고 제출한다. 약관 페이지(agreeTerms)를 지나 join.html 에 온 상태를 전제로 한다.
 * 가입 버튼은 테마마다 다르지만 window.memberJoinAction 을 부르는 게 공통이라 그걸 직접 실행한다.
 * 결과 페이지(join_result / returnUrl / 홈)로 갔는지로 성공을 판정한다.
 */
export const fillJoinForm = async (page: Page, input: JoinInput): Promise<ShopStepResult> => {
  try {
    await page.fill(JOIN_ID, input.id);
    await page.fill(JOIN_PW, input.password);
    await page.fill(JOIN_PW_CONFIRM, input.password);
    await page.fill(JOIN_NAME, input.name);
    await page.selectOption(JOIN_MOBILE1, input.mobile1).catch(() => {});
    await page.fill(JOIN_MOBILE2, input.mobile2);
    await page.fill(JOIN_MOBILE3, input.mobile3);
    await page.fill(JOIN_EMAIL, input.email).catch(() => {});

    await page.evaluate(() => {
      const fn = (window as unknown as { memberJoinAction?: () => void }).memberJoinAction;
      if (fn) fn();
    });
    await page.waitForTimeout(2000);

    const confirm = await page.$(JOIN_CONFIRM_LAYER);
    if (confirm) {
      await confirm.click();
      await page.waitForTimeout(2500);
    }

    const url = page.url();
    const done = url.includes('join_result') || url.includes('returnUrl') || /\/(index\.html)?$/.test(url);
    return done
      ? { ok: true, detail: `회원가입 완료: ${input.id}` }
      : { ok: false, detail: '가입 폼 제출 후 결과 페이지에 도달하지 못했다' };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
};
