import type { AgentCardOutcome, DabutSyncStatus } from '../bridge';
import { TOOL_RESULTS as RESULT } from '../prompts';

/**
 * 카드가 돌려준 답을 좁힌다. 못 읽으면 취소로 본다.
 * 값을 지어내는 것보다 아무것도 안 한 것으로 두는 쪽이 낫다.
 */
export const parseCardOutcome = (raw: string): AgentCardOutcome => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'cancelled' };

    const outcome = parsed as AgentCardOutcome;

    return outcome.status === 'exposure_login' ||
      outcome.status === 'account_added' ||
      outcome.status === 'account_password'
      ? outcome
      : { status: 'cancelled' };
  } catch {
    return { status: 'cancelled' };
  }
};

/** 다붓 반영 결과 한 줄. 로컬 줄과 반드시 따로 낸다. */
export const describeDabutSync = (status: DabutSyncStatus, detail: string): string => {
  if (status === 'changed') return RESULT.accountDabutChanged(detail);
  if (status === 'no_match') return RESULT.accountDabutNoMatch;
  if (status === 'no_login') return RESULT.accountDabutNoLogin;

  return RESULT.accountDabutFailed(detail);
};
