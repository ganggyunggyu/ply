import type { ScheduleSummary } from '../hub';
import { TOOL_RESULTS as RESULT } from '../prompts';
import { normalizeAccountKey, type OwnedAccount } from './owned-accounts';
import { MAX_SCHEDULE_ACCOUNTS } from './schedule-constants';

export type AccountFilterResolution =
  | { ok: true; accounts: OwnedAccount[] }
  | { ok: false; result: string };

/**
 * 모델이 준 accountId 필터를 내 계정으로 좁힌다.
 *
 * 예전에는 목록이 마스킹한 계정만 보여줘서 모델이 넣을 수 있는 유효한 값이 존재하지 않았고,
 * 무엇을 넣든 조용히 빈 결과가 됐다. 이제 list_scheduler_accounts 의 id·이름·로그인 id 를 전부 받고,
 * 못 맞추면 조용히 비우는 대신 거부한다.
 */
export const resolveScheduleAccountFilter = (
  raw: unknown,
  owned: ReadonlyMap<string, OwnedAccount>,
): AccountFilterResolution => {
  const accounts = [...owned.values()];
  const wanted = normalizeAccountKey(raw);

  if (!wanted) {
    if (accounts.length > MAX_SCHEDULE_ACCOUNTS) {
      return { ok: false, result: RESULT.scheduleTooManyAccounts(accounts.length, MAX_SCHEDULE_ACCOUNTS) };
    }

    return { ok: true, accounts };
  }

  const matched = accounts.find(
    ({ id, name, blogId, loginId }) =>
      normalizeAccountKey(id) === wanted ||
      normalizeAccountKey(name) === wanted ||
      normalizeAccountKey(blogId) === wanted ||
      normalizeAccountKey(loginId) === wanted,
  );

  if (!matched) return { ok: false, result: RESULT.scheduleAccountFilterUnknown(String(raw)) };

  return { ok: true, accounts: [matched] };
};

/**
 * 여러 계정에서 받은 목록을 하나로 합친다. 계정마다 최근 50건이 따로 오므로
 * 등록 시각으로 다시 최신순을 만들어야 한 계정이 목록을 독차지하지 않는다.
 */
export const mergeScheduleLists = (lists: ScheduleSummary[][], limit: number): ScheduleSummary[] => {
  const merged = new Map<string, ScheduleSummary>();

  lists.flat().forEach((schedule) => merged.set(schedule.id, schedule));

  return [...merged.values()]
    .sort((left, right) => {
      const byCreated = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      if (Number.isFinite(byCreated) && byCreated !== 0) return byCreated;

      return right.scheduleDate.localeCompare(left.scheduleDate);
    })
    .slice(0, limit);
};
