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
