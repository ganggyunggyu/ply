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
