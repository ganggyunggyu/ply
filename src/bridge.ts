export type Profile = {
  id: string;
  label: string;
};

export type NaverAccount = {
  id: string;
  label: string;
  naverId: string;
  hasPassword: boolean;
};

export type ServiceEndpointsView = {
  dabutBaseUrl: string;
  schedulerBaseUrl: string;
  exposureBotDir: string;
  exposureDashboardUrl: string;
};

export type ServiceCatalogItemView = {
  key: string;
  name: string;
  /** 지금 실제로 쓰이는 주소. 사용자가 넣은 게 있으면 그것, 없으면 defaultUrl */
  url: string;
  /** 코드에 박힌 기본값. 입력칸 placeholder 로 쓴다 */
  defaultUrl: string;
  /** 사용자가 덮어썼는가 */
  custom: boolean;
  kind: 'ui' | 'api';
  auth: 'none' | 'bearer' | 'cookie';
  description: string;
};

export type PublicSettings = {
  hasApiKey: boolean;
  hasSchedulerToken: boolean;
  hasViroToken: boolean;
  hasExposureCookie: boolean;
  schedulerLabel: string;
  agentModel: string;
  writerModel: string;
  endpoints: ServiceEndpointsView;
  serviceUrls: Record<string, string>;
  services: ServiceCatalogItemView[];
};

export type ModelPresetView = {
  id: string;
  label: string;
  inputPerMillion: number;
  outputPerMillion: number;
  note: string;
};

export type TabSnapshotView = {
  id: number;
  profileId: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  openedByAgent: boolean;
};

export type BrowserStateView = {
  tabs: TabSnapshotView[];
  activeId: number | null;
};

export type AgentEventView =
  | { type: 'assistant'; text: string }
  | { type: 'tool_start'; name: string; input: Record<string, unknown> }
  | { type: 'tool_end'; name: string; output: string }
  | { type: 'tool_error'; name: string; message: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'done'; reason: 'end' | 'max_iterations' | 'cancelled'; hadOutput: boolean };

export type ChatMessageView = { role: string; content: unknown; tool_calls?: unknown };

export type QuestionFieldType = 'text' | 'number' | 'date' | 'time';

/**
 * 보기 하나. label 은 사용자가 보는 글자, value 는 모델에게 돌아가는 값이다.
 * 둘이 다를 수 있다: 프로젝트는 라벨을 보여주고 id 를 돌려줘야 한다.
 * 라벨만 돌려주면 모델이 id 를 기억으로 복원해야 하고, 라벨이 비슷하면 다른 프로젝트로 나간다.
 */
export type QuestionChoice = { label: string; value: string };

/** 폼형 질문의 칸 하나. choices 가 있으면 select, 없으면 input 으로 그린다. */
export type QuestionField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: QuestionFieldType;
  choices?: QuestionChoice[];
  value?: string;
  optional?: boolean;
};

/** fields 가 있으면 폼으로, 없으면 기존 자유입력 카드로 그린다. */
export type AgentQuestion = {
  id: number;
  question: string;
  choices?: string[];
  fields?: QuestionField[];
};

/**
 * 에이전트가 띄우는 계정 카드.
 *
 * 비밀번호는 이 요청에도 답에도 실리지 않는다. 패널이 입력받아 메인으로 바로 넘기고
 * 메인이 저장한다. 모델은 어느 지점에서도 값을 보지 못한다.
 */
export type AccountCardRequest = {
  id: number;
  mode: 'add' | 'change_password';
  reason: string;
  /** add 는 미리 채울 값, change_password 는 어느 계정인지 보여줄 이름 */
  label: string;
  naverId: string;
  accountId: string;
};

/** 다붓 쪽 반영 결과. 로컬과 반드시 따로 적는다. 한 줄로 뭉치면 절반만 바뀐 것을 못 본다. */
export type DabutSyncStatus = 'changed' | 'no_match' | 'no_login' | 'failed';

export type AccountChangeInput = {
  mode: 'add' | 'change_password';
  accountId: string;
  label: string;
  naverId: string;
  password: string;
};

/** 카드가 끝나고 모델에게 돌아가는 값. 여기에도 비밀번호는 없다. */
export type AgentCardOutcome =
  | { status: 'cancelled' }
  | { status: 'exposure_login'; name: string }
  | { status: 'account_added'; id: string; label: string }
  | {
      status: 'account_password';
      id: string;
      label: string;
      local: boolean;
      dabut: DabutSyncStatus;
      dabutDetail: string;
    };

export type BridgeApi = {
  getState: () => Promise<BrowserStateView>;
  createTab: (options?: { url?: string; profileId?: string; openedByAgent?: boolean }) => Promise<number>;
  closeTab: (id: number) => Promise<void>;
  selectTab: (id: number) => Promise<void>;
  navigate: (id: number, input: string) => Promise<void>;
  goBack: (id: number) => Promise<void>;
  goForward: (id: number) => Promise<void>;
  reload: (id: number) => Promise<void>;

  listProfiles: () => Promise<Profile[]>;
  addProfile: (label: string) => Promise<Profile[]>;
  removeProfile: (profileId: string) => Promise<Profile[]>;

  listAccounts: () => Promise<NaverAccount[]>;
  addAccount: (input: { label: string; naverId: string; password?: string }) => Promise<NaverAccount[]>;
  removeAccount: (id: string) => Promise<NaverAccount[]>;
  /** 계정 카드가 제출됐을 때. 평문 비밀번호는 여기서 메인으로만 간다. */
  applyAccountChange: (input: AccountChangeInput) => Promise<AgentCardOutcome>;

  getSettings: () => Promise<PublicSettings>;
  setApiKey: (apiKey: string) => Promise<PublicSettings>;
  setModels: (models: { agentModel?: string; writerModel?: string }) => Promise<PublicSettings>;
  listModels: () => Promise<{ agent: ModelPresetView[]; writer: ModelPresetView[] }>;

  togglePanel: () => Promise<boolean>;

  runAgent: (message: string, history: ChatMessageView[]) => Promise<ChatMessageView[]>;
  getAgentStatus: () => Promise<{ running: boolean }>;
  /** 돌고 있던 실행이 있었으면 true. 진행 중인 도구 하나는 끝까지 돈다. */
  cancelAgent: () => Promise<boolean>;
  answerAgent: (id: number, answer: string) => Promise<boolean>;
  getEndpoints: () => Promise<ServiceEndpointsView>;
  setEndpoints: (next: Partial<ServiceEndpointsView>) => Promise<PublicSettings>;
  setServiceUrls: (next: Record<string, string>) => Promise<PublicSettings>;
  loginDabut: (input: { username: string; password: string }) => Promise<PublicSettings>;
  setViroToken: (token: string) => Promise<PublicSettings>;
  logoutDabut: () => Promise<PublicSettings>;
  answerDabutLogin: (id: number, result: string) => Promise<boolean>;
  onDabutLoginRequest: (callback: (payload: { id: number; reason: string }) => void) => void;

  loginExposure: (input: { loginId: string; password: string }) => Promise<PublicSettings>;
  answerExposureLogin: (id: number, result: string) => Promise<boolean>;
  onExposureLoginRequest: (callback: (payload: { id: number; reason: string }) => void) => void;

  answerAccountCard: (id: number, result: string) => Promise<boolean>;
  onAccountCardRequest: (callback: (payload: AccountCardRequest) => void) => void;

  getCdpInfo: () => Promise<{ port: number }>;

  listChromeProfiles: () => Promise<{ supported: boolean; profiles: ChromeProfileView[] }>;
  importFromChrome: (selection: ChromeImportSelection) => Promise<ChromeImportResult>;
  listBookmarks: () => Promise<StoredBookmarkView[]>;
  listVisitHistory: () => Promise<StoredVisitView[]>;
  onLibraryChanged: (callback: () => void) => void;
  issueOpenRouterKey: () => Promise<IssueKeyResultView>;
  onOpenRouterProgress: (callback: (message: string) => void) => void;
  listShopAccounts: () => Promise<ShopAccountView[]>;
  addShopAccount: (input: AddShopAccountView) => Promise<ShopAccountView[]>;
  removeShopAccount: (id: string) => Promise<ShopAccountView[]>;
  loginShop: (id: string) => Promise<ShopLoginResultView>;

  onState: (callback: (state: BrowserStateView) => void) => void;
  onAgentEvent: (callback: (event: AgentEventView) => void) => void;
  onAgentProgress: (callback: (message: string) => void) => void;
  onAgentRunning: (callback: (running: boolean) => void) => void;
  onAgentQuestion: (callback: (payload: AgentQuestion) => void) => void;
};

export type ChromeProfileView = {
  folder: string;
  label: string;
};

export type ChromeImportSelection = {
  profileFolder: string;
  /** 어느 Ply 프로필 세션으로 쿠키를 넣을지. 북마크/히스토리는 전역 저장이라 이 값과 무관하다. */
  targetProfileId: string;
  cookies: boolean;
  bookmarks: boolean;
  history: boolean;
};

export type ChromeImportResult = {
  cookiesSet: number;
  cookiesSkipped: number;
  bookmarksAdded: number;
  historyAdded: number;
  /** 항목별로 완전히 실패한 경우의 사유. 쿠키 키체인 거부, 파일 없음 등. */
  errors: string[];
};

export type StoredBookmarkView = {
  name: string;
  url: string;
};

export type StoredVisitView = {
  url: string;
  title: string;
  visitCount: number;
  lastVisit: number;
};

export type IssueKeyResultView =
  | { status: 'created'; key: string }
  | { status: 'login_required' }
  | { status: 'manual'; detail: string }
  | { status: 'failed'; detail: string };

export type ShopAccountView = {
  id: string;
  label: string;
  baseUrl: string;
  memberId: string;
  hasPassword: boolean;
};

export type AddShopAccountView = {
  label: string;
  baseUrl: string;
  memberId: string;
  password?: string;
};

export type ShopLoginResultView = {
  ok: boolean;
  detail: string;
};

declare global {
  interface Window {
    gngBrowser: BridgeApi;
  }
}
