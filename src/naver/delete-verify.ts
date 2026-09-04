import type { Frame, Page } from 'playwright-core';
import { judgePostListVerdict, type DeletionVerdict } from './post-status';
import { isPostGone } from './post-status';
import { isBlogOrigin } from './blog-id';
import { BLOG_HOST } from './urls';
import { fetchFromPage, buildPostListPath, buildPostViewPath } from './fetch-posts';

/** 클릭 경로가 막혔을 때만 쓴다. 관측된 시그니처가 인자 4개라 arity 가 다르면 다른 함수로 보고 부르지 않는다. */
export const invokeDeleteScript = async (frame: Frame, logNo: string): Promise<boolean> => {
  const target = Number(logNo);
  if (!Number.isSafeInteger(target)) return false;

  try {
    return await frame.evaluate((n) => {
      const w = window as unknown as {
        confirm: () => boolean;
        postView?: { deletePost?: (a: unknown, b: number, c: unknown, d: boolean) => void };
      };
      const remove = w.postView?.deletePost;
      if (typeof remove !== 'function' || remove.length !== 4) return false;

      w.confirm = () => true;
      remove.call(w.postView, null, n, null, false);
      return true;
    }, target);
  } catch {
    // deletePost 가 폼을 보내며 실행 컨텍스트를 날리면 여기로 온다. 실패가 아니라 진행 신호다.
    return true;
  }
};

/** 삭제 여부는 클릭이 아니라 재조회로 판정한다. 판정 못 하면 지워졌다고 우기지 않는다. */
export const verifyDeletion = async (
  page: Page,
  { blogId, logNo }: { blogId: string; logNo: string },
): Promise<DeletionVerdict> => {
  // 세션이 끊겨 nid 로 튕겨 있으면 상대경로 요청이 엉뚱한 오리진으로 나가 404 를 받는다.
  if (!isBlogOrigin(page.url())) {
    try {
      await page.goto(`https://${BLOG_HOST}/${blogId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
    } catch {
      return 'unknown';
    }
  }

  if (!isBlogOrigin(page.url())) return 'unknown';

  const list = await fetchFromPage(page, buildPostListPath(blogId)).catch(() => null);
  const listVerdict = list ? judgePostListVerdict(list.status, list.text, logNo) : 'unknown';
  if (listVerdict !== 'unknown') return listVerdict;

  const view = await fetchFromPage(page, buildPostViewPath(blogId, logNo)).catch(() => null);

  return view && isPostGone(view.status) ? 'deleted' : 'unknown';
};
