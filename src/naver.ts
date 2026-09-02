import { chromium, type Browser, type Dialog, type Frame, type Page } from 'playwright-core';
import { ERRORS, PROGRESS } from './messages';

export const LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
export const WRITE_URL = 'https://blog.naver.com/GoBlogWrite.naver';
export const MAIN_FRAME_NAME = 'mainFrame';

const FRAME_POLL_INTERVAL = 500;
const POPUP_SELECTORS = [
  '.se-popup-button-cancel',
  '.se-help-panel-close-button',
  '.se-popup-close-button',
  '.se-popup-button-close',
  'button[class*="popup_close"]',
];
const TITLE_SELECTOR = '.se-documentTitle .se-text-paragraph';
const BODY_SELECTOR = '.se-component.se-text .se-text-paragraph';
const PUBLISH_OPEN_SELECTORS = [
  '[data-click-area="tpb.publish"]',
  'button[class*="publish_btn"]',
  '.publish_btn__m9KHH',
];
const LOGIN_SUBMIT_SELECTORS = [
  '#loginBtn_column',
  '#log\\.login',
  '.btn_login',
  'button[type="submit"]',
];
const PUBLISH_CONFIRM_SELECTORS = [
  '[data-click-area="tpb*i.publish"]',
  'button[class*="confirm_btn"]',
  '.confirm_btn__WEaBq',
];

export const BLOG_HOST = 'blog.naver.com';
export const MY_BLOG_URL = `https://${BLOG_HOST}/MyBlog.naver`;

const POST_LIST_PAGE_SIZE = 30;
const POST_LIST_RETRY = 3;
const POST_LIST_BACKOFF_MS = 3000;
const DELETE_SETTLE_MS = 2500;

/** 소유자에게만 렌더된다. 배포 JS 의 클릭 라우터가 _deletePost -> postView.deletePost 로 연결한다. */
const POST_DELETE_SELECTORS = [
  'a._deletePost',
  'a.btn_del._deletePost',
  '.post_btn_area a._deletePost',
];

/** 근거 약함: 배포 JS 에만 있고 실제 실행 관측 0회(글보내기 이력이 있는 글에서만 뜬다). fallback 필수. */
const DELETE_CONFIRM_SELECTORS = [
  '#sendPostLayerBtn',
  'a._deletePostConfirm',
  '#sendPostLayer a.button_next',
];

/** 에디터 세대마다 다르다. 구형 스킨은 pcol1 과 itemSubjectBoldfont 가 같은 엘리먼트에 붙기도 한다. */
const POST_TITLE_SELECTORS = [
  '.se-documentTitle .se-text-paragraph',
  '.se_title .se_textarea',
  '.pcol1 .itemSubjectBoldfont',
  '.pcol1.itemSubjectBoldfont',
  '.htitle',
];

/** 페이지 이름을 blogId 로 오인하면 남의 블로그를 지운다. */
const RESERVED_BLOG_PATHS = new Set([
  'prologue', 'postlist', 'postview', 'guestbook', 'memo', 'category',
  'recommend', 'buddy', 'widget', 'goblogwrite', 'blogwrite', 'admin',
  'manage', 'section', 'rss', 'api', 'post', 'common', 'main', 'myblog',
]);

export const modifierKey = () => (process.platform === 'darwin' ? 'Meta' : 'Control');

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isSessionExpired = (url: string) =>
  url.includes('nid.naver.com') || url.includes('nidlogin');

export const connectBrowser = async (cdpPort: number): Promise<Browser> =>
  chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);

export const listPages = (browser: Browser): Page[] =>
  browser.contexts().flatMap((context) => context.pages());

export const findPageByUrl = (browser: Browser, matcher: (url: string) => boolean): Page | null =>
  listPages(browser).findLast((page) => matcher(page.url())) ?? null;

export const findPageByTabId = async (browser: Browser, tabId: number): Promise<Page | null> => {
  for (const page of listPages(browser)) {
    try {
      const found = await page.evaluate(() => (window as unknown as { __gngTabId?: number }).__gngTabId);
      if (found === tabId) return page;
    } catch {
      continue;
    }
  }

  return null;
};

export const waitForPageByTabId = async (
  browser: Browser,
  tabId: number,
  timeout = 20_000,
): Promise<Page> => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const page = await findPageByTabId(browser, tabId);
    if (page) return page;
    await sleep(FRAME_POLL_INTERVAL);
  }

  throw new Error(ERRORS.tabNotFound);
};

export const waitForPageByUrl = async (
  browser: Browser,
  matcher: (url: string) => boolean,
  timeout = 20_000,
): Promise<Page> => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const page = findPageByUrl(browser, matcher);
    if (page) return page;
    await sleep(FRAME_POLL_INTERVAL);
  }

  throw new Error(ERRORS.pageNotFound);
};

export const waitForMainFrame = async (page: Page, timeout = 20_000): Promise<Frame> => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const frame = page.frame({ name: MAIN_FRAME_NAME });
    if (frame) return frame;
    await sleep(FRAME_POLL_INTERVAL);
  }

  throw new Error(ERRORS.mainFrameNotFound);
};

export const dismissPopups = async (frame: Frame) => {
  for (const selector of POPUP_SELECTORS) {
    const locator = frame.locator(selector);

    try {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const item = locator.nth(index);
        if (await item.isVisible()) await item.click({ timeout: 2000 });
      }
    } catch {
      continue;
    }
  }
};

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

/** clickFirstAvailable 과 다르다. 정확히 하나일 때만 누른다. 여러 개면 던진다. */
const clickExactlyOne = async (
  scope: Page | Frame,
  selectors: string[],
  timeout = 5000,
): Promise<boolean> => {
  for (const selector of selectors) {
    const locator = scope.locator(selector);
    let count = 0;

    try {
      count = await locator.count();
    } catch {
      continue;
    }

    if (count === 0) continue;
    if (count > 1) throw new Error(ERRORS.deleteAmbiguousTarget);

    try {
      if (await locator.first().isVisible({ timeout })) {
        await locator.first().click();
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};

const clickFirstAvailable = async (
  scope: Page | Frame,
  selectors: string[],
  timeout = 5000,
): Promise<boolean> => {
  for (const selector of selectors) {
    try {
      const locator = scope.locator(selector).first();
      if (await locator.isVisible({ timeout })) {
        await locator.click();
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
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


export const typeTitle = async (page: Page, frame: Frame, title: string) => {
  await frame.click(TITLE_SELECTOR);
  await page.keyboard.type(title, { delay: 12 });
};

export const typeBody = async (page: Page, frame: Frame, body: string) => {
  await frame.click(BODY_SELECTOR);

  const lines = body.split('\n');

  for (const [index, line] of lines.entries()) {
    if (line.trim()) await page.keyboard.type(line, { delay: 8 });
    if (index < lines.length - 1) await page.keyboard.press('Enter');
  }
};

export const openPublishDialog = async (page: Page, frame: Frame) => {
  const opened = (await clickFirstAvailable(frame, PUBLISH_OPEN_SELECTORS)) ||
    (await clickFirstAvailable(page, PUBLISH_OPEN_SELECTORS));

  if (!opened) throw new Error(ERRORS.publishButtonNotFound);

  await sleep(3000);
};

/** 발행이 끝나면 주소가 blog.naver.com/{blogId}/{logNo} 형태로 바뀐다. */
export const isPublishedPostUrl = (url: string) => /blog\.naver\.com\/[^/?#]+\/\d{6,}/.test(url);

/** 문자열 매칭이면 evil.example/blog.naver.com/victim 이 통과한다. 호스트를 파서로 확인한다. */
export const isBlogOrigin = (url: string): boolean => {
  try {
    return new URL(url).hostname === BLOG_HOST;
  } catch {
    return false;
  }
};

/** blog.naver.com 의 첫 경로 조각 중 실제 블로그 아이디만 통과시킨다.
 *  GoBlogWrite.naver / PostList.naver / prologue 같은 페이지 이름을 blogId 로 오인하면 남의 블로그를 지운다. */
export const parseBlogIdFromUrl = (url: string): string | null => {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname !== BLOG_HOST) return null;

  const [raw] = parsed.pathname.split('/').filter(Boolean);
  if (!raw) return null;
  if (raw.includes('.')) return null;
  if (RESERVED_BLOG_PATHS.has(raw.toLowerCase())) return null;

  return /^[a-z0-9][a-z0-9_-]{2,19}$/.test(raw) ? raw : null;
};

/** 상한이 15자리인 이유: 삭제 스크립트에 숫자로 넘기므로 2^53 을 넘으면 값이 반올림된다.
 *  검증한 logNo 와 삭제한 logNo 가 갈리면 제목 재확인이 무의미해진다. */
export const parseLogNo = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!/^\d{6,15}$/.test(text)) return null;

  return Number.isSafeInteger(Number(text)) ? text : null;
};

/** PostTitleListAsync 의 title 은 URL 인코딩이고 공백이 + 다. */
export const decodePostTitle = (raw: string): string => {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw.replace(/\+/g, ' ');
  }
};

export const normalizeTitle = (value: string) => value.replace(/\s+/g, ' ').trim();

const TITLE_TRAILING_NOISE = /[\s.·…]+$/;

/** 부분일치를 허용하면 "다이어트 후기" 와 "다이어트 후기 3일차" 가 서로 통과하고,
 *  실제 제목이 더 짧기만 해도("오늘의 일기" vs "일기") 뚫린다.
 *  되돌릴 수 없는 작업의 마지막 방어선이라 정규화 후 완전일치만 통과시킨다. */
export const titleMatches = (expected: string, actual: string): boolean => {
  const a = normalizeTitle(expected).replace(TITLE_TRAILING_NOISE, '');
  const b = normalizeTitle(actual).replace(TITLE_TRAILING_NOISE, '');

  return a.length > 0 && a === b;
};

/** _deletePost 부재는 "글이 없다" 가 아니라 "이 응답에 소유자용 버튼이 없다" 일 뿐이다.
 *  비로그인 상태로 나간 요청은 살아 있는 공개글을 200 으로 돌려주므로 그걸로 판정하지 않는다.
 *  긍정 근거인 404/410 만 본다. */
export const isPostGone = (status: number): boolean => status === 404 || status === 410;

export type DeletionVerdict = 'deleted' | 'alive' | 'unknown';

/** 삭제 판정의 1차 근거. 인증된 목록 응답에서 logNo 가 사라졌는지를 본다.
 *  목록이 비었거나 응답이 200 이 아니면 세션이 끊겼을 수 있으므로 판정하지 않는다. */
export const judgePostListVerdict = (status: number, body: string, logNo: string): DeletionVerdict => {
  if (status !== 200) return 'unknown';

  const posts = parsePostListResponse(body);
  if (posts.length === 0) return 'unknown';

  return posts.some((post) => post.logNo === logNo) ? 'alive' : 'deleted';
};

export type ParsedPost = { logNo: string; title: string; addDate: string };
export type RecentPost = ParsedPost & { postUrl: string };

const sliceBalancedArray = (text: string, start: number): string | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth += 1;
    if (ch === ']') { depth -= 1; if (depth === 0) return text.slice(start, i + 1); }
  }

  return null;
};

/** 네이버가 pagingHtml 안 작은따옴표를 이스케이프해서 표준 JSON 이 아닐 때가 있다. */
const readPostListArray = (text: string): unknown[] => {
  try {
    const parsed = JSON.parse(text) as { postList?: unknown };
    if (Array.isArray(parsed.postList)) return parsed.postList;
  } catch {
    // 아래 괄호 균형 스캔으로 넘어간다
  }

  const keyAt = text.indexOf('"postList"');
  if (keyAt < 0) return [];
  const start = text.indexOf('[', keyAt);
  if (start < 0) return [];
  const slice = sliceBalancedArray(text, start);
  if (!slice) return [];

  try {
    return JSON.parse(slice) as unknown[];
  } catch {
    return [];
  }
};

export const parsePostListResponse = (raw: string): ParsedPost[] => {
  const cleaned = raw.replace(/\\'/g, "'");

  return readPostListArray(cleaned).flatMap((item) => {
    const row = item as { logNo?: unknown; title?: unknown; addDate?: unknown };
    const logNo = parseLogNo(row.logNo);
    if (!logNo) return [];

    return [{
      logNo,
      title: decodePostTitle(String(row.title ?? '')),
      addDate: String(row.addDate ?? ''),
    }];
  });
};

export const confirmPublish = async (page: Page, frame: Frame) => {
  const confirmed = (await clickFirstAvailable(frame, PUBLISH_CONFIRM_SELECTORS)) ||
    (await clickFirstAvailable(page, PUBLISH_CONFIRM_SELECTORS));

  if (!confirmed) throw new Error(ERRORS.publishConfirmNotFound);

  try {
    await page.waitForURL((url) => isPublishedPostUrl(url.toString()), { timeout: 90_000 });
  } catch {
    // 주소가 안 바뀌어도 발행 자체는 됐을 수 있다. 목록에서 최신 글을 찾아본다.
    const recovered = await findLatestPostUrl(page);
    if (recovered) return recovered;
  }

  return page.url();
};

/** 발행 후 주소를 못 잡았을 때 내 블로그에서 가장 최근 글 주소를 읽어온다. */
export const findLatestPostUrl = async (page: Page): Promise<string | null> => {
  const blogId = /blog\.naver\.com\/([^/?#]+)/.exec(page.url())?.[1];
  if (!blogId) return null;

  try {
    await page.goto(`https://blog.naver.com/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const frame = await waitForMainFrame(page, 15_000).catch(() => null);
    const scope = frame ?? page;

    const logNo = await scope.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="logNo="], a[href*="PostView"]');
      const match = /logNo=(\d{6,})/.exec(link?.href ?? '');
      return match?.[1] ?? null;
    });

    return logNo ? `https://blog.naver.com/${blogId}/${logNo}` : null;
  } catch {
    return null;
  }
};

export type WriteBlogPostOptions = {
  title: string;
  body: string;
  onProgress?: (message: string) => void;
};

export const writeBlogPost = async (page: Page, { title, body, onProgress }: WriteBlogPostOptions) => {
  onProgress?.(PROGRESS.editorOpening);
  await page.goto(WRITE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(5000);

  if (isSessionExpired(page.url())) throw new Error(ERRORS.sessionExpired);

  const frame = await waitForMainFrame(page);
  await sleep(3000);
  await dismissPopups(frame);

  onProgress?.(PROGRESS.titleTyping);
  await typeTitle(page, frame, title);

  onProgress?.(PROGRESS.bodyTyping);
  await typeBody(page, frame, body);

  await dismissPopups(frame);

  onProgress?.(PROGRESS.publishDialogOpening);
  await openPublishDialog(page, frame);

  onProgress?.(PROGRESS.publishConfirming);
  const url = await confirmPublish(page, frame);

  return url;
};

/** blogId 는 오직 이 함수로만 얻는다. 모델 인자나 열려 있는 다른 탭 주소에서 유도하지 않는다. */
export const resolveBlogId = async (page: Page): Promise<string> => {
  await page.goto(MY_BLOG_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(3000);

  if (isSessionExpired(page.url())) throw new Error(ERRORS.sessionExpired);

  const blogId = parseBlogIdFromUrl(page.url());
  if (!blogId) throw new Error(ERRORS.blogIdNotResolved);

  return blogId;
};

const buildPostListPath = (blogId: string) =>
  `/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}` +
  `&viewdate=&currentPage=1&categoryNo=0&parentCategoryNo=&countPerPage=${POST_LIST_PAGE_SIZE}`;

/** mainFrame 이 실제로 쓰는 파라미터를 그대로 붙인다. 빼면 리다이렉트 shim 이 돌아온다. */
const buildPostViewPath = (blogId: string, logNo: string) =>
  `/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}` +
  `&redirect=Dlog&widgetTypeCall=true&directAccess=false`;

/** 상대경로 요청이라 현재 문서가 blog.naver.com 이어야 쿠키와 Referer 가 붙는다. */
const fetchFromPage = (page: Page, path: string) =>
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

export type DeleteStatus = 'deleted' | 'notFound' | 'titleMismatch' | 'unknown';

export type DeleteOutcome = {
  logNo: string;
  status: DeleteStatus;
  actualTitle?: string;
  message?: string;
};

export type DeleteSinglePostOptions = {
  blogId: string;
  logNo: string;
  expectedTitle: string;
  onProgress?: (message: string) => void;
};

const readPostTitle = async (frame: Frame): Promise<string | null> => {
  for (const selector of POST_TITLE_SELECTORS) {
    try {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) === 0) continue;

      const text = (await locator.innerText({ timeout: 3000 })).trim();
      if (text) return text;
    } catch {
      continue;
    }
  }

  return null;
};

/** 렌더된 그 글의 버튼을 누르는 쪽이 제목 재확인이 실제로 보호하는 경로다.
 *  클릭이 페이지를 넘겨 컨텍스트가 날아가도 삭제 요청은 이미 나갔을 수 있으므로 검증 단계로 흘려보낸다. */
/** 한 글에도 삭제 링크가 위아래로 두 개 붙는다. 둘은 같은 버튼이 아니다.
 *  하나는 클래스에 _param(<logNo>|...) 로 대상 글 번호를 박고 있고,
 *  다른 하나는 _param(1|...) 처럼 화면 안의 순번을 쓴다. 순번 쪽을 누르면
 *  화면 구성이 달라졌을 때 엉뚱한 글이 지워진다. 그래서 번호가 박힌 쪽만 고른다. */
const clickDeleteButton = async (frame: Frame, logNo: string): Promise<boolean> => {
  const seen = await frame
    .evaluate((target) => {
      const links = Array.from(document.querySelectorAll<HTMLElement>('a._deletePost'));
      const exact = links.filter((link) => link.className.includes(`_param(${target}|`));
      const [only] = exact;

      if (only && exact.length === 1) {
        only.click();
        return { clicked: true, exact: exact.length, links: links.length, rendered: 0 };
      }

      return {
        clicked: false,
        exact: exact.length,
        links: links.length,
        rendered: document.querySelectorAll('.se-main-container').length,
      };
    }, logNo)
    .catch(() => null);

  // evaluate 가 죽는 건 클릭이 폼을 보내며 실행 컨텍스트를 날린 경우다. 실패가 아니라 진행 신호다.
  if (!seen || seen.clicked) return true;

  // 번호가 박힌 링크가 없으면 화면에 글이 정확히 하나일 때만 눈에 보이는 링크를 쓴다.
  if (seen.rendered !== 1) {
    throw new Error(ERRORS.deleteAmbiguousDetail(seen.exact, seen.links, seen.rendered));
  }

  try {
    return await clickFirstAvailable(frame, POST_DELETE_SELECTORS);
  } catch {
    return true;
  }
};

/** 클릭 경로가 막혔을 때만 쓴다. 관측된 시그니처가 인자 4개라 arity 가 다르면 다른 함수로 보고 부르지 않는다. */
const invokeDeleteScript = async (frame: Frame, logNo: string): Promise<boolean> => {
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
const verifyDeletion = async (
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
