import type { RemoteJob } from '../exposure-api';
import type { ToolContext } from './tool-context';
import type { KnownPost } from './post-limits';
import type { KnownSchedule } from './known-schedules';
import { createLoadOwnedAccounts } from './load-owned-accounts';
import { createWithAgentTab } from './with-agent-tab';

/**
 * 도구들이 공유하는 실행 단위 상태와 헬퍼.
 *
 * createNaverTools 는 실행마다 새로 불린다. 따라서 아래 값들은 자연히 실행 단위다.
 * 원래 하나의 큰 함수 안 클로저였던 것을 도구 파일들이 나눠 쓸 수 있도록 객체로 묶었다.
 */
export const createToolRuntime = (context: ToolContext) => {
  const {
    accountStore,
    shopAccountStore,
    tabManager,
    cdpPort,
    client,
    writerModel,
    getEndpoints,
    getSchedulerToken,
    getViroToken,
    getCookieNames,
    onProgress,
    askUser,
    askUserForm,
    requestDabutLogin,
    requestAccountCard,
    requestExposureLogin,
    getExposureCookie,
    clearExposureCookie,
    signal,
  } = context;

  const knownPosts = new Map<string, KnownPost>();
  const attemptedLogNos = new Set<string>();
  const refusedLogNos = new Set<string>();
  const knownProjectIds = new Set<string>();
  /** list_accounts 가 이번 실행에서 돌려준 계정 id. 계정을 고치는 도구는 전부 이걸 통과한다. */
  const knownAccountIds = new Set<string>();
  /** 이번 실행에서 이미 손댄 계정. 같은 계정을 두 번 고치지 않는다. */
  const touchedAccountIds = new Set<string>();
  /**
   * 사용자가 이번 실행에서 되돌려보낸 비밀번호 카드.
   *
   * 거절은 끈적해야 한다. 그렇지 않으면 모델이 max_iterations 까지 비밀번호 칸을 다시 띄울 수 있고,
   * 앱 크롬 안에서 뜨는 정품 카드라 사용자는 몇 번째인지 말고는 구분할 근거가 없다.
   * remove 는 touchedAccountIds 로 이미 이렇게 하고 있었다. 크리덴셜 카드에도 같은 규칙을 건다.
   */
  const declinedCards = new Set<'account_add' | 'exposure_login'>();
  /** 노출체크 목록을 이번 실행에서 읽었을 때의 원격 잡. run 이 라벨과 차단 사유를 여기서 읽는다. */
  const remoteJobs = new Map<string, RemoteJob>();
  /** id 를 사람이 읽는 이름으로 되돌리는 표. get_schedule 이 projectId 를 라벨로 풀 때 쓴다. */
  const projectLabels = new Map<string, string>();
  const knownSchedules = new Map<string, KnownSchedule>();
  const attemptedScheduleIds = new Set<string>();
  const refusedScheduleIds = new Set<string>();

  const { loadOwnedAccounts, getOwnedAccountsCache, setOwnedAccountsCache } = createLoadOwnedAccounts({
    getEndpoints,
    getSchedulerToken,
  });

  const withAgentTab = createWithAgentTab({ tabManager, cdpPort });

  return {
    accountStore,
    shopAccountStore,
    tabManager,
    cdpPort,
    client,
    writerModel,
    getEndpoints,
    getSchedulerToken,
    getViroToken,
    getCookieNames,
    onProgress,
    askUser,
    askUserForm,
    requestDabutLogin,
    requestAccountCard,
    requestExposureLogin,
    getExposureCookie,
    clearExposureCookie,
    signal,
    knownPosts,
    attemptedLogNos,
    refusedLogNos,
    knownProjectIds,
    knownAccountIds,
    touchedAccountIds,
    declinedCards,
    remoteJobs,
    projectLabels,
    knownSchedules,
    attemptedScheduleIds,
    refusedScheduleIds,
    loadOwnedAccounts,
    withAgentTab,
    getOwnedAccountsCache,
    setOwnedAccountsCache,
  };
};

export type ToolRuntime = ReturnType<typeof createToolRuntime>;
