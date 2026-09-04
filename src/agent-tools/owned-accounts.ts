import type { SchedulerAccount } from '../hub';
import { maskAccountId } from '../hub';
import { CONFIRM } from '../messages';

/**
 * 예약이 내 것인지 판별하는 근거. Schedule 문서의 accountId 는 네이버 로그인 id 이고,
 * /api/blog-accounts 가 다붓 JWT 소유자로 스코프해서 주는 loginId 와 같은 값이다.
 *
 * 스케줄러의 GET/DELETE /schedules 는 다붓 인증이 켜져 있을 때만 소유자로 스코프한다.
 * JWT_SECRET 이나 DABUT_APP_MONGO_URI 가 없는 배포에서는 인증 훅과 스코프가 함께 꺼져
 * 아무나 전부 읽고 지운다. 서버 보호가 조건부라서 소유 판정은 여기 클라이언트도 한다.
 */
export type OwnedAccount = {
  id: string;
  name: string;
  blogId: string;
  loginId: string;
};

/** 네이버 로그인 id 는 대소문자를 가리지 않는다. 비교 전에 반드시 통과시킨다. */
export const normalizeAccountKey = (raw: unknown): string =>
  raw === undefined || raw === null ? '' : String(raw).trim().toLowerCase();

/** loginId 가 없는 행은 예약의 accountId 와 맞춰 볼 수가 없어 소유 판정에서 뺀다. */
export const indexOwnedAccounts = (accounts: SchedulerAccount[]): Map<string, OwnedAccount> => {
  const owned = new Map<string, OwnedAccount>();

  accounts.forEach(({ id, name, blogId, loginId }) => {
    const key = normalizeAccountKey(loginId);
    if (!key) return;

    owned.set(key, { id, name: name ?? '', blogId: blogId ?? '', loginId: loginId ?? '' });
  });

  return owned;
};

export const isOwnedSchedule = (accountId: string, owned: ReadonlyMap<string, OwnedAccount>): boolean =>
  owned.has(normalizeAccountKey(accountId));

/**
 * 화면과 모델에 보여줄 계정 이름.
 *
 * 내 계정이면 사용자가 붙여 둔 이름(없으면 블로그 id)을 쓴다. 마스킹한 로그인 id 는
 * 확인 카드에서 "내 계정 중 하나" 로 읽혀 버려서, 되돌릴 수 없는 작업의 판단 근거로는 못 쓴다.
 * 내 계정이 아니면 그 사실 자체를 적는다. 원문 로그인 id 는 어느 쪽에서도 내보내지 않는다.
 */
export const describeScheduleAccount = (
  accountId: string,
  owned: ReadonlyMap<string, OwnedAccount>,
): string => {
  const account = owned.get(normalizeAccountKey(accountId));
  if (!account) return CONFIRM.cancelScheduleForeignAccount;

  return account.name || account.blogId || maskAccountId(account.loginId);
};
