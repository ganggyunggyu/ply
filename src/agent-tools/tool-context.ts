import type { AxiosInstance } from 'axios';
import type { AccountStore } from '../accounts';
import type { AccountCardRequest, QuestionField } from '../bridge';
import type { ServiceEndpoints } from '../hub';
import type { TabManager } from '../tabs';

export type ToolContext = {
  accountStore: AccountStore;
  tabManager: TabManager;
  cdpPort: number;
  client: AxiosInstance;
  writerModel: string;
  /** 실행 중에 바뀔 수 있으므로 값이 아니라 게터로 받는다. */
  getEndpoints: () => ServiceEndpoints;
  getSchedulerToken: () => string | undefined;
  getViroToken: () => string | undefined;
  getCookieNames: (profileId: string) => Promise<string[]>;
  onProgress: (message: string) => void;
  askUser: (question: string, choices?: string[]) => Promise<string>;
  /** 값이 여러 개일 때. 답은 { key: value } 를 JSON 으로 직렬화한 문자열이다. */
  askUserForm: (question: string, fields: QuestionField[]) => Promise<string>;
  requestDabutLogin: (reason: string) => Promise<string>;
  /**
   * 계정 카드를 띄우고 사용자가 끝낼 때까지 기다린다. 답은 AgentCardOutcome 을 직렬화한 문자열이다.
   * 평문 비밀번호는 이 경로에 실리지 않는다. 패널 -> 메인 -> 저장소로만 흐른다.
   */
  requestAccountCard: (request: Omit<AccountCardRequest, 'id'>) => Promise<string>;
  /** 노출지기 로그인 카드. dabut_login 과 같은 모양이다. */
  requestExposureLogin: (reason: string) => Promise<string>;
  /** 노출지기 세션 쿠키. 없거나 만료면 exposure_login 을 부른다. */
  getExposureCookie: () => string | undefined;
  /** 401 을 만났을 때 저장된 쿠키를 지운다. 다음 호출이 다시 로그인을 요청하게 만든다. */
  clearExposureCookie: () => void;
  /**
   * 이번 실행의 정지 스위치.
   *
   * 도구 하나를 중간에 끊지는 않는다(openrouter.ts 참고). 다만 delete_blog_posts 처럼 한 번의
   * 호출 안에서 되돌릴 수 없는 작업을 여러 번 반복하는 도구는, 글과 글 사이가 안전하게 멈출 수
   * 있는 경계라서 그 자리에서만 신호를 본다.
   */
  signal?: AbortSignal;
};
