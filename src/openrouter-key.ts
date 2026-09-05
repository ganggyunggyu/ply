import type { Page } from 'playwright-core';

const KEYS_URL = 'https://openrouter.ai/settings/keys';
/** 발급된 키는 sk-or-v1- 로 시작한다. 화면 어디에 뜨든 이 패턴으로 집어낸다. */
const KEY_PATTERN = /sk-or-v1-[A-Za-z0-9._-]{20,}/;
const NAME_INPUT = 'input[name="name"]';

export type IssueKeyResult =
  | { status: 'created'; key: string }
  | { status: 'login_required' }
  | { status: 'manual'; detail: string }
  | { status: 'failed'; detail: string };

/** 키 생성 전 이메일 인증(코드 전송) 단계가 떴는지. 이건 사용자 몫이라 자동화하지 않는다. */
const needsEmailVerify = (page: Page): Promise<boolean> =>
  page.evaluate(() => /verify your email|send code|이메일 인증/i.test(document.body.innerText));

/** 생성 키는 innerText 에 안 잡힐 수 있다(readonly input 이나 code 블록). DOM 을 폭넓게 훑는다. */
const findKeyInDom = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const pat = /sk-or-v1-[A-Za-z0-9._-]{20,}/;
    const inputs = Array.from(document.querySelectorAll('input, textarea')).map((el) => (el as HTMLInputElement).value);
    for (const value of inputs) {
      const m = value.match(pat);
      if (m) return m[0];
    }
    const text = document.body.innerText.match(pat);
    if (text) return text[0];
    const html = document.body.innerHTML.match(pat);
    return html ? html[0] : null;
  });

/**
 * '새 키' 버튼을 텍스트로 찾아 누른다. OpenRouter 는 이 버튼이 Next/Clerk 오버레이에 가려 playwright
 * 의 click 이 막히는 경우가 있어, DOM 에서 직접 눌러 준다. which=last 는 모달이 뜬 뒤 확정 버튼
 * (트리거와 텍스트가 같다)을 고를 때 쓴다. 눌렀으면 true.
 */
const clickNewKey = (page: Page, which: 'first' | 'last'): Promise<boolean> =>
  page.evaluate((pick) => {
    const buttons = Array.from(document.querySelectorAll('button')).filter((b) => /new key|create key|create api key/i.test(b.textContent || ''));
    const btn = pick === 'last' ? buttons[buttons.length - 1] : buttons[0];
    if (!btn) return false;
    (btn as HTMLElement).click();
    return true;
  }, which);

/**
 * OpenRouter 대시보드에서 API 키를 발급한다. 로그인 세션이 있으면(크롬에서 쿠키를 가져왔거나 사용자가
 * 직접 로그인했으면) 새 키 → 이름 입력 → 확정으로 만들고, 뜬 키를 집어낸다. 로그인 화면이면 멈춘다.
 *
 * 로그인 판정은 URL 로 못 한다 — 로그인되면 /settings/keys 가 /workspaces/<ws>/keys 로 돌아간다.
 * '새 키' 버튼이 있으면 로그인된 것으로 본다. 로그인 자체는 자동화하지 않는다.
 */
export const issueOpenRouterKey = async (page: Page, keyName: string): Promise<IssueKeyResult> => {
  try {
    await page.goto(KEYS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (!(await clickNewKey(page, 'first'))) return { status: 'login_required' };
    await page.waitForTimeout(1200);

    const nameInput = page.locator(NAME_INPUT).first();
    if (await nameInput.isVisible().catch(() => false)) await nameInput.fill(keyName).catch(() => {});
    await page.waitForTimeout(300);

    await clickNewKey(page, 'last');
    await page.waitForTimeout(2500);

    const key = await findKeyInDom(page);
    if (key) return { status: 'created', key };

    // OpenRouter 는 키 생성 전에 이메일 인증(코드 전송)을 요구할 때가 있다. 이건 사용자가 메일을
    // 열어 코드를 넣어야 하는 단계라 자동화하지 않는다. 열어둔 탭에서 마치게 안내한다.
    if (await needsEmailVerify(page)) {
      return { status: 'manual', detail: 'OpenRouter 가 이메일 인증을 요구해요. 열어둔 탭에서 인증을 마친 뒤 다시 눌러 주세요.' };
    }

    return { status: 'manual', detail: '키를 만들었지만 화면에서 값을 읽지 못했어요. 열어둔 탭에서 직접 복사해 붙여 넣어 주세요.' };
  } catch (error) {
    return { status: 'failed', detail: (error as Error).message };
  }
};
