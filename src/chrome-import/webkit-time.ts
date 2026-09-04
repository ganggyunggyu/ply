/**
 * 크롬은 시간을 WebKit epoch(1601-01-01 UTC 기준 마이크로초)로 저장한다.
 * Unix epoch(ms)로 옮기려면 1601~1970 사이 간격(11644473600초)을 빼야 한다.
 * 0(= 방문 시각 없음)은 그대로 0으로 둔다. 음수 날짜로 변환하면 정렬이 깨진다.
 */
const WEBKIT_TO_UNIX_MS = 11644473600000;

export const webkitToUnixMs = (webkit: number): number => {
  if (!webkit || webkit <= 0) return 0;
  return Math.round(webkit / 1000 - WEBKIT_TO_UNIX_MS);
};
