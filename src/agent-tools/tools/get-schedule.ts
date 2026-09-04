import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { describeSchedulerError, getSchedule, isScheduleNotFound } from '../../hub';
import { isOwnedSchedule } from '../owned-accounts';
import { toKnownSchedules } from '../known-schedules';
import { scheduleStatusLabel, formatScheduleJobRows } from '../schedule-format';
import type { ToolRuntime } from '../runtime';

export const createGetScheduleTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getSchedulerToken, loadOwnedAccounts, onProgress, getEndpoints, knownSchedules, projectLabels } = runtime;

  const getScheduleTool: ToolSpec = {
    name: 'get_schedule',
    description: DESC.getSchedule,
    parameters: {
      type: 'object',
      properties: { scheduleId: { type: 'string', description: PARAM.scheduleId } },
      required: ['scheduleId'],
      additionalProperties: false,
    },
    run: async ({ scheduleId }) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const id = scheduleId === undefined || scheduleId === null ? '' : String(scheduleId).trim();
      if (!id) return RESULT.scheduleIdRequired;

      const ownedResult = await loadOwnedAccounts();
      if (!ownedResult.ok) return ownedResult.result;

      const { owned } = ownedResult;

      onProgress(PROGRESS.scheduleDetailLoading(id));

      try {
        const { schedule, jobs } = await getSchedule({
          baseUrl: getEndpoints().schedulerBaseUrl,
          token: getSchedulerToken(),
          scheduleId: id,
        });

        if (!schedule) return RESULT.scheduleNotFound(id);

        // 이 라우트의 소유자 스코프는 서버 설정에 달려 있다. 꺼진 배포에서 남의 예약을 읽어
        // knownSchedules 에 넣으면 취소 게이트가 그 id 를 "내가 읽은 것" 으로 인정해 버린다.
        if (!isOwnedSchedule(schedule.accountId, owned)) return RESULT.scheduleNotOwned(id);

        toKnownSchedules([schedule]).forEach((row) => knownSchedules.set(row.id, row));

        if (jobs.length === 0) return RESULT.scheduleNoJobs(id, scheduleStatusLabel(schedule.status));

        return JSON.stringify(formatScheduleJobRows(jobs, projectLabels));
      } catch (error) {
        // axios 는 404 를 던지므로 "없는 예약" 은 schedule === null 이 아니라 여기로 온다.
        if (isScheduleNotFound(error)) return RESULT.scheduleNotFound(id);

        return RESULT.scheduleReadFailed(describeSchedulerError(error));
      }
    },
  };

  return [getScheduleTool];
};
