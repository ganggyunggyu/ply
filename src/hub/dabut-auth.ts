import axios from 'axios';
import { bearer } from './http';

export type SchedulerAccount = {
  id: string;
  name?: string;
  blogId?: string;
  /**
   * 네이버 로그인 id. 이 값이 곧 Schedule 문서의 accountId 다.
   * (createSchedule 은 resolveQueueAccount 가 푼 credential.loginId 를 accountId 로 쓴다.)
   *
   * /api/blog-accounts 는 다붓 JWT 의 소유자로 스코프된 유일한 읽기라서, 여기서 나온 loginId 집합이
   * "내 예약" 을 판별할 수 있는 단 하나의 근거다. GET/DELETE /schedules 에는 소유자 스코프가 없다.
   */
  loginId?: string;
};

/** 스케줄러 로그인. 비밀번호는 여기서만 쓰고 저장하지 않는다. 토큰만 돌려준다. */
export const loginDabut = async ({
  baseUrl,
  username,
  password,
}: {
  baseUrl: string;
  username: string;
  password: string;
}): Promise<{ token: string; label: string }> => {
  const { data } = await axios.post(
    `${baseUrl}/api/auth/login`,
    { username, password },
    { timeout: 20_000 },
  );

  const token = String(data?.accessToken ?? '');
  if (!token) throw new Error('스케줄러가 토큰을 돌려주지 않았습니다');

  return { token, label: String(data?.user?.label || data?.user?.username || username) };
};

export const listSchedulerAccounts = async (
  baseUrl: string,
  token?: string,
): Promise<SchedulerAccount[]> => {
  const { data } = await axios.get(`${baseUrl}/api/blog-accounts`, {
    timeout: 10_000,
    headers: bearer(token),
  });
  const rows = Array.isArray(data) ? data : (data?.accounts ?? data?.data ?? []);

  return (Array.isArray(rows) ? rows : []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? row._id ?? ''),
    name: row.name ? String(row.name) : undefined,
    blogId: row.blogId ? String(row.blogId) : undefined,
    loginId: row.loginId ? String(row.loginId) : row.login_id ? String(row.login_id) : undefined,
  }));
};
