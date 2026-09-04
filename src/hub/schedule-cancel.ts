import axios from 'axios';
import { bearer } from './http';
import { asRecord, asText } from './schedule-parse';

export const readCancelScheduleResult = (data: unknown): { ok: boolean; id: string } => {
  const { success, id } = asRecord(data);

  return { ok: success === true, id: asText(id) };
};

/**
 * 삭제가 아니라 소프트 취소다. 큐에서 잡을 빼고 job/schedule 의 status 를 cancelled 로 바꾼다.
 * 문서는 남아 get_schedule 로 계속 읽히지만, 되살리는 엔드포인트는 없다.
 * (POST /schedules/:id/execute 는 pending·generating 만 다시 큐에 넣는다.)
 * 큐 잡 제거를 job 마다 도는 라우트라 읽기보다 넉넉히 기다린다.
 */
export const cancelSchedule = async ({
  baseUrl,
  token,
  scheduleId,
}: {
  baseUrl: string;
  token?: string;
  scheduleId: string;
}): Promise<{ ok: boolean; id: string }> => {
  const { data } = await axios.delete(`${baseUrl}/schedules/${encodeURIComponent(scheduleId)}`, {
    timeout: 60_000,
    headers: bearer(token),
  });

  return readCancelScheduleResult(data);
};

const errorFieldLine = (row: unknown): string => {
  const { field, message } = (row ?? {}) as Record<string, unknown>;

  return [field, message].filter((part): part is string => typeof part === 'string' && part !== '').join(': ');
};

/**
 * 스케줄러의 400 본문은 { message, fields: [{ field, message }] } 라 무엇이 틀렸는지 알려준다.
 * axios 예외 메시지만 올리면 "Request failed with status code 400" 만 남아 모델이 고칠 수 없다.
 */
/**
 * axios 는 404 를 던진다. 그래서 "없는 예약" 은 `schedule === null` 이 아니라 예외로 온다.
 * 이걸 구분하지 않으면 id 가 틀렸을 때 "id 를 다시 확인하라" 가 아니라 "읽지 못했다" 만 남아
 * 모델이 복구 방법을 모른다.
 */
export const isScheduleNotFound = (error: unknown): boolean =>
  (error as { response?: { status?: number } } | null)?.response?.status === 404;

export const describeSchedulerError = (error: unknown): string => {
  const base = error instanceof Error ? error.message : String(error);
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;

  if (!data || typeof data !== 'object') return base;

  const { message, fields } = data as Record<string, unknown>;
  const detail = typeof message === 'string' ? message : '';
  const lines = Array.isArray(fields) ? fields.map(errorFieldLine).filter(Boolean) : [];

  return [base, detail, ...lines].filter(Boolean).join(' | ');
};
