import type { ScheduleSummary } from '../hub';
import { CONFIRM } from '../messages';

export type KnownSchedule = {
  id: string;
  accountId: string;
  scheduleDate: string;
  status: string;
  totalJobs: number;
};

export const toKnownSchedules = (rows: ScheduleSummary[]): KnownSchedule[] =>
  rows.map(({ id, accountId, scheduleDate, status, totalJobs }) => ({
    id,
    accountId,
    scheduleDate,
    status,
    totalJobs,
  }));

export const isCancelApproved = (answer: string) => answer.trim() === CONFIRM.cancelScheduleYes;
