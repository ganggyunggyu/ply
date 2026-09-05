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

/**
 * 키 생성 전 '이메일 인증' 다이얼로그가 떴는지. 계정 이메일이 미인증이면 OpenRouter 가 여기서 막는다.
 * 다이얼로그가 확정 클릭 뒤 조금 늦게 뜨므로 부르는 쪽이 폴링한다.
 */
const hasVerifyDialog = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
    return !!dialog && /verify your email|send code/i.test(dialog.textContent || '');
  });

/**
 * 키 생성 모달의 확정 버튼. 트리거는 'New Key' 지만 모달 안 확정은 'Create' 라 텍스트가 다르다.
 * 모달 제목('Create API Key')은 버튼이 아니므로 안 잡힌다. 눌렀으면 true.
 */
const clickCreateInDialog = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
    for (const dialog of dialogs) {
      const btn = Array.from(dialog.querySelectorAll('button')).find((b) => /^create$/i.test((b.textContent || '').trim()));
      if (btn) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

/** 인증 다이얼로그가 이미 코드 입력 단계(6자리 OTP 칸이 있음)인지. 그러면 메일을 또 보내지 않는다. */
const hasOtpInput = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!document.querySelector('input[autocomplete="one-time-code"], input[name="code"]'));

/**
 * 인증 다이얼로그의 'Send code' 를 눌러 코드 메일을 보낸다. 메일을 열어 코드를 넣는 건 사용자 몫이라
 * 거기까지만 대신한다 — 자격증명/OTP 입력은 자동화하지 않는다. 눌렀으면 true.
 */
const clickSendCode = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
    if (!dialog) return false;
    const btn = Array.from(dialog.querySelectorAll('button')).find((b) => /send code/i.test(b.textContent || ''));
    if (!btn) return false;
    (btn as HTMLElement).click();
    return true;
  });

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

/** 키 생성 모달(이름 칸이 있는 다이얼로그)이 열려 있는지. 인증이 끝나면 닫혀 있을 수 있어 다시 연다. */
const hasCreateDialog = (page: Page): Promise<boolean> =>
  page.evaluate(() => !!document.querySelector('[role="dialog"] input[name="name"], [role="alertdialog"] input[name="name"]'));

type CreateAttempt = { kind: 'created'; key: string } | { kind: 'verify' } | { kind: 'unread' };

/**
 * 이름을 채우고 Create 를 눌러 결과를 본다. 확정 뒤 키 모달이나 인증 다이얼로그가 뜨기까지 시간이 걸려서
 * 한 번만 보고 판정하면 인증창을 놓친다. 6초까지 반복해 둘 중 먼저 뜨는 걸 잡는다.
 */
const attemptCreate = async (page: Page, keyName: string, pollTicks = 12): Promise<CreateAttempt> => {
  if (!(await hasCreateDialog(page))) {
    await clickNewKey(page, 'first');
    await page.waitForTimeout(1200);
  }

  const nameInput = page.locator(NAME_INPUT).first();
  if (await nameInput.isVisible().catch(() => false)) await nameInput.fill(keyName).catch(() => {});
  await page.waitForTimeout(300);

  // 확정 버튼은 트리거('New Key')와 달리 모달 안의 'Create' 다. 텍스트가 다르니 따로 잡는다.
  await clickCreateInDialog(page);

  for (let i = 0; i < pollTicks; i += 1) {
    await page.waitForTimeout(500);

    const key = await findKeyInDom(page);
    if (key) return { kind: 'created', key };

    if (await hasVerifyDialog(page)) return { kind: 'verify' };
  }

  return { kind: 'unread' };
};

/** 사용자가 탭에서 인증을 마쳐 인증 다이얼로그가 사라질 때까지 기다린다. 최대 maxMs. 끝났으면 true. */
const waitForVerification = async (page: Page, maxMs: number): Promise<boolean> => {
  const step = 2000;
  for (let waited = 0; waited < maxMs; waited += step) {
    await page.waitForTimeout(step);
    if (!(await hasVerifyDialog(page))) return true;
  }
  return false;
};

const UNREAD_DETAIL = '키를 만들었지만 화면에서 값을 읽지 못했어요. 열어둔 탭에서 직접 복사해 붙여 넣어 주세요.';

/**
 * OpenRouter 대시보드에서 API 키를 발급한다. 로그인 세션이 있으면(크롬에서 쿠키를 가져왔거나 사용자가
 * 직접 로그인했으면) 새 키 → 이름 입력 → Create 로 만들고, 뜬 키를 집어낸다. 로그인 화면이면 멈춘다.
 *
 * 계정 이메일이 미인증이면 OpenRouter 가 인증 다이얼로그로 막는다. 코드 메일은 대신 보내 주되 코드 입력은
 * 사용자 몫이다(자격증명·OTP 입력은 자동화하지 않는다). 그래서 사용자가 탭에서 코드를 넣고 인증을 마칠 때까지
 * 기다렸다가 나머지(Create → 키 읽기 → 저장)를 이어서 한다. 발급을 다시 누를 필요가 없게 한다.
 *
 * 로그인 판정은 URL 로 못 한다 — 로그인되면 /settings/keys 가 /workspaces/<ws>/keys 로 돌아간다.
 * '새 키' 버튼이 있으면 로그인된 것으로 본다. 로그인 자체는 자동화하지 않는다.
 */
export const issueOpenRouterKey = async (
  page: Page,
  keyName: string,
  onProgress: (message: string) => void = () => {},
): Promise<IssueKeyResult> => {
  try {
    await page.goto(KEYS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    if (!(await clickNewKey(page, 'first'))) return { status: 'login_required' };
    await page.waitForTimeout(1200);

    let attempt = await attemptCreate(page, keyName);
    if (attempt.kind === 'created') return { status: 'created', key: attempt.key };
    if (attempt.kind === 'unread') return { status: 'manual', detail: UNREAD_DETAIL };

    // 이미 코드 입력 단계면 다시 보내지 않는다 — 누를 때마다 메일이 쌓이고 앞 코드는 무효가 된다.
    if (!(await hasOtpInput(page))) {
      const sent = await clickSendCode(page);
      if (!sent) {
        return { status: 'manual', detail: '계정 이메일이 미인증이에요. 열어둔 탭에서 Send code 를 눌러 인증한 뒤 다시 눌러 주세요.' };
      }
    }

    onProgress('계정 이메일 인증이 필요해요. 코드 메일을 보냈으니 열어둔 탭에 6자리 코드를 넣고 Verify email 을 누르면 나머지는 자동으로 이어져요. (10분까지 기다려요)');

    // 메일함 열고 코드 옮겨 적는 데 3분은 짧았다. 10분이면 넉넉하고, OpenRouter 코드 유효시간 안에도 든다.
    const verified = await waitForVerification(page, 600_000);
    if (!verified) {
      return { status: 'manual', detail: '10분 안에 인증이 안 끝나서 멈췄어요. 탭에서 인증을 마친 뒤 발급을 다시 눌러 주세요.' };
    }

    onProgress('인증 확인했어요. 키를 만드는 중…');
    await page.waitForTimeout(800);

    // 인증 직후엔 화면이 재구성되느라 키 모달이 더 늦게 뜬다. 여유 있게 10초까지 본다.
    attempt = await attemptCreate(page, keyName, 20);
    if (attempt.kind === 'created') return { status: 'created', key: attempt.key };
    if (attempt.kind === 'verify') {
      return { status: 'manual', detail: '인증 뒤에도 인증 창이 다시 떴어요. 탭에서 상태를 확인한 뒤 발급을 다시 눌러 주세요.' };
    }

    return { status: 'manual', detail: UNREAD_DETAIL };
  } catch (error) {
    return { status: 'failed', detail: (error as Error).message };
  }
};
