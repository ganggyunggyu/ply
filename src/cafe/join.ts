import type { Page } from 'playwright-core';
import { JOIN_BUTTON, JOIN_PENDING, JOIN_RESTRICTED, NICKNAME_TAKEN } from './selectors';
import { clickFirstVisible, gotoWithRetry, readPageText } from './page-utils';
import { fillJoinForm, solveJoinCaptcha } from './join-form';
import { toMobileCafeHomeUrl, type CafeTarget } from './urls';

export type JoinStatus = 'joined' | 'pending' | 'alreadyMember' | 'failed';

export type JoinResult = {
  status: JoinStatus;
  detail: string;
};

type JoinOptions = {
  nickname: string;
  solveCaptcha: (imageBase64: string) => Promise<string>;
  onProgress?: (message: string) => void;
};

const ALREADY_MEMBER = /이미 가입|가입한 카페|탈퇴하기/;

/**
 * 카페에 가입한다. 가입 흐름은 모바일 화면이 훨씬 단순해서 그쪽을 쓴다.
 *
 * 결과를 URL 이 아니라 화면 문구로 판단한다. 카페는 실패해도 주소가 그대로인 경우가 많다.
 * 승인제 카페는 `pending` 으로 끝난다 — 실패가 아니라 사람이 승인해줘야 하는 상태다.
 */
export const joinCafe = async (
  page: Page,
  target: CafeTarget,
  { nickname, solveCaptcha, onProgress }: JoinOptions,
): Promise<JoinResult> => {
  await gotoWithRetry(page, toMobileCafeHomeUrl(target));
  await page.waitForTimeout(2000);

  const before = await readPageText(page);
  if (ALREADY_MEMBER.test(before)) return { status: 'alreadyMember', detail: '이미 가입된 카페' };
  if (JOIN_RESTRICTED.test(before)) return { status: 'failed', detail: '가입이 제한된 카페' };

  onProgress?.('가입 버튼 찾는 중');
  if (!(await clickFirstVisible(page, JOIN_BUTTON))) {
    return { status: 'failed', detail: '가입 버튼을 찾지 못했다' };
  }

  await page.waitForTimeout(2500);

  onProgress?.('가입 폼 작성 중');
  await fillJoinForm(page, nickname);
  await page.waitForTimeout(500);

  onProgress?.('보안문자 확인 중');
  const captcha = await solveJoinCaptcha(page, solveCaptcha);
  if (!captcha.solved) {
    return { status: 'failed', detail: `보안문자를 ${captcha.tried}번 시도했지만 통과하지 못했다` };
  }

  // 보안문자가 아예 없었으면 아직 제출 전이다. 있었으면 그 안에서 이미 눌렀다.
  if (captcha.tried === 0) {
    await clickFirstVisible(page, JOIN_BUTTON);
    await page.waitForTimeout(3000);
  }

  const after = await readPageText(page);
  if (NICKNAME_TAKEN.test(after)) return { status: 'failed', detail: '별명이 이미 쓰이고 있다' };
  if (JOIN_RESTRICTED.test(after)) return { status: 'failed', detail: '가입이 제한된 카페' };
  if (JOIN_PENDING.test(after)) return { status: 'pending', detail: '가입 신청 완료, 운영자 승인 대기' };

  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);

  return ALREADY_MEMBER.test(await readPageText(page))
    ? { status: 'joined', detail: '가입 완료' }
    : { status: 'failed', detail: '가입 여부를 확인하지 못했다' };
};
