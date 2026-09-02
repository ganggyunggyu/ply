import { HOME_URL, SEARCH_URL } from './constants';

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const LOCALHOST_PATTERN = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;
const DOMAIN_PATTERN = /^[^\s/]+\.[^\s/.]{2,}(:\d+)?([/?#]|$)/;

export const normalizeUrl = (input: string) => {
  const trimmed = input.trim();

  if (!trimmed) return HOME_URL;
  if (LOCALHOST_PATTERN.test(trimmed)) return `http://${trimmed}`;
  if (SCHEME_PATTERN.test(trimmed)) return trimmed;
  if (DOMAIN_PATTERN.test(trimmed)) return `https://${trimmed}`;

  return `${SEARCH_URL}${encodeURIComponent(trimmed)}`;
};

/**
 * 서비스 주소는 주소창과 달리 추측하지 않는다. 끝 슬래시만 떼고 나머지는 그대로 둔다.
 * 이 값은 시스템 프롬프트에 실려 도구 호출로 나가기 때문에 조용히 틀린 주소가 되면 안 된다.
 */
export const normalizeServiceUrl = (input: string) => input.trim().replace(/\/+$/, '');

export const isServiceUrl = (input: string) => {
  try {
    const { protocol } = new URL(input);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
