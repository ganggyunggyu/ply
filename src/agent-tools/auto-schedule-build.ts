import type { AutoScheduleInput } from '../hub';
import {
  isImageSource,
  isManuscriptType,
  SCHEDULE_LIMITS,
  type ImageSource,
  type ManuscriptType,
} from '../scheduler-enums';
import { TOOL_RESULTS as RESULT } from '../prompts';

export type AutoScheduleBuild =
  | { ok: false; result: string }
  | { ok: true; input: AutoScheduleInput };

const outOfRange = (value: number | undefined, min: number, max: number) =>
  value !== undefined && (!Number.isFinite(value) || value < min || value > max);

const optionalNumber = (raw: unknown) => (raw === undefined || raw === null ? undefined : Number(raw));

const SCHEDULE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 스케줄러의 schedule_date 에는 형식 검증이 없다. 어긋난 값이 두 갈래로 샌다.
 * 2026-9-2 나 2026-13-01 은 Invalid Date 가 되어 서버가 포맷 단계에서 500 으로 죽고,
 * 모델에게는 "status code 500" 만 남는다.
 * 2026-02-31 은 죽지도 않고 3월로 굴러가 사용자가 말한 적 없는 날에 예약이 걸린다.
 * 둘 다 여기서 막는다.
 */
const isCalendarDate = (value: string) => {
  if (!SCHEDULE_DATE_PATTERN.test(value)) return false;

  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time)) return false;

  // 2026-02-31 은 던지지 않고 3월로 굴러간다. 되찍어 같은 날인지 봐야 다른 날에 조용히 걸리지 않는다.
  return new Date(time).toISOString().slice(0, 10) === value;
};

/**
 * 도구 인자를 스케줄러 호출 입력으로 옮긴다. 네트워크를 타지 않는 판정은 전부 여기서 끝낸다.
 *
 * 계정은 dabutAccountId 로 보낸다. list_scheduler_accounts 가 주는 값은 다붓의 Mongo _id 인데
 * 스케줄러의 account.id 는 네이버 로그인 id 라서, id 로 보내면 계정 해석 단계에서 죽는다.
 *
 * knownProjectIds 는 이번 실행에서 list_dabut_projects 가 돌려준 id 다. 폼이 라벨을 보여주고
 * id 를 돌려주더라도 모델이 다른 값을 실어 보낼 수 있고, 스케줄러는 min(1) 문자열이면 뭐든 받는다.
 * 틀린 프로젝트로 나간 건 몇 시간 뒤 생성 시점에나 드러나므로 여기서 대조한다.
 *
 * today 는 KST 기준 YYYY-MM-DD 다. 비교는 문자열 사전순으로 한다.
 * YYYY-MM-DD 는 사전순이 곧 시간순이라 타임존 변환 없이 안전하다.
 *
 * nowMinutes 는 KST 자정으로부터 지난 분이다. 날짜가 오늘일 때만 쓴다.
 */
export const buildAutoScheduleInput = (
  raw: Record<string, unknown>,
  {
    knownProjectIds,
    today,
    nowMinutes,
  }: { knownProjectIds: ReadonlySet<string>; today: string; nowMinutes: number },
): AutoScheduleBuild => {
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.map(String).filter((keyword) => keyword.trim() !== '')
    : [];

  if (keywords.length === 0) return { ok: false, result: RESULT.emptyKeywords };

  const accountId = raw.accountId === undefined ? '' : String(raw.accountId).trim();
  if (!accountId) return { ok: false, result: RESULT.schedulerAccountRequired };

  const scheduleDate = raw.scheduleDate === undefined ? '' : String(raw.scheduleDate).trim();
  if (!scheduleDate) return { ok: false, result: RESULT.scheduleDateRequired };
  if (!isCalendarDate(scheduleDate)) {
    return { ok: false, result: RESULT.scheduleDateFormat(scheduleDate) };
  }
  if (scheduleDate < today) {
    return { ok: false, result: RESULT.scheduleDatePast(scheduleDate, today) };
  }

  const projectId = raw.projectId === undefined || raw.projectId === null ? '' : String(raw.projectId).trim();
  if (projectId && knownProjectIds.size === 0) {
    return { ok: false, result: RESULT.projectNotListed };
  }
  if (projectId && !knownProjectIds.has(projectId)) {
    return { ok: false, result: RESULT.projectNotFound(projectId) };
  }

  if (raw.manuscriptType !== undefined && !isManuscriptType(raw.manuscriptType)) {
    return { ok: false, result: RESULT.unknownManuscriptType(String(raw.manuscriptType)) };
  }
  if (raw.imageSource !== undefined && !isImageSource(raw.imageSource)) {
    return { ok: false, result: RESULT.unknownImageSource(String(raw.imageSource)) };
  }

  const postsPerDay = optionalNumber(raw.postsPerDay);
  const startHour = optionalNumber(raw.startHour);
  const intervalMinutes = optionalNumber(raw.intervalMinutes);
  const {
    startHourMin,
    startHourMax,
    intervalMinutesMin,
    intervalMinutesMax,
    postsPerDayMin,
    postsPerDayMax,
  } = SCHEDULE_LIMITS;

  if (outOfRange(postsPerDay, postsPerDayMin, postsPerDayMax)) {
    return { ok: false, result: RESULT.scheduleOutOfRange('postsPerDay', postsPerDayMin, postsPerDayMax) };
  }
  // 빠지면 hub 가 body 에서 통째로 빼고 서버 기본값이 쓰인다. 사용자가 정하지 않은 시각에 글이 올라간다.
  if (startHour === undefined) return { ok: false, result: RESULT.scheduleStartHourRequired };
  if (outOfRange(startHour, startHourMin, startHourMax)) {
    return { ok: false, result: RESULT.scheduleOutOfRange('startHour', startHourMin, startHourMax) };
  }
  // 날짜만 거르면 22시에 "오늘 06시" 를 거는 것을 못 막는다. 그것도 지난 예약이라 워커가 바로 집어간다.
  if (scheduleDate === today && startHour * 60 < nowMinutes) {
    return {
      ok: false,
      result: RESULT.scheduleStartHourPast(startHour, today, Math.floor(nowMinutes / 60)),
    };
  }
  if (outOfRange(intervalMinutes, intervalMinutesMin, intervalMinutesMax)) {
    return {
      ok: false,
      result: RESULT.scheduleOutOfRange('intervalMinutes', intervalMinutesMin, intervalMinutesMax),
    };
  }

  return {
    ok: true,
    input: {
      scheduleDate,
      queues: [
        {
          account: { dabutAccountId: accountId },
          keywords,
          blog_name: raw.blogName ? String(raw.blogName) : undefined,
          // 최상위 project_id 는 최초 enqueue 때만 쓰이고 ScheduleJob 문서에는 남지 않는다.
          // 항목별로도 실어야 buildScheduleJobDocuments 가 저장하고, /schedules/:id/execute 로
          // 재실행해도 프로젝트가 유지된다. 길이는 keywords 와 반드시 같아야 한다.
          item_options: projectId ? keywords.map(() => ({ projectId })) : undefined,
        },
      ],
      postsPerDay,
      startHour,
      intervalMinutes,
      manuscriptType: raw.manuscriptType as ManuscriptType | undefined,
      imageSource: raw.imageSource as ImageSource | undefined,
      keywordCategory: raw.keywordCategory ? String(raw.keywordCategory) : undefined,
      projectId: projectId || undefined,
    },
  };
};
