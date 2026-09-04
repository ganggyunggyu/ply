import axios from 'axios';
import { bearer } from './http';
import type { AutoScheduleInput } from './auto-schedule-types';

/**
 * /bot/auto-schedule 의 pythonCompatSchema 는 최상위가 전부 snake_case 다.
 * zod 가 non-strict 라 이름이 어긋난 키는 400 없이 조용히 버려진다.
 * 그래서 이 변환을 한 곳에 모아두고 테스트로 이름을 고정한다.
 */
export const buildAutoScheduleBody = ({
  scheduleDate,
  queues,
  postsPerDay,
  startHour,
  intervalMinutes,
  manuscriptType,
  imageSource,
  keywordCategory,
  projectId,
}: AutoScheduleInput): Record<string, unknown> => {
  const body: Record<string, unknown> = { schedule_date: scheduleDate, queues };

  if (postsPerDay !== undefined) body.posts_per_day = postsPerDay;
  if (startHour !== undefined) body.start_hour = startHour;
  if (intervalMinutes !== undefined) body.interval_minutes = intervalMinutes;
  if (manuscriptType) body.manuscript_type = manuscriptType;
  if (imageSource) body.image_source = imageSource;
  if (keywordCategory) body.keyword_category = keywordCategory;
  if (projectId) body.project_id = projectId;

  return body;
};

export const autoSchedulePosts = async ({
  baseUrl,
  token,
  ...input
}: AutoScheduleInput & { baseUrl: string; token?: string }) => {
  const { data } = await axios.post(`${baseUrl}/bot/auto-schedule`, buildAutoScheduleBody(input), {
    timeout: 120_000,
    headers: bearer(token),
  });

  return data as unknown;
};

export type AutoScheduleOutcome = {
  ok: boolean;
  message: string;
  totalJobs: number;
  reused: boolean;
  /** 등록된 예약의 id. get_schedule 로 저장값을 되읽는 유일한 실마리라 따로 뽑아 둔다. */
  scheduleIds: string[];
};

/**
 * /bot/auto-schedule 은 실패해도 HTTP 200 을 준다. 계정 크리덴셜 복호화 실패나
 * item_options 길이 불일치는 axios 가 던지지 않고 { success: false, message } 로 돌아온다.
 * 그래서 status 가 아니라 본문을 봐야 실패를 안다.
 *
 * reused 는 같은 지문의 기존 예약을 그대로 돌려줬다는 뜻이다. 새 잡이 생기지 않았으므로
 * 완료로 보고하면 안 된다. 스케줄러의 지문에는 project_id 가 빠져 있어서, 프로젝트만 바꿔
 * 다시 걸면 여기로 떨어지고 변경이 반영되지 않는다.
 */
export const readAutoScheduleResult = (data: unknown): AutoScheduleOutcome => {
  const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const schedules = Array.isArray(body.schedules) ? body.schedules : [];
  const totalJobs = Number(body.totalJobs);

  return {
    ok: body.success === true,
    message: typeof body.message === 'string' ? body.message : '',
    totalJobs: Number.isFinite(totalJobs) ? totalJobs : 0,
    reused: schedules.some((row) => (row as Record<string, unknown> | null)?.reused === true),
    scheduleIds: schedules
      .map((row) => {
        const { scheduleId, id, _id } = (row ?? {}) as Record<string, unknown>;

        return scheduleId === undefined || scheduleId === null
          ? String(id ?? _id ?? '')
          : String(scheduleId);
      })
      .filter((id) => id !== ''),
  };
};
