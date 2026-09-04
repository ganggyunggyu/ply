import { BLOG_HOST } from './urls';

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

/** 페이지 이름을 blogId 로 오인하면 남의 블로그를 지운다. */
export const RESERVED_BLOG_PATHS = new Set([
  'prologue', 'postlist', 'postview', 'guestbook', 'memo', 'category',
  'recommend', 'buddy', 'widget', 'goblogwrite', 'blogwrite', 'admin',
  'manage', 'section', 'rss', 'api', 'post', 'common', 'main', 'myblog',
]);

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
