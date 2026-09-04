import type { Page } from 'playwright-core';

const KEYS_URL = 'https://openrouter.ai/settings/keys';
/** 발급된 키는 sk-or-v1- 로 시작한다. 화면 어디에 뜨든 이 패턴으로 집어낸다. */
const KEY_PATTERN = /sk-or-v1-[A-Za-z0-9._-]{20,}/;

export type IssueKeyResult =
  | { status: 'created'; key: string }
  | { status: 'login_required' }
  | { status: 'failed'; detail: string };

/**
 * 로그인 판정. openrouter 는 미로그인 상태로 /settings/keys 를 열면 로그인 화면으로 보낸다.
 * URL 이 keys 를 벗어났거나 본문에 Sign In 만 있고 키 UI 가 없으면 로그인 필요로 본다.
 * 로그인 자체는 자동화하지 않는다(자격증명은 사용자가 직접 넣는다).
 */
const isLoginGate = async (page: Page): Promise<boolean> => {
  if (!page.url().includes('/settings/keys')) return true;

  const signIn = await page.getByText('Sign In', { exact: false }).first().isVisible().catch(() => false);
  const hasCreate = await page
    .getByRole('button', { name: /create/i })
    .first()
    .isVisible()
    .catch(() => false);

  return signIn && !hasCreate;
};

/**
 * OpenRouter 대시보드에서 API 키를 하나 발급한다. 로그인 세션이 있으면(크롬에서 쿠키를 가져왔거나
 * 사용자가 이 세션에서 직접 로그인했으면) 그대로 진행하고, 로그인 화면이면 멈추고 알린다.
 *
 * 로그인된 대시보드의 정확한 마크업은 계정 없이 확인할 수 없어, 버튼은 역할/텍스트로 느슨하게 잡는다.
 * 생성 키는 sk-or-v1- 패턴으로 본문에서 집어낸다.
 */
export const issueOpenRouterKey = async (page: Page, keyName: string): Promise<IssueKeyResult> => {
  try {
    await page.goto(KEYS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    if (await isLoginGate(page)) return { status: 'login_required' };

    const createButton = page.getByRole('button', { name: /create key|create api key|create/i }).first();
    await createButton.click({ timeout: 8000 });
    await page.waitForTimeout(1000);

    // 이름 입력칸이 있으면 채운다. 없으면 그냥 넘어간다(모달 구성이 버전마다 다르다).
    const nameInput = page.getByRole('textbox').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(keyName).catch(() => {});
    }

    // 모달의 확인 버튼. 방금 연 버튼과 겹치지 않게 마지막 create/confirm 을 누른다.
    const confirm = page.getByRole('button', { name: /create|confirm|generate/i }).last();
    await confirm.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const body = await page.evaluate(() => document.body.innerText);
    const match = body.match(KEY_PATTERN);
    if (match) return { status: 'created', key: match[0] };

    return { status: 'failed', detail: '키를 만들었지만 화면에서 값을 읽지 못했다. 대시보드에서 직접 복사해야 한다' };
  } catch (error) {
    return { status: 'failed', detail: (error as Error).message };
  }
};
