import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import {
  cancelSchedule,
  describeSchedulerError,
  getSchedule,
  isScheduleNotFound,
  type ScheduleJobDetail,
  type ScheduleSummary,
} from '../../hub';
import { planScheduleCancel } from '../schedule-cancel-plan';
import { requestScheduleCancelApproval } from '../schedule-cancel-approval';
import { isOwnedSchedule } from '../owned-accounts';
import { countPublishedJobs, countStoppableJobs } from '../schedule-job-status';
import { toKnownSchedules } from '../known-schedules';
import type { ToolRuntime } from '../runtime';

export const createCancelScheduleTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getSchedulerToken, knownSchedules, attemptedScheduleIds, refusedScheduleIds, loadOwnedAccounts, getEndpoints, onProgress, askUser } = runtime;

  const cancelScheduleTool: ToolSpec = {
    name: 'cancel_schedule',
    description: DESC.cancelSchedule,
    parameters: {
      type: 'object',
      properties: { scheduleId: { type: 'string', description: PARAM.scheduleId } },
      required: ['scheduleId'],
      additionalProperties: false,
    },
    run: async (input) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const plan = planScheduleCancel({
        raw: input.scheduleId,
        known: knownSchedules,
        attempted: attemptedScheduleIds,
        refused: refusedScheduleIds,
      });

      if (!plan.ok) return plan.result;

      const ownedResult = await loadOwnedAccounts();
      if (!ownedResult.ok) return ownedResult.result;

      const { owned } = ownedResult;
      const { scheduleId } = plan;
      const endpoint = { baseUrl: getEndpoints().schedulerBaseUrl, token: getSchedulerToken(), scheduleId };

      // 목록에는 키워드도 시각도 없다. 확인 문안을 만들려면 상세를 직접 한 번 읽어야 한다.
      // 서버의 지금 상태로 묻게 되므로 "목록이 낡아서 엉뚱한 걸 취소" 하는 구간이 없다.
      onProgress(PROGRESS.scheduleDetailLoading(scheduleId));

      let schedule: ScheduleSummary | null;
      let jobs: ScheduleJobDetail[];

      try {
        ({ schedule, jobs } = await getSchedule(endpoint));
      } catch (error) {
        if (isScheduleNotFound(error)) return RESULT.scheduleNotFound(scheduleId);

        return RESULT.scheduleReadFailed(describeSchedulerError(error));
      }

      if (!schedule) return RESULT.scheduleNotFound(scheduleId);

      // DELETE /schedules/:id 의 소유자 확인도 서버 설정에 달려 있다. 방금 서버에서 읽은 계정으로 여기서도 막는다.
      // 확인 카드를 띄우기 전에 끊어야 사용자가 남의 예약 취소를 승인할 기회조차 생기지 않는다.
      if (!isOwnedSchedule(schedule.accountId, owned)) {
        knownSchedules.delete(scheduleId);

        return RESULT.scheduleNotOwned(scheduleId);
      }

      if (schedule.status === 'cancelled') return RESULT.scheduleAlreadyCancelled(scheduleId);

      onProgress(PROGRESS.scheduleCancelConfirmWaiting(scheduleId));

      const { approved, answer, answered } = await requestScheduleCancelApproval({
        askUser,
        schedule,
        jobs,
        owned,
      });

      if (!approved) {
        refusedScheduleIds.add(scheduleId);

        // 답이 없어 시간이 지난 것을 거절로 적으면 사용자가 하지 않은 답변을 지어내게 된다.
        return answered ? RESULT.scheduleCancelNotApproved(answer) : RESULT.scheduleCancelNoAnswer(scheduleId);
      }

      // 확인 카드에 적은 숫자와 결과에 적을 숫자는 같은 스냅샷에서 나와야 한다.
      const stoppable = countStoppableJobs(jobs);
      const published = countPublishedJobs(jobs);

      // 기록은 보내기 직전에 남긴다. 응답이 끊겨도 서버에서는 이미 처리됐을 수 있다.
      attemptedScheduleIds.add(scheduleId);
      onProgress(PROGRESS.scheduleCancelling(scheduleId));

      try {
        const { ok } = await cancelSchedule(endpoint);
        if (!ok) return RESULT.scheduleCancelNotConfirmed(scheduleId);
      } catch (error) {
        return RESULT.scheduleCancelFailed(describeSchedulerError(error));
      }

      // known 에서 지우면 같은 id 로 다시 불렸을 때 "읽은 적 없다" 는 사실이 아닌 이유가 나간다.
      // 상태만 갱신해서 남겨 두면 attempted 가드가 먼저 걸려 참인 이유를 돌려준다.
      toKnownSchedules([{ ...schedule, status: 'cancelled' }]).forEach((row) =>
        knownSchedules.set(row.id, row),
      );

      return RESULT.scheduleCancelled(scheduleId, stoppable, jobs.length, published);
    },
  };

  return [cancelScheduleTool];
};
