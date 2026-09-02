import { app, BaseWindow, WebContentsView, ipcMain, safeStorage, session, shell } from 'electron';
import { join } from 'path';
import { createAccountStore, type SecretCrypto } from './accounts';
import { createNaverTools, buildAgentSystemPrompt } from './agent-tools';
import {
  DEFAULT_CDP_PORT,
  PANEL_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  WINDOW_WIDTH,
} from './constants';
import { AGENT_MODELS, WRITER_MODELS } from './models';
import { createOpenRouterClient, runAgentLoop, type AgentEvent, type ChatMessage } from './openrouter';
import { addProfile, listProfiles, partitionOf, removeProfile } from './profiles';
import { loginDabut } from './hub';
import { createSettingsStore } from './settings';
import { createTabManager, type BrowserState, type TabManager } from './tabs';
import { ERRORS } from './messages';
import { applyServiceUrls } from './services';

app.setName('gng-browser');
app.setPath('userData', join(app.getPath('appData'), 'gng-browser'));

const cdpPort = Number(process.env.GNG_BROWSER_CDP_PORT ?? DEFAULT_CDP_PORT);

if (cdpPort > 0) {
  app.commandLine.appendSwitch('remote-debugging-port', String(cdpPort));
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}

const hasInstanceLock = app.requestSingleInstanceLock();

const electronCrypto: SecretCrypto = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plainText) => safeStorage.encryptString(plainText).toString('base64'),
  decrypt: (cipherText) => safeStorage.decryptString(Buffer.from(cipherText, 'base64')),
};

const configDir = () => join(app.getPath('userData'), 'config');

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
let questionSeq = 0;

const pendingQuestions = new Map<number, (answer: string) => void>();

let dabutLoginSeq = 0;

const pendingDabutLogins = new Map<number, (result: string) => void>();

/** 에이전트가 부르면 패널에 로그인 카드를 띄우고, 사용자가 끝낼 때까지 기다린다.
 *  비밀번호는 패널 → 메인 → 다붓 으로만 흐르고 모델은 보지 않는다. */
const requestDabutLogin = (reason: string) =>
  new Promise<string>((resolve) => {
    dabutLoginSeq += 1;
    pendingDabutLogins.set(dabutLoginSeq, resolve);
    sendToPanel('agent:dabut-login', { id: dabutLoginSeq, reason });
  });

const QUESTION_TIMEOUT_MS = 10 * 60 * 1000;

/** 답을 안 하면 agentRunning 이 true 로 고착되어 앱 재시작 전까지 모든 실행이 막힌다. */
const askUser = (question: string, choices?: string[]) =>
  new Promise<string>((resolve, reject) => {
    questionSeq += 1;
    const id = questionSeq;

    const timer = setTimeout(() => {
      pendingQuestions.delete(id);
      reject(new Error(ERRORS.questionTimeout));
    }, QUESTION_TIMEOUT_MS);

    pendingQuestions.set(id, (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });

    sendToPanel('agent:question', { id, question, choices });
  });

const accountStore = () =>
  createAccountStore({ filePath: join(configDir(), 'accounts.json'), crypto: electronCrypto });

const settingsStore = () =>
  createSettingsStore({ filePath: join(configDir(), 'settings.json'), crypto: electronCrypto });

/** 서비스 주소는 저장소에 두지 않는다. 설정에 저장된 값으로 카탈로그를 덮는다. */
const loadServiceUrls = () => {
  const store = settingsStore();
  store.migrateServiceUrls(join(configDir(), LEGACY_SERVICE_URLS_FILE));
  applyServiceUrls(store.readServiceUrls());
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
    title: 'GNG Browser',
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
      console.error('[gng-browser] 첫 탭 생성 실패:', error);
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

  const onEvent = (event: AgentEvent) => sendToPanel('agent:event', event);
  const tools = createNaverTools({
    accountStore: accountStore(),
    tabManager,
    cdpPort,
    client,
    writerModel,
    getEndpoints: () => settingsStore().readEndpoints(),
    getSchedulerToken: () => settingsStore().readSchedulerToken() ?? undefined,
    getCookieNames,
    onProgress: (message) => sendToPanel('agent:progress', message),
    askUser,
    requestDabutLogin,
  });

  agentRunning = true;
  broadcastAgentStatus(true);

  try {
    const messages = await runAgentLoop({
      client,
      model: agentModel,
      system: buildAgentSystemPrompt(),
      tools,
      history: [...history, { role: 'user', content: userMessage }],
      onEvent,
    });

    return messages.filter((message) => message.role !== 'system');
  } finally {
    agentRunning = false;
    broadcastAgentStatus(false);
  }
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

  ipcMain.handle('profile:list', () => listProfiles());
  ipcMain.handle('profile:add', (_event, label: string) => {
    addProfile(label);
    return listProfiles();
  });
  ipcMain.handle('profile:remove', (_event, profileId: string) => removeProfile(profileId));

  ipcMain.handle('account:list', () => accountStore().list());
  ipcMain.handle('account:add', (_event, input: { label: string; naverId: string; password?: string }) => {
    accountStore().add(input);
    return accountStore().list();
  });
  ipcMain.handle('account:remove', (_event, id: string) => accountStore().remove(id));

  ipcMain.handle('settings:get', () => settingsStore().get());
  ipcMain.handle('settings:setApiKey', (_event, apiKey: string) => settingsStore().setApiKey(apiKey));
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
  ipcMain.handle('agent:answer', (_event, id: number, answer: string) => {
    const resolve = pendingQuestions.get(id);
    if (!resolve) return false;

    pendingQuestions.delete(id);
    resolve(answer);
    return true;
  });
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
  ipcMain.handle('agent:dabutLoginDone', (_event, id: number, result: string) => {
    const resolve = pendingDabutLogins.get(id);
    if (!resolve) return false;

    pendingDabutLogins.delete(id);
    resolve(result);
    return true;
  });

  ipcMain.handle('services:setEndpoints', (_event, next: Record<string, string>) =>
    settingsStore().setEndpoints(next),
  );

  ipcMain.handle('services:setUrls', (_event, next: Record<string, string>) => {
    const settings = settingsStore().setServiceUrls(next ?? {});
    applyServiceUrls(settings.serviceUrls);

    return settings;
  });

  ipcMain.handle('cdp:info', () => ({ port: cdpPort }));
};

const handleReady = () => {
  loadServiceUrls();
  registerIpcHandlers();
  createWindow();

  if (cdpPort > 0) console.log(`[gng-browser] CDP 엔드포인트: http://127.0.0.1:${cdpPort}`);
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
