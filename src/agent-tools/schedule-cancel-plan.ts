import { TOOL_RESULTS as RESULT } from '../prompts';
import type { KnownSchedule } from './known-schedules';
import { MAX_CANCEL_PER_RUN } from './schedule-constants';

export type ScheduleCancelPlan =
  | { ok: false; result: string }
  | { ok: true; scheduleId: string };

/**
 * 네트워크를 타기 전에 끝나는 판정 전부. 판정 순서를 바꾸지 않는다.
 *
 * known 은 이번 실행에서 list_schedules 나 get_schedule 이 서버에서 실제로 읽어 왔고
 * 소유 확인까지 통과한 예약이다. 모델이 이전 대화의 기억으로 sch_ 문자열을 들고 오는 것이
 * 실제 위험이라, 읽은 적 없는 id 는 여기서 끊는다.
 *
 * attempted 를 known 보다 먼저 본다. 취소에 성공하면 그 예약의 상태를 갱신하지만,
 * 만약 known 에서 사라진 상태로 다시 불리면 "읽은 적 없다" 는 사실이 아닌 이유를 돌려주게 된다.
 * 이미 시도했다는 사실이 언제나 더 구체적이고 참인 이유다.
 */
export const planScheduleCancel = ({
  raw,
  known,
  attempted,
  refused,
}: {
  raw: unknown;
  known: Map<string, KnownSchedule>;
  attempted: Set<string>;
  refused: Set<string>;
}): ScheduleCancelPlan => {
  const scheduleId = raw === undefined || raw === null ? '' : String(raw).trim();

  if (!scheduleId) return { ok: false, result: RESULT.scheduleIdRequired };

  // 취소는 실패처럼 보여도 큐에서는 이미 빠졌을 수 있다. 삭제와 같은 이유로 재시도를 막는다.
  if (attempted.has(scheduleId)) return { ok: false, result: RESULT.scheduleCancelRetryBlocked(scheduleId) };

  // 거절을 기록하지 않으면 모델이 같은 예약으로 즉시 다시 물어 확인 피로를 만든다.
  if (refused.has(scheduleId)) return { ok: false, result: RESULT.scheduleCancelRefusedEarlier(scheduleId) };

  if (!known.has(scheduleId)) return { ok: false, result: RESULT.scheduleNotRead(scheduleId) };

  if (attempted.size + 1 > MAX_CANCEL_PER_RUN) {
    return { ok: false, result: RESULT.scheduleCancelRunLimit(MAX_CANCEL_PER_RUN) };
  }

  return { ok: true, scheduleId };
};
