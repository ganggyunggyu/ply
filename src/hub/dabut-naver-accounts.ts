import axios from 'axios';
import { bearer } from './http';

/**
 * 다붓에 등록된 네이버 계정. 예약 발행이 실제로 로그인에 쓰는 크리덴셜의 주인이다.
 *
 * 이 앱의 accounts.json 과 서로 모르는 사이라서 오늘의 사고가 났다.
 * 네이버에서 비밀번호를 바꾸면 두 곳을 같이 고쳐야 하고, 한 곳만 고치면
 * 나머지 한 곳이 옛 비밀번호로 계속 로그인을 시도한다.
 */
export type DabutNaverAccount = {
  id: string;
  name: string;
  loginId: string;
  blogId: string;
  hasPassword: boolean;
};

const toDabutNaverAccount = (row: Record<string, unknown>): DabutNaverAccount => ({
  id: String(row.id ?? row._id ?? ''),
  name: String(row.name ?? ''),
  loginId: String(row.login_id ?? row.loginId ?? ''),
  blogId: String(row.blog_id ?? row.blogId ?? ''),
  hasPassword: row.has_password === true,
});

/** GET /naver-accounts 는 배열을 그대로 준다. 기본은 활성 계정만이라 꺼진 것까지 본다. */
export const listDabutNaverAccounts = async (
  baseUrl: string,
  token?: string,
): Promise<DabutNaverAccount[]> => {
  const { data } = await axios.get(`${baseUrl}/naver-accounts`, {
    timeout: 15_000,
    headers: bearer(token),
    params: { include_inactive: true },
  });

  const rows = Array.isArray(data) ? data : (data?.accounts ?? data?.items ?? []);

  return (Array.isArray(rows) ? rows : [])
    .map((row: Record<string, unknown>) => toDabutNaverAccount(row))
    .filter(({ id }) => id !== '');
};

/** 네이버 로그인 id 는 대소문자를 가리지 않는다. 비교 전에 반드시 접는다. */
export const findDabutNaverAccount = (
  accounts: DabutNaverAccount[],
  loginId: string,
): DabutNaverAccount | null => {
  const needle = loginId.trim().toLowerCase();
  if (!needle) return null;

  return accounts.find((account) => account.loginId.trim().toLowerCase() === needle) ?? null;
};

/**
 * 저장된 비밀번호만 바꾼다. 다른 필드는 보내지 않는다.
 * NaverAccountUpdate 는 전부 optional 이라 안 보낸 필드는 그대로 남는다.
 */
export const updateDabutNaverAccountPassword = async ({
  baseUrl,
  token,
  accountId,
  password,
}: {
  baseUrl: string;
  token?: string;
  accountId: string;
  password: string;
}): Promise<DabutNaverAccount> => {
  const { data } = await axios.put(
    `${baseUrl}/naver-accounts/${encodeURIComponent(accountId)}`,
    { password },
    { timeout: 20_000, headers: bearer(token) },
  );

  return toDabutNaverAccount((data ?? {}) as Record<string, unknown>);
};
