import type { ScheduleDetail, ScheduleJobDetail, ScheduleSummary } from './schedule-types';

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const asCount = (value: unknown) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

/** 스케줄러는 mongoose 문서를 그대로 직렬화한다. 키가 id 가 아니라 _id 이고, set 안 된 필드는 아예 없다. */
export const toScheduleSummary = (raw: unknown): ScheduleSummary => {
  const { id, _id, accountId, scheduleDate, status, totalJobs, completedJobs, failedJobs, createdAt } =
    asRecord(raw);

  return {
    id: asText(id ?? _id),
    accountId: asText(accountId),
    scheduleDate: asText(scheduleDate),
    status: asText(status),
    totalJobs: asCount(totalJobs),
    completedJobs: asCount(completedJobs),
    failedJobs: asCount(failedJobs),
    createdAt: asText(createdAt),
  };
};

/**
 * job 하나를 읽는다. projectId 를 살려 내는 것이 이 함수의 존재 이유다.
 * 예약에 원고 프로젝트가 저장되지 않으면 그 필드가 JSON 에 아예 없어서 빈 문자열이 되고,
 * 빈 문자열 자체가 "저장 안 됨" 이라는 확인 결과다. 여기서 임의로 채우지 않는다.
 */
export const toScheduleJobDetail = (raw: unknown): ScheduleJobDetail => {
  const { id, _id, keyword, scheduledAt, status, projectId, manuscriptType, businessName, postUrl, error } =
    asRecord(raw);

  return {
    id: asText(id ?? _id),
    keyword: asText(keyword),
    scheduledAt: asText(scheduledAt),
    status: asText(status),
    projectId: asText(projectId),
    manuscriptType: asText(manuscriptType),
    businessName: asText(businessName),
    postUrl: asText(postUrl),
    error: asText(error),
  };
};

export const readScheduleList = (data: unknown): ScheduleSummary[] => {
  const { schedules } = asRecord(data);
  const rows = Array.isArray(data) ? data : Array.isArray(schedules) ? schedules : [];

  return rows.map(toScheduleSummary).filter(({ id }) => id !== '');
};

export const readScheduleDetail = (data: unknown): ScheduleDetail => {
  const { schedule, jobs } = asRecord(data);
  const summary = schedule ? toScheduleSummary(schedule) : null;

  return {
    schedule: summary && summary.id ? summary : null,
    jobs: Array.isArray(jobs) ? jobs.map(toScheduleJobDetail) : [],
  };
};

/**
 * GET /schedules 의 accountId 는 마스킹 없이 네이버 로그인 id 원문이다.
 * (등록 응답만 스케줄러가 가려서 준다.) 화면과 모델에 그대로 흘리지 않는다.
 */
export const maskAccountId = (raw: string): string => {
  const value = raw.trim();
  if (!value) return '';
  if (value.length <= 3) return `${value.slice(0, 1)}***`;

  return `${value.slice(0, 3)}***`;
};
