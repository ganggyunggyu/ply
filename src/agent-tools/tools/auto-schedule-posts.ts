import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { IMAGE_SOURCES, MANUSCRIPT_TYPES, SCHEDULE_LIMITS } from '../../scheduler-enums';
import { kstMinutesNow, kstToday } from '../../clock';
import { autoSchedulePosts, describeSchedulerError, readAutoScheduleResult } from '../../hub';
import { buildAutoScheduleInput } from '../auto-schedule-build';
import type { ToolRuntime } from '../runtime';

export const createAutoSchedulePostsTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getSchedulerToken, knownProjectIds, onProgress, getEndpoints } = runtime;

  const autoSchedule: ToolSpec = {
    name: 'auto_schedule_posts',
    description:
      DESC.autoSchedulePosts,
    parameters: {
      type: 'object',
      properties: {
        scheduleDate: { type: 'string', description: PARAM.scheduleDate },
        accountId: {
          type: 'string',
          description:
            PARAM.schedulerAccountId,
        },
        keywords: { type: 'array', items: { type: 'string' } },
        blogName: { type: 'string', description: PARAM.blogName },
        postsPerDay: {
          type: 'number',
          description: PARAM.postsPerDay,
          minimum: SCHEDULE_LIMITS.postsPerDayMin,
          maximum: SCHEDULE_LIMITS.postsPerDayMax,
        },
        startHour: {
          type: 'number',
          description: PARAM.startHour,
          minimum: SCHEDULE_LIMITS.startHourMin,
          maximum: SCHEDULE_LIMITS.startHourMax,
        },
        intervalMinutes: {
          type: 'number',
          description: PARAM.intervalMinutes,
          minimum: SCHEDULE_LIMITS.intervalMinutesMin,
          maximum: SCHEDULE_LIMITS.intervalMinutesMax,
        },
        manuscriptType: {
          type: 'string',
          enum: [...MANUSCRIPT_TYPES],
          description: PARAM.manuscriptType,
        },
        imageSource: { type: 'string', enum: [...IMAGE_SOURCES], description: PARAM.imageSource },
        projectId: { type: 'string', description: PARAM.scheduleProjectId },
        keywordCategory: { type: 'string', description: PARAM.keywordCategory },
      },
      required: ['scheduleDate', 'accountId', 'keywords', 'startHour'],
      additionalProperties: false,
    },
    run: async (input) => {
      // accountId 는 다붓이 준 계정 id 라서 스케줄러가 토큰 없이는 크리덴셜을 풀지 못한다.
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      // 실행이 자정을 넘길 수 있으므로 부를 때마다 읽는다.
      const built = buildAutoScheduleInput(input, {
        knownProjectIds,
        today: kstToday(),
        nowMinutes: kstMinutesNow(),
      });
      if (!built.ok) return built.result;

      const { scheduleDate, queues } = built.input;
      const keywordCount = queues.reduce((sum, { keywords }) => sum + keywords.length, 0);

      onProgress(PROGRESS.scheduleRegistering(scheduleDate, keywordCount));

      let data: unknown;

      try {
        data = await autoSchedulePosts({
          baseUrl: getEndpoints().schedulerBaseUrl,
          token: getSchedulerToken(),
          ...built.input,
        });
      } catch (error) {
        // 400 본문에는 어떤 필드가 틀렸는지가 들어 있다. axios 메시지만 올리면 그게 사라진다.
        return RESULT.scheduleFailed(describeSchedulerError(error));
      }

      const { ok, message, totalJobs, reused, scheduleIds } = readAutoScheduleResult(data);

      // 응답 원문을 잘라 넣으면 키워드가 많을 때 JSON 이 중간에서 끊겨 모델이 파싱할 수 없는
      // 텍스트가 컨텍스트에 남는다. 필요한 것은 잡 목록이 아니라 되읽을 scheduleId 뿐이다.
      // 나머지는 어차피 get_schedule 로 서버에서 다시 읽어야 한다.
      const payload = JSON.stringify({ scheduleIds, totalJobs, reused });

      // 계정 해석 실패는 HTTP 200 + success:false 로 온다. 그대로 완료로 보고하면
      // 아무것도 큐에 안 들어간 채 "예약 등록 완료" 로 끝난다.
      if (!ok) return RESULT.scheduleFailed(message || JSON.stringify(data).slice(0, 600));
      if (reused) return RESULT.scheduleReused(totalJobs, payload);

      return RESULT.scheduled(payload);
    },
  };

  return [autoSchedule];
};
