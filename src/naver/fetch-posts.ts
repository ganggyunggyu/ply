import type { Page } from 'playwright-core';
import { ERRORS } from '../messages';
import { sleep, isSessionExpired } from './browser-connect';
import { BLOG_HOST, MY_BLOG_URL } from './urls';
import { parseBlogIdFromUrl } from './blog-id';
import { parsePostListResponse, type RecentPost } from './post-list-parse';

const POST_LIST_PAGE_SIZE = 30;
const POST_LIST_RETRY = 3;
const POST_LIST_BACKOFF_MS = 3000;

/** blogId 는 오직 이 함수로만 얻는다. 모델 인자나 열려 있는 다른 탭 주소에서 유도하지 않는다. */
export const resolveBlogId = async (page: Page): Promise<string> => {
  await page.goto(MY_BLOG_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(3000);

  if (isSessionExpired(page.url())) throw new Error(ERRORS.sessionExpired);

  const blogId = parseBlogIdFromUrl(page.url());
  if (!blogId) throw new Error(ERRORS.blogIdNotResolved);

  return blogId;
};

export const buildPostListPath = (blogId: string) =>
  `/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}` +
  `&viewdate=&currentPage=1&categoryNo=0&parentCategoryNo=&countPerPage=${POST_LIST_PAGE_SIZE}`;

/** mainFrame 이 실제로 쓰는 파라미터를 그대로 붙인다. 빼면 리다이렉트 shim 이 돌아온다. */
export const buildPostViewPath = (blogId: string, logNo: string) =>
  `/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}` +
  `&redirect=Dlog&widgetTypeCall=true&directAccess=false`;

/** 상대경로 요청이라 현재 문서가 blog.naver.com 이어야 쿠키와 Referer 가 붙는다. */
export const fetchFromPage = (page: Page, path: string) =>
  page.evaluate(async (target) => {
    const res = await fetch(target, { credentials: 'same-origin' });
    return { status: res.status, text: await res.text() };
  }, path);

/** resolveBlogId 직후에 부른다. */
export const fetchRecentPosts = async (
  page: Page,
  { blogId, limit }: { blogId: string; limit: number },
): Promise<RecentPost[]> => {
  const path = buildPostListPath(blogId);

  for (let attempt = 1; attempt <= POST_LIST_RETRY; attempt += 1) {
    const { status, text } = await fetchFromPage(page, path);

    if (status === 429) {
      if (attempt === POST_LIST_RETRY) break;
      await sleep(POST_LIST_BACKOFF_MS * attempt);
      continue;
    }

    if (status !== 200) throw new Error(ERRORS.postListUnreadable);

    // 응답 순서는 네이버가 주는 그대로 쓴다. 공지 고정과 예약 글이 위에 올 수 있어 정렬을 가정하지 않는다.
    return parsePostListResponse(text)
      .slice(0, limit)
      .map((post) => ({ ...post, postUrl: `https://${BLOG_HOST}/${blogId}/${post.logNo}` }));
  }

  throw new Error(ERRORS.postListRateLimited);
};
