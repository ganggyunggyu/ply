import type { Page } from 'playwright-core';
import { loginUrl } from './urls';
import { LOGIN_ID, LOGIN_PW, LOGIN_SUBMIT } from './selectors';

export type ShopLoginResult = {
  ok: boolean;
  detail: string;
};

/**
 * Cafe24 쇼핑몰 회원 로그인. 성공 판정은 로그인 페이지에서 벗어났는지로 한다 — Cafe24 는 실패해도
 * 리다이렉트 없이 login.html 에 그대로 머문다. 버튼은 onclick 으로 JS 를 부르는 a 태그라 click 대신
 * 그 함수를 직접 실행하는 게 안정적이다(엔터/폼서브밋이 막힌 테마가 있다).
 */
export const shopLogin = async (
  page: Page,
  { baseUrl, id, password }: { baseUrl: string; id: string; password: string },
): Promise<ShopLoginResult> => {
  await page.goto(loginUrl(baseUrl), { waitUntil: 'domcontentloaded' });
  await page.fill(LOGIN_ID, id);
  await page.fill(LOGIN_PW, password);

  const submit = await page.$(LOGIN_SUBMIT);
  if (submit) await submit.click();
  else await page.evaluate(() => (window as unknown as { MemberAction?: { login?: () => void } }).MemberAction?.login?.());

  await page.waitForTimeout(2500);

  const stillOnLogin = page.url().includes('/member/login.html');
  return stillOnLogin
    ? { ok: false, detail: '로그인 실패. 아이디/비밀번호를 확인하거나 캡차가 떴는지 본다' }
    : { ok: true, detail: `로그인 성공: ${id}` };
};
