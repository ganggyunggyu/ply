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
  logoutDabut: () => Promise<PublicSettings>;
  answerDabutLogin: (id: number, result: string) => Promise<boolean>;
  onDabutLoginRequest: (callback: (payload: { id: number; reason: string }) => void) => void;

  getCdpInfo: () => Promise<{ port: number }>;

  onState: (callback: (state: BrowserStateView) => void) => void;
  onAgentEvent: (callback: (event: AgentEventView) => void) => void;
  onAgentProgress: (callback: (message: string) => void) => void;
  onAgentRunning: (callback: (running: boolean) => void) => void;
  onAgentQuestion: (callback: (payload: AgentQuestion) => void) => void;
};

declare global {
  interface Window {
    gngBrowser: BridgeApi;
  }
}
