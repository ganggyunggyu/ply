import type { ScheduleJobDetail } from '../hub';
import type { ScheduleJobStatus } from '../scheduler-enums';

/**
 * 취소로 실제 발행을 막을 수 있는 상태.
 * published 는 이미 네이버에 올라갔고, failed·cancelled 는 더 올라갈 것이 없다.
 * DELETE 는 이 셋까지 전부 cancelled 로 덮으므로 전체 건수를 "안 올라간다" 로 세면 부풀린 숫자가 된다.
 */
export const STOPPABLE_JOB_STATUSES: readonly ScheduleJobStatus[] = [
  'pending',
  'generating',
  'generated',
  'publishing',
];

const stoppable = new Set<string>(STOPPABLE_JOB_STATUSES);

export const countStoppableJobs = (jobs: ScheduleJobDetail[]): number =>
  jobs.filter(({ status }) => stoppable.has(status)).length;

export const countPublishedJobs = (jobs: ScheduleJobDetail[]): number =>
  jobs.filter(({ status }) => status === 'published').length;
