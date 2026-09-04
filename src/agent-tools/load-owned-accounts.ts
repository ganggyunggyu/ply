import { describeSchedulerError, listSchedulerAccounts, type ServiceEndpoints } from '../hub';
import { TOOL_RESULTS as RESULT } from '../prompts';
import { indexOwnedAccounts, type OwnedAccount } from './owned-accounts';

/**
 * 내 네이버 계정(= Schedule.accountId) 표. 예약 도구 세 개가 전부 이걸 통과해야 한다.
 *
 * 스케줄러의 소유자 스코프는 다붓 인증이 켜져 있을 때만 걸린다. 꺼진 배포에서는 목록이
 * 전부 나오고, 그때 "이번 실행에서 읽은 id 만" 이라는 게이트는 "존재하는 아무 id 나" 와
 * 같은 뜻이 된다. 서버 설정에 기대지 않도록 소유 판정을 여기서 따로 한다.
 *
 * 실패를 캐시하지 않는다. 로그인이 늦게 끝나면 다음 호출에서 다시 받아야 한다.
 */
export const createLoadOwnedAccounts = ({
  getEndpoints,
  getSchedulerToken,
}: {
  getEndpoints: () => ServiceEndpoints;
  getSchedulerToken: () => string | undefined;
}) => {
  let ownedAccountsCache: Map<string, OwnedAccount> | null = null;

  const loadOwnedAccounts = async (): Promise<
    { ok: true; owned: Map<string, OwnedAccount> } | { ok: false; result: string }
  > => {
    if (ownedAccountsCache) return { ok: true, owned: ownedAccountsCache };

    try {
      const accounts = await listSchedulerAccounts(getEndpoints().schedulerBaseUrl, getSchedulerToken());
      const owned = indexOwnedAccounts(accounts);

      if (owned.size === 0) return { ok: false, result: RESULT.noSchedulerAccounts };

      ownedAccountsCache = owned;

      return { ok: true, owned };
    } catch (error) {
      return { ok: false, result: RESULT.scheduleAccountsUnknown(describeSchedulerError(error)) };
    }
  };

  return {
    loadOwnedAccounts,
    getOwnedAccountsCache: () => ownedAccountsCache,
    setOwnedAccountsCache: (value: Map<string, OwnedAccount> | null) => {
      ownedAccountsCache = value;
    },
  };
};
