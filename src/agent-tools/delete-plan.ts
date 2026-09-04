import { TOOL_RESULTS as RESULT } from '../prompts';
import { MAX_DELETE_PER_CALL, MAX_DELETE_PER_RUN, type KnownPost } from './post-limits';
import { resolveDeleteTargets } from './delete-targets';

export type DeletionPlan =
  | { ok: false; result: string }
  | { ok: true; blogId: string; targets: KnownPost[] };

/** 브라우저를 열기 전에 끝나는 판정 전부. 승인 게이트 앞의 관문들이라 순수 함수로 둔다. */
export const planDeletion = ({
  raw,
  known,
  attempted,
  refused,
  accountId,
}: {
  raw: unknown;
  known: Map<string, KnownPost>;
  attempted: Set<string>;
  refused: Set<string>;
  accountId: string;
}): DeletionPlan => {
  const check = resolveDeleteTargets(raw, known, accountId);

  if (!check.ok) {
    if (check.reason === 'empty') return { ok: false, result: RESULT.deleteNoTargets };
    if (check.reason === 'invalid') return { ok: false, result: RESULT.deleteInvalidLogNo(check.detail) };
    if (check.reason === 'tooMany') return { ok: false, result: RESULT.deleteTooMany(MAX_DELETE_PER_CALL) };
    if (check.reason === 'accountMismatch') return { ok: false, result: RESULT.deleteAccountMismatch };

    return { ok: false, result: RESULT.deleteUnknownLogNo(check.detail) };
  }

  // 거절을 기록하지 않으면 모델이 같은 목록으로 즉시 다시 물어 확인 피로를 만든다.
  const refusedAgain = check.logNos.filter((logNo) => refused.has(logNo));
  if (refusedAgain.length > 0) return { ok: false, result: RESULT.deleteRefusedEarlier(refusedAgain) };

  // 목록이 한 칸 밀린 채로 두 번째 글을 지우는 시나리오를 원천 차단한다.
  const retried = check.logNos.filter((logNo) => attempted.has(logNo));
  if (retried.length > 0) return { ok: false, result: RESULT.deleteRetryBlocked(retried) };

  // 성공 건수가 아니라 시도 건수로 센다. 검증이 unknown 으로 떨어져도 상한이 열리지 않아야 한다.
  if (attempted.size + check.logNos.length > MAX_DELETE_PER_RUN) {
    return { ok: false, result: RESULT.deleteRunLimit(MAX_DELETE_PER_RUN) };
  }

  const targets = check.logNos.map((logNo) => known.get(logNo) as KnownPost);
  const blogIds = [...new Set(targets.map(({ blogId }) => blogId))];
  if (blogIds.length !== 1) return { ok: false, result: RESULT.deleteBlogMismatch };

  const [blogId] = blogIds as [string];

  return { ok: true, blogId, targets };
};
