import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { SCHEDULE_STATUSES } from '../../scheduler-enums';
import { describeSchedulerError, listSchedules } from '../../hub';
import { resolveScheduleAccountFilter, mergeScheduleLists } from '../schedule-lists';
import { MAX_LIST_SCHEDULES } from '../schedule-constants';
import { isOwnedSchedule, describeScheduleAccount } from '../owned-accounts';
import { toKnownSchedules } from '../known-schedules';
import { scheduleStatusLabel } from '../schedule-format';
import type { ToolRuntime } from '../runtime';

export const createListSchedulesTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getSchedulerToken, loadOwnedAccounts, onProgress, getEndpoints, knownSchedules } = runtime;

  const listSchedulesTool: ToolSpec = {
    name: 'list_schedules',
    description: DESC.listSchedules,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.scheduleAccountFilter },
        status: {
          type: 'string',
          enum: [...SCHEDULE_STATUSES],
          description: PARAM.scheduleStatusFilter,
        },
      },
      additionalProperties: false,
    },
    run: async ({ accountId, status }) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const ownedResult = await loadOwnedAccounts();
      if (!ownedResult.ok) return ownedResult.result;

      const { owned } = ownedResult;
      const filter = resolveScheduleAccountFilter(accountId, owned);
      if (!filter.ok) return filter.result;

      onProgress(PROGRESS.scheduleListLoading);

      try {
        // 필터 없이 부르면 스케줄러가 테넌트 구분 없이 최근 50건을 준다. 남의 예약이 섞이는 것도
        // 문제지만, 다른 사용자가 바쁘면 내 예약이 그 50건 밖으로 밀려 아예 안 보이기도 한다.
        // 그래서 내 계정마다 따로 물어보고 여기서 다시 최신순으로 합친다.
        const lists = await Promise.all(
          filter.accounts.map(({ loginId }) =>
            listSchedules({
              baseUrl: getEndpoints().schedulerBaseUrl,
              token: getSchedulerToken(),
              accountId: loginId,
              status: status ? String(status) : undefined,
            }),
          ),
        );

        // 계정을 지정해 물었어도 서버가 걸러 준다고 믿지 않는다. 소유 판정은 우리가 한다.
        const schedules = mergeScheduleLists(lists, MAX_LIST_SCHEDULES).filter(({ accountId: owner }) =>
          isOwnedSchedule(owner, owned),
        );

        if (schedules.length === 0) return RESULT.noSchedules;

        // 취소가 받을 수 있는 scheduleId 를 여기서 확정한다. 읽은 적 없는 id 는 이후에 거부된다.
        toKnownSchedules(schedules).forEach((schedule) => knownSchedules.set(schedule.id, schedule));

        // 계정은 네이버 로그인 id 원문 대신 사용자가 붙여 둔 이름으로 낸다.
        return JSON.stringify(
          schedules.map((schedule) => ({
            scheduleId: schedule.id,
            scheduleDate: schedule.scheduleDate,
            account: describeScheduleAccount(schedule.accountId, owned),
            status: scheduleStatusLabel(schedule.status),
            totalJobs: schedule.totalJobs,
            completedJobs: schedule.completedJobs,
            failedJobs: schedule.failedJobs,
          })),
        );
      } catch (error) {
        return RESULT.scheduleReadFailed(describeSchedulerError(error));
      }
    },
  };

  return [listSchedulesTool];
};
