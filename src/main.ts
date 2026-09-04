import { app, BaseWindow, WebContentsView, dialog, ipcMain, safeStorage, session, shell } from 'electron';
import { homedir } from 'os';
import { join } from 'path';
import { createAccountStore, type SecretCrypto } from './accounts';
import type {
  AccountCardRequest,
  AccountChangeInput,
  AgentCardOutcome,
  AgentQuestion,
  DabutSyncStatus,
  QuestionField,
} from './bridge';
import { createNaverTools, buildAgentSystemPrompt } from './agent-tools';
import { kstToday } from './clock';
import {
  APP_NAME,
  DEFAULT_CDP_PORT,
  PANEL_WIDTH,
  PENDING_ANSWER_TIMEOUT_MS,
  WINDOW_HEIGHT,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  WINDOW_WIDTH,
} from './constants';
import { migrateLegacyConfig } from './config-migration';
import { createPendingRegistry } from './pending';
import { AGENT_MODELS, WRITER_MODELS } from './models';
import { createOpenRouterClient, runAgentLoop, type AgentEvent, type ChatMessage } from './openrouter';
import { createProfileStore, partitionOf } from './profiles';
import { createBookmarkStore } from './store/bookmarks';
import { createHistoryStore } from './store/history';
import { createShopAccountStore } from './shop-accounts';
import { shopLogin, loginUrl } from './shop';
import type { AddShopAccountInput } from './shop-accounts';
import { detectChromeProfiles, isSupportedPlatform } from './chrome-import';
import { runChromeImport } from './chrome-import/run-import';
import { createWithAgentTab } from './agent-tools/with-agent-tab';
import { issueOpenRouterKey } from './openrouter-key';
import type { ChromeImportSelection } from './bridge';
import {
  findDabutNaverAccount,
  listDabutNaverAccounts,
  loginDabut,
  updateDabutNaverAccountPassword,
} from './hub';
import { loginExposure } from './exposure-api';
import { createSettingsStore } from './settings';
import { createTabManager, type BrowserState, type TabManager } from './tabs';
import { ERRORS, MIGRATION } from './messages';
import { applyServiceUrls } from './services';

app.setName(APP_NAME);
app.setPath('userData', join(app.getPath('appData'), 'ply'));

const cdpPort = Number(process.env.PLY_CDP_PORT ?? DEFAULT_CDP_PORT);

if (cdpPort > 0) {
  app.commandLine.appendSwitch('remote-debugging-port', String(cdpPort));
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}

/*
 * 에이전트 탭은 사용자 화면을 뺏지 않으므로 작업 내내 숨은 상태로 돈다.
 * 숨은 렌더러가 백그라운드로 내려가면 타이머와 rAF 가 눌리고, playwright 의 대기가 rAF 폴링이라
 * 로그인·발행·삭제가 타임아웃까지 매달릴 수 있다. 탭별 backgroundThrottling 과 같은 이유다.
 */
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const hasInstanceLock = app.requestSingleInstanceLock();

const electronCrypto: SecretCrypto = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plainText) => safeStorage.encryptString(plainText).toString('base64'),
  decrypt: (cipherText) => safeStorage.decryptString(Buffer.from(cipherText, 'base64')),
};

const configDir = () => join(app.getPath('userData'), 'config');
const legacyConfigDir = () => join(app.getPath('appData'), 'gng-browser', 'config');
const legacyProfileFile = () => join(homedir(), '.gng-browser', 'profiles.json');

/** 예전 버전이 쓰던 파일. 지금은 settings.json 으로 한 번 옮기고 백업으로만 남긴다. */
const LEGACY_SERVICE_URLS_FILE = 'services.json';

let mainWindow: BaseWindow | null = null;
let chromeView: WebContentsView | null = null;
let sidebarView: WebContentsView | null = null;
let panelView: WebContentsView | null = null;
let tabManager: TabManager | null = null;
let panelWidth = PANEL_WIDTH;
let panelAnimation: NodeJS.Timeout | null = null;
let agentRunning = false;
let runSeq = 0;

/** 실행 id -> 그 실행의 중단 스위치. 정지 버튼이 이걸 당긴다. */
const runControllers = new Map<number, AbortController>();

const PANEL_ANIMATION_MS = 190;
const PANEL_FRAME_MS = 12;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const animatePanelWidth = (to: number) => {
  if (panelAnimation) clearInterval(panelAnimation);

  const from = panelWidth;
  const distance = to - from;

  if (distance === 0) return;

  const startedAt = Date.now();

  panelAnimation = setInterval(() => {
    const progress = Math.min((Date.now() - startedAt) / PANEL_ANIMATION_MS, 1);
    panelWidth = Math.round(from + distance * easeOutCubic(progress));
    tabManager?.layout();

    if (progress >= 1 && panelAnimation) {
      clearInterval(panelAnimation);
      panelAnimation = null;
    }
  }, PANEL_FRAME_MS);
};
/** 답을 안 하면 agentRunning 이 true 로 고착되어 앱 재시작 전까지 모든 실행이 막힌다.
 *  그래서 자유입력과 폼이 같은 타이머·시퀀스·맵을 쓴다. */
const questions = createPendingRegistry<string>({
  timeoutMs: PENDING_ANSWER_TIMEOUT_MS,
  onTimeout: () => new Error(ERRORS.questionTimeout),
});

/** 로그인 카드도 같은 이유로 같은 타이머를 탄다. 여기가 안 풀리면 실행 전체가 굳는다. */
const dabutLogins = createPendingRegistry<string>({
  timeoutMs: PENDING_ANSWER_TIMEOUT_MS,
  onTimeout: () => new Error(ERRORS.dabutLoginTimeout),
});

/** 노출지기 로그인 카드. 다붓과 같은 타이머를 탄다. */
const exposureLogins = createPendingRegistry<string>({
  timeoutMs: PENDING_ANSWER_TIMEOUT_MS,
  onTimeout: () => new Error(ERRORS.exposureLoginTimeout),
});

/** 계정 추가·비번변경 카드. 여기도 실행 슬롯을 잡은 채 기다리므로 같은 타이머가 필요하다. */
const accountCards = createPendingRegistry<string>({
  timeoutMs: PENDING_ANSWER_TIMEOUT_MS,
  onTimeout: () => new Error(ERRORS.accountCardTimeout),
});

/** 에이전트가 부르면 패널에 로그인 카드를 띄우고, 사용자가 끝낼 때까지 기다린다.
 *  비밀번호는 패널 → 메인 → 다붓 으로만 흐르고 모델은 보지 않는다. */
const requestDabutLogin = (reason: string) =>
  dabutLogins.push((id) => sendToPanel('agent:dabut-login', { id, reason }));

const requestExposureLogin = (reason: string) =>
  exposureLogins.push((id) => sendToPanel('agent:exposure-login', { id, reason }));

/** 계정 카드를 띄우고 기다린다. 요청에도 답에도 평문 비밀번호가 없다. */
const requestAccountCard = (request: Omit<AccountCardRequest, 'id'>) =>
  accountCards.push((id) => sendToPanel('agent:account-card', { id, ...request }));

const pushQuestion = (payload: Omit<AgentQuestion, 'id'>) =>
  questions.push((id) => sendToPanel('agent:question', { id, ...payload }));

const askUser = (question: string, choices?: string[]) => pushQuestion({ question, choices });

/** 값이 여러 개 필요할 때. 답은 { key: value } 를 JSON 으로 직렬화한 문자열로 돌아온다. */
const askUserForm = (question: string, fields: QuestionField[]) => pushQuestion({ question, fields });

const accountStore = () =>
  createAccountStore({ filePath: join(configDir(), 'accounts.json'), crypto: electronCrypto });

const settingsStore = () =>
  createSettingsStore({ filePath: join(configDir(), 'settings.json'), crypto: electronCrypto });

const profileStore = () => createProfileStore({ filePath: join(configDir(), 'profiles.json') });

const shopAccountStore = () =>
  createShopAccountStore({ filePath: join(configDir(), 'shop-accounts.json'), crypto: electronCrypto });

const bookmarkStore = () => createBookmarkStore({ filePath: join(configDir(), 'bookmarks.json') });

const historyStore = () => createHistoryStore({ filePath: join(configDir(), 'history.json') });

/** 서비스 주소는 저장소에 두지 않는다. 설정에 저장된 값으로 카탈로그를 덮는다. */
const loadServiceUrls = () => {
  const store = settingsStore();
  store.migrateServiceUrls(join(configDir(), LEGACY_SERVICE_URLS_FILE));
  applyServiceUrls(store.readServiceUrls());
};

/**
 * 계정 카드가 제출됐을 때 실제로 저장하는 곳.
 *
 * 평문 비밀번호는 여기까지만 온다. 반환값에도 로그에도 담지 않는다.
 *
 * change_password 가 두 곳을 함께 바꾼다. 이게 오늘 사고의 원인이었다 —
 * 네이버에서 비번을 바꿔도 이 앱의 accounts.json 은 그대로였고, 다붓에 저장된 값도
 * 따로 놀아서 예약 발행이 계속 옛 비번으로 로그인을 시도했다.
 * 두 결과를 하나로 뭉치지 않고 따로 돌려준다. 절반만 바뀐 것을 반드시 보이게 한다.
 */
const applyAccountChange = async ({
  mode,
  accountId,
  label,
  naverId,
  password,
}: AccountChangeInput): Promise<AgentCardOutcome> => {
  const store = accountStore();

  if (mode === 'add') {
    const created = store.add({ label, naverId, password: password || undefined });

    return { status: 'account_added', id: created.id, label: created.label };
  }

  const updated = store.updatePassword(accountId, password);
  if (!updated) return { status: 'cancelled' };

  const settings = settingsStore();
  const token = settings.readSchedulerToken();

  if (!token) {
    return {
      status: 'account_password',
      id: accountId,
      label: updated.label,
      local: true,
      dabut: 'no_login',
      dabutDetail: '',
    };
  }

  const { dabutBaseUrl } = settings.readEndpoints();

  const sync = async (): Promise<{ status: DabutSyncStatus; detail: string }> => {
    try {
      const accounts = await listDabutNaverAccounts(dabutBaseUrl, token);
      const found = findDabutNaverAccount(accounts, updated.naverId);
      if (!found) return { status: 'no_match', detail: '' };

      const saved = await updateDabutNaverAccountPassword({
        baseUrl: dabutBaseUrl,
        token,
        accountId: found.id,
        password,
      });

      return { status: 'changed', detail: saved.name || found.name || found.loginId };
    } catch (error) {
      return { status: 'failed', detail: error instanceof Error ? error.message : String(error) };
    }
  };

  const { status, detail } = await sync();

  return {
    status: 'account_password',
    id: accountId,
    label: updated.label,
    local: true,
    dabut: status,
    dabutDetail: detail,
  };
};

const broadcastState = (state: BrowserState) => {
  chromeView?.webContents.send('browser:state', state);
  sidebarView?.webContents.send('browser:state', state);
};

const sendToPanel = (channel: string, payload: unknown) => {
  panelView?.webContents.send(channel, payload);
};

const broadcastAgentStatus = (running: boolean) => {
  [panelView, sidebarView, chromeView].forEach((view) =>
    view?.webContents.send('agent:running', running),
  );
};

const getCookieNames = async (profileId: string) => {
  const cookies = await session.fromPartition(partitionOf(profileId)).cookies.get({ domain: '.naver.com' });
  return cookies.map(({ name }) => name);
};

const createWindow = () => {
  const window = new BaseWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: APP_NAME,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  const chrome = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const sidebar = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const panel = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const openExternally = ({ url }: { url: string }) => {
    void shell.openExternal(url);
    return { action: 'deny' as const };
  };

  chrome.webContents.setWindowOpenHandler(openExternally);
  sidebar.webContents.setWindowOpenHandler(openExternally);
  panel.webContents.setWindowOpenHandler(openExternally);

  window.contentView.addChildView(sidebar);
  window.contentView.addChildView(chrome);
  window.contentView.addChildView(panel);

  void sidebar.webContents.loadFile(join(__dirname, 'sidebar.html'));
  void chrome.webContents.loadFile(join(__dirname, 'renderer.html'));
  void panel.webContents.loadFile(join(__dirname, 'panel.html'));

  mainWindow = window;
  chromeView = chrome;
  sidebarView = sidebar;
  panelView = panel;
  tabManager = createTabManager({
    window,
    chromeView: chrome,
    sidebarView: sidebar,
    panelView: panel,
    getPanelWidth: () => panelWidth,
    onChange: broadcastState,
  });

  chrome.webContents.once('did-finish-load', () => {
    try {
      tabManager?.createTab();
    } catch (error) {
      console.error('[ply] 첫 탭 생성 실패:', error);
    }
  });

  window.on('resize', () => {
    tabManager?.layout();
  });
  window.on('closed', () => {
    mainWindow = null;
    chromeView = null;
    sidebarView = null;
    panelView = null;
    tabManager = null;
  });
};

const runAgent = async (userMessage: string, history: ChatMessage[]) => {
  if (agentRunning) throw new Error(ERRORS.agentBusy);

  const settings = settingsStore();
  const apiKey = settings.readApiKey();

  if (!apiKey) throw new Error(ERRORS.apiKeyRequired);
  if (!tabManager) throw new Error(ERRORS.windowNotReady);

  const { agentModel, writerModel } = settings.get();
  const client = createOpenRouterClient(apiKey);

  // 실행 id 별로 컨트롤러를 둔다. 지금은 한 번에 하나뿐이지만, 계정별 병렬 실행이 붙어도
  // 이 자리를 다시 뜯지 않는다. 도구가 이 신호를 받아야 하므로 도구보다 먼저 만든다.
  runSeq += 1;
  const runId = runSeq;
  const controller = new AbortController();
  runControllers.set(runId, controller);

  const onEvent = (event: AgentEvent) => sendToPanel('agent:event', event);
  const tools = createNaverTools({
    accountStore: accountStore(),
    tabManager,
    cdpPort,
    client,
    writerModel,
    getEndpoints: () => settingsStore().readEndpoints(),
    getSchedulerToken: () => settingsStore().readSchedulerToken() ?? undefined,
    getViroToken: () => settingsStore().readViroToken() ?? undefined,
    getCookieNames,
    onProgress: (message) => sendToPanel('agent:progress', message),
    askUser,
    askUserForm,
    requestDabutLogin,
    requestAccountCard,
    requestExposureLogin,
    getExposureCookie: () => settingsStore().readExposureCookie() ?? undefined,
    clearExposureCookie: () => {
      settingsStore().setExposureCookie('');
    },
    signal: controller.signal,
  });

  agentRunning = true;
  broadcastAgentStatus(true);

  try {
    const messages = await runAgentLoop({
      client,
      model: agentModel,
      system: buildAgentSystemPrompt({ today: kstToday() }),
      tools,
      history: [...history, { role: 'user', content: userMessage }],
      onEvent,
      signal: controller.signal,
    });

    return messages.filter((message) => message.role !== 'system');
  } finally {
    runControllers.delete(runId);
    agentRunning = false;
    broadcastAgentStatus(false);
  }
};

/**
 * 진행 중인 도구 호출은 끝까지 두고 다음 반복에서 멈춘다(openrouter.ts 참고).
 * 대신 답을 기다리는 카드는 여기서 풀어 준다. 안 그러면 정지를 눌러도 사용자가 카드에
 * 답할 때까지 실행이 붙잡혀 있어서 버튼이 아무 일도 안 하는 것처럼 보인다.
 */
const cancelAgentRuns = () => {
  const running = runControllers.size;

  runControllers.forEach((controller) => controller.abort());
  questions.cancelAll(() => new Error(ERRORS.runCancelled));
  dabutLogins.cancelAll(() => new Error(ERRORS.runCancelled));
  exposureLogins.cancelAll(() => new Error(ERRORS.runCancelled));
  accountCards.cancelAll(() => new Error(ERRORS.runCancelled));

  return running > 0;
};

const registerIpcHandlers = () => {
  ipcMain.handle('browser:state', () => tabManager?.snapshot() ?? { tabs: [], activeId: null });

  ipcMain.handle(
    'tab:create',
    (_event, options: { url?: string; profileId?: string; openedByAgent?: boolean }) =>
      tabManager?.createTab(options ?? {}),
  );
  ipcMain.handle('tab:close', (_event, id: number) => tabManager?.closeTab(id));
  ipcMain.handle('tab:select', (_event, id: number) => tabManager?.selectTab(id));
  ipcMain.handle('tab:navigate', (_event, id: number, input: string) => tabManager?.navigate(id, input));
  ipcMain.handle('tab:back', (_event, id: number) => tabManager?.goBack(id));
  ipcMain.handle('tab:forward', (_event, id: number) => tabManager?.goForward(id));
  ipcMain.handle('tab:reload', (_event, id: number) => tabManager?.reload(id));

  ipcMain.handle('profile:list', () => profileStore().list());
  ipcMain.handle('profile:add', (_event, label: string) => {
    profileStore().add(label);
    return profileStore().list();
  });
  ipcMain.handle('profile:remove', (_event, profileId: string) => profileStore().remove(profileId));

  ipcMain.handle('account:list', () => accountStore().list());
  ipcMain.handle('account:add', (_event, input: { label: string; naverId: string; password?: string }) => {
    accountStore().add(input);
    return accountStore().list();
  });
  ipcMain.handle('account:remove', (_event, id: string) => accountStore().remove(id));
  ipcMain.handle('account:applyChange', (_event, input: AccountChangeInput) =>
    applyAccountChange(input),
  );
  ipcMain.handle('agent:accountCardDone', (_event, id: number, result: string) =>
    accountCards.settle(id, result),
  );

  ipcMain.handle('settings:get', () => settingsStore().get());
  ipcMain.handle('settings:setApiKey', (_event, apiKey: string) => settingsStore().setApiKey(apiKey));
  ipcMain.handle('openrouter:issueKey', async () => {
    if (!tabManager) throw new Error(ERRORS.windowNotReady);

    const withAgentTab = createWithAgentTab({ tabManager, cdpPort });
    const result = await withAgentTab(
      { url: 'https://openrouter.ai/settings/keys', profileId: 'default' },
      ({ page, keepTab }) =>
        issueOpenRouterKey(page, 'Ply').then((outcome) => {
          // 로그인이 필요하면 그 탭을 남겨 사용자가 바로 로그인하게 한다.
          if (outcome.status === 'login_required') keepTab();
          return outcome;
        }),
    );

    if (result.status === 'created') settingsStore().setApiKey(result.key);

    return result;
  });
  ipcMain.handle('settings:setModels', (_event, models: { agentModel?: string; writerModel?: string }) =>
    settingsStore().setModels(models),
  );
  ipcMain.handle('settings:models', () => ({ agent: AGENT_MODELS, writer: WRITER_MODELS }));

  ipcMain.handle('panel:toggle', () => {
    const opening = panelWidth === 0;
    animatePanelWidth(opening ? PANEL_WIDTH : 0);
    return opening;
  });

  ipcMain.handle('agent:run', (_event, userMessage: string, history: ChatMessage[]) =>
    runAgent(userMessage, history ?? []),
  );
  ipcMain.handle('agent:status', () => ({ running: agentRunning }));
  ipcMain.handle('agent:cancel', () => cancelAgentRuns());
  ipcMain.handle('agent:answer', (_event, id: number, answer: string) => questions.settle(id, answer));
  ipcMain.handle('services:endpoints', () => settingsStore().readEndpoints());
  ipcMain.handle('service:login', async (_event, input: { username: string; password: string }) => {
    const store = settingsStore();
    const { token, label } = await loginDabut({
      baseUrl: store.readEndpoints().schedulerBaseUrl,
      username: input.username,
      password: input.password,
    });

    return store.setSchedulerToken(token, label);
  });
  ipcMain.handle('service:logout', () => settingsStore().setSchedulerToken('', ''));

  ipcMain.handle('viro:setToken', (_event, token: unknown) =>
    settingsStore().setViroToken(String(token ?? '').trim()));
  ipcMain.handle('agent:dabutLoginDone', (_event, id: number, result: string) =>
    dabutLogins.settle(id, result),
  );

  ipcMain.handle('service:exposureLogin', async (_event, input: { loginId: string; password: string }) => {
    const store = settingsStore();
    const { cookie } = await loginExposure({
      baseUrl: store.readEndpoints().exposureDashboardUrl,
      loginId: input.loginId,
      password: input.password,
    });

    // 비밀번호는 저장하지 않는다. 쿠키가 7일짜리라 만료되면 카드가 다시 뜬다.
    return store.setExposureCookie(cookie);
  });
  ipcMain.handle('agent:exposureLoginDone', (_event, id: number, result: string) =>
    exposureLogins.settle(id, result),
  );

  ipcMain.handle('services:setEndpoints', (_event, next: Record<string, string>) =>
    settingsStore().setEndpoints(next),
  );

  ipcMain.handle('services:setUrls', (_event, next: Record<string, string>) => {
    const settings = settingsStore().setServiceUrls(next ?? {});
    applyServiceUrls(settings.serviceUrls);

    return settings;
  });

  ipcMain.handle('cdp:info', () => ({ port: cdpPort }));

  ipcMain.handle('chrome:listProfiles', () => ({
    supported: isSupportedPlatform(),
    profiles: isSupportedPlatform() ? detectChromeProfiles() : [],
  }));
  ipcMain.handle('chrome:import', async (_event, selection: ChromeImportSelection) => {
    const result = await runChromeImport(selection, {
      bookmarkStore: bookmarkStore(),
      historyStore: historyStore(),
      getSession: (profileId: string) => session.fromPartition(partitionOf(profileId)),
    });

    // 사이드바 라이브러리는 시작 때 한 번만 읽는다. 방금 들어온 북마크/방문기록을 보이려면 다시 읽게 한다.
    if (result.bookmarksAdded > 0 || result.historyAdded > 0) sidebarView?.webContents.send('library:changed');

    return result;
  });
  ipcMain.handle('bookmarks:list', () => bookmarkStore().list());
  ipcMain.handle('history:list', () => historyStore().list());

  ipcMain.handle('shop:list', () => shopAccountStore().list());
  ipcMain.handle('shop:add', (_event, input: AddShopAccountInput) => {
    shopAccountStore().add(input);
    return shopAccountStore().list();
  });
  ipcMain.handle('shop:remove', (_event, id: string) => shopAccountStore().remove(id));
  ipcMain.handle('shop:login', async (_event, id: string) => {
    if (!tabManager) throw new Error(ERRORS.windowNotReady);

    const store = shopAccountStore();
    const account = store.find(id);
    if (!account) return { ok: false, detail: '쇼핑몰 계정을 찾지 못했다' };

    const password = store.readPassword(id);
    if (!password) return { ok: false, detail: '저장된 비밀번호가 없다. 설정에서 다시 넣어 달라' };

    const withAgentTab = createWithAgentTab({ tabManager, cdpPort });
    return withAgentTab({ url: loginUrl(account.baseUrl), profileId: `shop-${id}` }, ({ page }) =>
      shopLogin(page, { baseUrl: account.baseUrl, id: account.memberId, password }),
    );
  });
};

const handleReady = () => {
  const migratedFiles = migrateLegacyConfig({
    sourceDir: legacyConfigDir(),
    targetDir: configDir(),
    fallbackSources: { 'profiles.json': legacyProfileFile() },
    canDecrypt: (cipher) => {
      try {
        electronCrypto.decrypt(cipher);
        return true;
      } catch {
        return false;
      }
    },
  });
  loadServiceUrls();
  registerIpcHandlers();
  createWindow();

  if (migratedFiles.length > 0) {
    void dialog.showMessageBox({ type: 'info', title: APP_NAME, message: MIGRATION.reloginRequired });
  }

  if (cdpPort > 0) console.log(`[ply] CDP 엔드포인트: http://127.0.0.1:${cdpPort}`);
};

const handleWindowAllClosed = () => {
  if (process.platform !== 'darwin') app.quit();
};

const handleActivate = () => {
  if (!mainWindow) createWindow();
};

const handleSecondInstance = () => {
  mainWindow?.focus();
};

if (!hasInstanceLock) {
  app.quit();
} else {
  void app.whenReady().then(handleReady);
  app.on('second-instance', handleSecondInstance);
  app.on('window-all-closed', handleWindowAllClosed);
  app.on('activate', handleActivate);
}
