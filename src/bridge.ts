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

export type PublicSettings = {
  hasApiKey: boolean;
  hasSchedulerToken: boolean;
  schedulerLabel: string;
  agentModel: string;
  writerModel: string;
  endpoints: ServiceEndpointsView;
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
  | { type: 'done'; reason: 'end' | 'max_iterations' };

export type ChatMessageView = { role: string; content: unknown; tool_calls?: unknown };

export type AgentQuestion = { id: number; question: string; choices?: string[] };

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
  answerAgent: (id: number, answer: string) => Promise<boolean>;
  getEndpoints: () => Promise<ServiceEndpointsView>;
  setEndpoints: (next: Partial<ServiceEndpointsView>) => Promise<PublicSettings>;
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
