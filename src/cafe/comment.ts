import type { Page } from 'playwright-core';
import { COMMENT_INPUT, COMMENT_SUBMIT } from './selectors';
import { getCommentRoot, gotoWithRetry, readErrorPopup } from './page-utils';
import { toArticleUrl, type CafeTarget } from './urls';

export type CommentResult = {
  posted: boolean;
  detail: string;
  articleUrl: string;
};

/** 댓글창은 한 줄이다. 줄바꿈을 넣으면 그 자리에서 등록돼 글이 잘린다. */
const toSingleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * 카페 글에 댓글을 단다.
 *
 * 성공 여부를 등록 버튼 클릭이 아니라 목록에 실제로 뜬 내용으로 판단한다.
 * 카페는 등록에 실패해도 화면이 조용한 경우가 있어서, 눌렀다는 사실만으로는 근거가 안 된다.
 */
export const writeCafeComment = async (
  page: Page,
  target: CafeTarget,
  articleId: string | number,
  content: string,
  onProgress?: (message: string) => void,
): Promise<CommentResult> => {
  const articleUrl = toArticleUrl(target, articleId);

  await gotoWithRetry(page, articleUrl);
  await page.waitForTimeout(1500);

  const { root, ready } = await getCommentRoot(page);

  // 내용이 통째로 비었으면 셀렉터를 더 찾아봐야 소용없다. 볼 권한이 없는 것이다.
  if (!ready) {
    return {
      posted: false,
      detail: '글 내용을 읽지 못했다. 로그인이 풀렸거나 이 카페 멤버가 아니다',
      articleUrl,
    };
  }

  const input =
    (await root.$(COMMENT_INPUT)) ??
    (await root.waitForSelector(COMMENT_INPUT, { timeout: 12_000 }).catch(() => null));

  if (!input) return { posted: false, detail: '댓글 입력창을 찾지 못했다', articleUrl };

  onProgress?.('댓글 입력 중');
  const body = toSingleLine(content);
  await input.click();
  await page.waitForTimeout(300);
  await input.fill(body);
  await page.waitForTimeout(500);

  const submit = await root.$(COMMENT_SUBMIT);
  if (!submit) return { posted: false, detail: '등록 버튼을 찾지 못했다', articleUrl };

  await submit.click();
  await page.waitForTimeout(2500);

  const popup = await readErrorPopup(page);
  if (popup) return { posted: false, detail: popup, articleUrl };

  onProgress?.('등록 확인 중');
  const preview = body.slice(0, 30);

  for (let retry = 0; retry < 5; retry += 1) {
    const { root: verifyRoot } = await getCommentRoot(page);
    const text = await verifyRoot.innerText('body').catch(() => '');

    if (text.includes(preview)) return { posted: true, detail: '댓글 등록됨', articleUrl };
    await page.waitForTimeout(retry < 2 ? 1000 : 2000);
  }

  return { posted: false, detail: '등록 후 목록에서 댓글을 찾지 못했다', articleUrl };
};
