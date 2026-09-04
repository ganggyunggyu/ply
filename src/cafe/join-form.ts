import type { Page } from 'playwright-core';
import { JOIN_CAPTCHA_IMAGE, JOIN_CAPTCHA_INPUT, JOIN_CAPTCHA_REFRESH, JOIN_SUBMIT, CAPTCHA_REJECTED } from './selectors';
import { clickFirstVisible, readPageText } from './page-utils';
import { sanitizeNickname } from './urls';

const DEFAULT_ANSWERS = ['네 확인했습니다', '네 알겠습니다', '네 동의합니다', '네 숙지했습니다'];

/**
 * 가입 폼을 채운다.
 *
 * 카페마다 묻는 항목이 다르고 이름도 제각각이라 셀렉터로 특정할 수 없다.
 * 보이는 입력칸을 훑으면서 별명 칸만 골라내고 나머지는 무난한 답으로 채운다.
 */
export const fillJoinForm = async (page: Page, nickname: string, answers = DEFAULT_ANSWERS) => {
  const controls = page.locator('textarea:visible, input[type="text"]:visible, input:not([type]):visible');
  const count = await controls.count().catch(() => 0);
  let answerIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const meta = await control.evaluate((element) => {
      const field = element as HTMLInputElement | HTMLTextAreaElement;

      return {
        hint: `${field.id} ${field.name} ${field.placeholder} ${field.labels?.[0]?.textContent ?? ''}`,
        value: field.value ?? '',
        maxLength: field.maxLength,
      };
    });

    const isNickname = /nick|닉네임|별명/.test(meta.hint);
    const raw = isNickname ? sanitizeNickname(nickname) : answers[answerIndex] ?? answers.at(-1) ?? '';
    const value = raw.slice(0, meta.maxLength > 0 ? meta.maxLength : raw.length);

    // 이미 채워진 칸은 건드리지 않는다. 별명만 예외로 항상 덮어쓴다.
    if (isNickname || !meta.value.trim()) await control.fill(value).catch(() => {});
    if (!isNickname) answerIndex += 1;
  }

  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count().catch(() => 0);

  for (let index = 0; index < checkboxCount; index += 1) {
    const checkbox = checkboxes.nth(index);
    if (!(await checkbox.isChecked().catch(() => true))) await checkbox.check({ force: true }).catch(() => {});
  }
};

type CaptchaSolver = (imageBase64: string) => Promise<string>;

/**
 * 보안문자가 뜨면 푼다. 안 떴으면 아무것도 하지 않고 통과한다.
 *
 * 한 번 틀리면 이미지가 바뀌므로 새로고침하고 다시 읽는다. 제출까지 여기서 하는 이유는
 * 답을 넣은 직후에 눌러야 값이 살아있기 때문이다.
 */
export const solveJoinCaptcha = async (
  page: Page,
  solve: CaptchaSolver,
  attempts = 5,
): Promise<{ solved: boolean; tried: number }> => {
  for (let tried = 1; tried <= attempts; tried += 1) {
    const image = page.locator(JOIN_CAPTCHA_IMAGE).first();
    if (!(await image.isVisible({ timeout: 1500 }).catch(() => false))) {
      return { solved: true, tried: tried - 1 };
    }

    const answer = await solve((await image.screenshot({ type: 'png' })).toString('base64')).catch(() => '');

    if (answer) {
      await page.locator(JOIN_CAPTCHA_INPUT).first().fill(answer).catch(() => {});
      await page.waitForTimeout(700);
      await clickFirstVisible(page, JOIN_SUBMIT);
      await page.waitForTimeout(2500);

      const stillThere = await page.locator(JOIN_CAPTCHA_IMAGE).first().isVisible({ timeout: 1000 }).catch(() => false);
      if (!stillThere && !CAPTCHA_REJECTED.test(await readPageText(page, 3000))) return { solved: true, tried };
    }

    await clickFirstVisible(page, JOIN_CAPTCHA_REFRESH).catch(() => false);
    await page.waitForTimeout(1500);
  }

  return { solved: false, tried: attempts };
};
