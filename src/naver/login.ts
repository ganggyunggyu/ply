import type { Page } from 'playwright-core';
import { ERRORS } from '../messages';
import { clickFirstAvailable } from './click-helpers';

const LOGIN_SUBMIT_SELECTORS = [
  '#loginBtn_column',
  '#log\\.login',
  '.btn_login',
  'button[type="submit"]',
];

export type LoginBlock = 'captcha' | 'two_factor' | 'error' | null;

export const detectLoginBlock = async (page: Page): Promise<LoginBlock> => {
  const probe = async (selector: string) => {
    try {
      return await page.locator(selector).first().isVisible({ timeout: 1000 });
    } catch {
      return false;
    }
  };

  if ((await probe('#captcha')) || (await probe('.captcha_area'))) return 'captcha';
  if ((await probe('#new_device_confirm')) || (await probe('.sp_ti_login'))) return 'two_factor';
  if ((await probe('.error_message')) || (await probe('#err_common'))) return 'error';

  return null;
};

export const fillLoginForm = async (page: Page, naverId: string, password: string) => {
  await page.waitForSelector('#id', { timeout: 15_000 });

  await page.evaluate(
    ({ id, pw }) => {
      const setValue = (selector: string, value: string) => {
        const input = document.querySelector<HTMLInputElement>(selector);
        if (!input) return;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      setValue('#id', id);
      setValue('#pw', pw);
    },
    { id: naverId, pw: password },
  );

  const clicked = await clickFirstAvailable(page, LOGIN_SUBMIT_SELECTORS, 3000);

  if (!clicked) {
    const byText = page.getByRole('button', { name: '로그인', exact: true }).first();
    if (await byText.isVisible({ timeout: 3000 })) await byText.click();
    else throw new Error(ERRORS.loginButtonNotFound);
  }
};
