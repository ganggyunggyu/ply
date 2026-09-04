import type { Dialog, Page } from 'playwright-core';
import { ERRORS, PROGRESS } from '../messages';
import { clickExactlyOne } from './click-helpers';
import { sleep, isSessionExpired, waitForMainFrame } from './browser-connect';
import { BLOG_HOST } from './urls';
import { titleMatches } from './post-title';
import { readPostTitle, clickDeleteButton, POST_DELETE_SELECTORS } from './delete-click';
import { invokeDeleteScript, verifyDeletion } from './delete-verify';
import type { DeleteOutcome, DeleteSinglePostOptions } from './delete-types';

/** 근거 약함: 배포 JS 에만 있고 실제 실행 관측 0회(글보내기 이력이 있는 글에서만 뜬다). fallback 필수. */
const DELETE_CONFIRM_SELECTORS = [
  '#sendPostLayerBtn',
  'a._deletePostConfirm',
  '#sendPostLayer a.button_next',
];

const DELETE_SETTLE_MS = 2500;

export const deleteSinglePost = async (
  page: Page,
  { blogId, logNo, expectedTitle, onProgress }: DeleteSinglePostOptions,
): Promise<DeleteOutcome> => {
  await page.goto(`https://${BLOG_HOST}/${blogId}/${logNo}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await sleep(3000);

  if (isSessionExpired(page.url())) throw new Error(ERRORS.sessionExpired);

  const frame = await waitForMainFrame(page);

  // 고정 대기로는 모자란다. 덜 그려진 화면에서 세면 본문 블록이 0개로 잡혀
  // "글이 하나가 아니다"로 오판한다. 실제로 이것 때문에 삭제가 계속 거부됐다.
  // 소유자 링크가 본문보다 늦게 붙는다. 본문만 기다리면 링크를 못 보고 지나친다.
  // 내 글이 아니면 여기서 시간만 쓰고 아래 owned === 0 으로 떨어진다.
  await frame.waitForSelector('a._deletePost', { timeout: 20_000 }).catch(() => undefined);
  await sleep(1500);

  // 삭제 링크는 한 글에도 위아래로 두 개 붙으므로 링크 수로는 글 개수를 못 센다.
  // 본문 블록 수로 세야 "화면에 글이 여러 개"를 제대로 잡는다.
  const owned = await frame.locator(POST_DELETE_SELECTORS.join(', ')).count();
  if (owned === 0) return { logNo, status: 'notFound' };

  const rendered = await frame.locator('.se-main-container').count();
  if (rendered > 1) {
    return { logNo, status: 'unknown', message: ERRORS.deleteAmbiguousDetail(0, owned, rendered) };
  }

  // 목록이 밀렸거나 정렬 가정이 틀렸으면 여기서 걸린다. 제목이 다르면 손대지 않는다.
  const actualTitle = await readPostTitle(frame);
  if (!actualTitle) return { logNo, status: 'unknown', message: ERRORS.postTitleUnreadable };
  if (!titleMatches(expectedTitle, actualTitle)) return { logNo, status: 'titleMismatch', actualTitle };

  const dialogMessages: string[] = [];
  const handleDialog = (dialog: Dialog) => {
    dialogMessages.push(dialog.message());
    void dialog.accept().catch(() => undefined);
  };

  page.on('dialog', handleDialog);

  try {
    const invoked = (await clickDeleteButton(frame, logNo)) || (await invokeDeleteScript(frame, logNo));
    if (!invoked) return { logNo, status: 'unknown', message: ERRORS.deleteButtonNotFound };

    await sleep(DELETE_SETTLE_MS);

    try {
      await clickExactlyOne(frame, DELETE_CONFIRM_SELECTORS, 2000);
    } catch {
      // 확인 레이어는 글보내기 이력이 있는 글에서만 뜬다. 없으면 그대로 넘어간다.
    }

    await sleep(DELETE_SETTLE_MS);

    onProgress?.(PROGRESS.deleteVerifying(expectedTitle));

    const verdict = await verifyDeletion(page, { blogId, logNo });
    if (verdict === 'deleted') return { logNo, status: 'deleted' };

    return {
      logNo,
      status: 'unknown',
      message: verdict === 'alive' ? ERRORS.deleteStillThere : dialogMessages.join(' ') || undefined,
    };
  } finally {
    page.off('dialog', handleDialog);
  }
};
