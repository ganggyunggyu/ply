import axios from 'axios';
import { bearer } from './http';
import type { ScheduleDetail, ScheduleSummary } from './schedule-types';
import { readScheduleDetail, readScheduleList } from './schedule-parse';

/**
 * 예약 목록. 최근 50건 고정이고 페이지네이션이 없다.
 * 필터는 accountId 와 status 둘뿐이며, 다른 키를 넣어도 zod 가 non-strict 라 조용히 버려진다.
 */
export const listSchedules = async ({
  baseUrl,
  token,
  accountId,
  status,
}: {
  baseUrl: string;
  token?: string;
  accountId?: string;
  status?: string;
}): Promise<ScheduleSummary[]> => {
  const params: Record<string, string> = {};
  if (accountId) params.accountId = accountId;
  if (status) params.status = status;

  const { data } = await axios.get(`${baseUrl}/schedules`, {
    timeout: 15_000,
    headers: bearer(token),
    params,
  });

  return readScheduleList(data);
};

/**
 * 예약 하나의 상세. jobs 에만 keyword·scheduledAt·projectId 가 있고 목록에는 없다.
 * _id 가 String 으로 재정의돼 있어서 sch_ 접두사를 붙인 값을 그대로 경로에 넣는다.
 */
export const getSchedule = async ({
  baseUrl,
  token,
  scheduleId,
}: {
  baseUrl: string;
  token?: string;
  scheduleId: string;
}): Promise<ScheduleDetail> => {
  const { data } = await axios.get(`${baseUrl}/schedules/${encodeURIComponent(scheduleId)}`, {
    timeout: 15_000,
    headers: bearer(token),
  });

  return readScheduleDetail(data);
};
