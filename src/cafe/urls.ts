export type CafeTarget = {
  cafeId: string;
  /** `https://cafe.naver.com/<slug>` 또는 슬러그 자체. 없으면 숫자 id 경로로 간다. */
  cafeUrl?: string;
  name?: string;
};

/**
 * 카페 주소에서 슬러그를 뽑는다.
 *
 * `ca-fe` 는 슬러그가 아니라 숫자 id 로 가는 새 경로의 접두사다. 그걸 슬러그로 쓰면
 * 존재하지 않는 카페로 간다.
 */
export const toCafeSlug = (cafeUrl?: string): string | undefined => {
  const trimmed = cafeUrl?.trim();
  if (!trimmed) return undefined;

  if (!/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^\/+/, '') || undefined;

  const [first] = new URL(trimmed).pathname.split('/').filter(Boolean);
  if (!first || first === 'ca-fe') return undefined;

  return first;
};

export const toMobileCafeHomeUrl = ({ cafeId, cafeUrl }: CafeTarget): string => {
  const slug = toCafeSlug(cafeUrl);

  return slug
    ? `https://m.cafe.naver.com/${slug}`
    : `https://m.cafe.naver.com/ca-fe/web/cafes/${cafeId}`;
};

export const toPcCafeHomeUrl = ({ cafeId, cafeUrl }: CafeTarget): string => {
  const slug = toCafeSlug(cafeUrl);

  return slug ? `https://cafe.naver.com/${slug}` : `https://cafe.naver.com/ca-fe/cafes/${cafeId}`;
};

export const toArticleUrl = ({ cafeId, cafeUrl }: CafeTarget, articleId: string | number): string => {
  const slug = toCafeSlug(cafeUrl);

  return slug
    ? `https://cafe.naver.com/${slug}/${articleId}`
    : `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`;
};

/** 카페 별명은 한글·영숫자만 받고 20자에서 끊는다. 그대로 넣으면 폼이 되돌려보낸다. */
export const sanitizeNickname = (nickname: string, fallback = '회원'): string => {
  const clean = (value: string) => value.replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 20);

  return clean(nickname) || clean(fallback) || '회원';
};
