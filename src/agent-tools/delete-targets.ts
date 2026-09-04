import type { RecentPost } from '../naver';
import { parseLogNo } from '../naver';
import { MAX_DELETE_PER_CALL, type KnownPost } from './post-limits';

export type DeleteTargetCheck =
  | { ok: true; logNos: string[] }
  | { ok: false; reason: 'empty' | 'invalid' | 'tooMany' | 'unknown' | 'accountMismatch'; detail: string[] };

/** 모델이 준 배열을 이번 실행의 목록 결과와 대조한다. 판정 순서를 바꾸지 않는다. */
export const resolveDeleteTargets = (
  raw: unknown,
  known: Map<string, KnownPost>,
  accountId: string,
): DeleteTargetCheck => {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'empty', detail: [] };

  const invalid: string[] = [];
  const logNos: string[] = [];

  for (const item of raw) {
    const logNo = parseLogNo(item);
    if (!logNo) invalid.push(String(item).slice(0, 40));
    else if (!logNos.includes(logNo)) logNos.push(logNo);
  }

  if (invalid.length > 0) return { ok: false, reason: 'invalid', detail: invalid };
  if (logNos.length > MAX_DELETE_PER_CALL) return { ok: false, reason: 'tooMany', detail: logNos };

  const missing = logNos.filter((logNo) => !known.has(logNo));
  if (missing.length > 0) return { ok: false, reason: 'unknown', detail: missing };

  const mismatched = logNos.filter((logNo) => known.get(logNo)?.accountId !== accountId);
  if (mismatched.length > 0) return { ok: false, reason: 'accountMismatch', detail: mismatched };

  return { ok: true, logNos };
};

export const toKnownPosts = (posts: RecentPost[], blogId: string, accountId: string): KnownPost[] =>
  posts.map(({ logNo, title, addDate }) => ({ logNo, title, addDate, blogId, accountId }));
