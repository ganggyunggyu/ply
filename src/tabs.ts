import { WebContentsView, type BaseWindow } from 'electron';
import { CHROME_HEIGHT, HOME_URL, SIDEBAR_WIDTH } from './constants';
import { partitionOf } from './profiles';
import { shouldFocusNewTab } from './tab-focus';
import { descendantTabIds } from './tab-tree';
import { normalizeUrl } from './url';

export type TabSnapshot = {
  id: number;
  profileId: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  openedByAgent: boolean;
};

export type BrowserState = {
  tabs: TabSnapshot[];
  activeId: number | null;
};

type Tab = {
  id: number;
  profileId: string;
  openedByAgent: boolean;
  /** 이 탭을 띄운 탭. 팝업을 부모와 함께 정리하려고 남긴다. */
  openerId?: number;
  view: WebContentsView;
};

type CreateTabOptions = {
  url?: string;
  profileId?: string;
  openedByAgent?: boolean;
  /** 화면을 이 탭으로 옮길지. 사용자가 "열어줘" 라고 시킨 경우에만 true 다. */
  focus?: boolean;
  openerId?: number;
};

type TabManagerOptions = {
  window: BaseWindow;
  chromeView: WebContentsView;
  sidebarView: WebContentsView;
  panelView: WebContentsView;
  getPanelWidth: () => number;
  onChange: (state: BrowserState) => void;
};

export const createTabManager = ({
  window,
  chromeView,
  sidebarView,
  panelView,
  getPanelWidth,
  onChange,
}: TabManagerOptions) => {
  const tabs: Tab[] = [];
  let activeId: number | null = null;
  let nextId = 1;

  const findTab = (id: number) => tabs.find((tab) => tab.id === id);

  const snapshot = (): BrowserState => ({
    activeId,
    tabs: tabs.map(({ id, profileId, openedByAgent, view }) => {
      const { webContents } = view;
      const { navigationHistory } = webContents;

      return {
        id,
        profileId,
        openedByAgent,
        url: webContents.getURL(),
        title: webContents.getTitle() || '새 탭',
        loading: webContents.isLoading(),
        canGoBack: navigationHistory.canGoBack(),
        canGoForward: navigationHistory.canGoForward(),
      };
    }),
  });

  const emit = () => onChange(snapshot());

  const layout = () => {
    const { width, height } = window.getContentBounds();
    const sidebarWidth = Math.min(SIDEBAR_WIDTH, Math.max(width - 400, 0));
    const mainWidth = Math.max(width - sidebarWidth, 0);
    const panelWidth = Math.min(getPanelWidth(), Math.max(mainWidth - 360, 0));
    const contentWidth = Math.max(mainWidth - panelWidth, 0);
    const contentHeight = Math.max(height - CHROME_HEIGHT, 0);

    sidebarView.setBounds({ x: 0, y: 0, width: sidebarWidth, height });
    chromeView.setBounds({ x: sidebarWidth, y: 0, width: mainWidth, height: CHROME_HEIGHT });

    panelView.setVisible(panelWidth > 0);
    if (panelWidth > 0) {
      panelView.setBounds({
        x: sidebarWidth + contentWidth,
        y: CHROME_HEIGHT,
        width: panelWidth,
        height: contentHeight,
      });
    }

    tabs.forEach(({ id, view }) => {
      const isActive = id === activeId;
      view.setVisible(isActive);
      if (isActive) {
        view.setBounds({
          x: sidebarWidth,
          y: CHROME_HEIGHT,
          width: contentWidth,
          height: contentHeight,
        });
      }
    });
  };

  const selectTab = (id: number) => {
    if (!findTab(id)) return;

    activeId = id;
    layout();
    emit();
  };

  const createTab = ({
    url,
    profileId = 'default',
    openedByAgent = false,
    focus = false,
    openerId,
  }: CreateTabOptions = {}) => {
    const view = new WebContentsView({
      webPreferences: {
        partition: partitionOf(profileId),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        /*
         * 에이전트 탭은 화면을 뺏지 않으므로 작업 내내 setVisible(false) 상태로 돈다.
         * 기본값(true)이면 숨은 렌더러의 타이머와 rAF 가 눌리는데, playwright 의 대기와
         * actionability 판정이 rAF 폴링이라 로그인·발행·삭제가 타임아웃까지 매달릴 수 있다.
         */
        backgroundThrottling: false,
      },
    });

    const tab: Tab = { id: nextId, profileId, openedByAgent, openerId, view };
    nextId += 1;
    tabs.push(tab);

    const { webContents } = view;

    const stampTabId = () => {
      void webContents
        .executeJavaScript(`window.__gngTabId = ${tab.id};`, true)
        .catch(() => undefined);
    };

    webContents.on('dom-ready', stampTabId);
    webContents.on('did-frame-finish-load', stampTabId);
    webContents.on('did-navigate', emit);
    webContents.on('did-navigate-in-page', emit);
    webContents.on('did-start-loading', emit);
    webContents.on('did-stop-loading', emit);
    webContents.on('page-title-updated', emit);
    webContents.setWindowOpenHandler(({ url: openedUrl }) => {
      createTab({ url: openedUrl, profileId, openedByAgent, openerId: tab.id });
      return { action: 'deny' };
    });

    window.contentView.addChildView(view);
    void webContents.loadURL(normalizeUrl(url ?? HOME_URL));

    if (shouldFocusNewTab({ openedByAgent, focus, hasActive: findTab(activeId ?? -1) !== undefined })) {
      selectTab(tab.id);
    } else {
      // 화면은 그대로 두더라도 사이드바에는 새 탭이 보여야 한다.
      layout();
      emit();
    }

    return tab.id;
  };

  const closeTab = (id: number) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;

    const [removed] = tabs.splice(index, 1);
    if (!removed) return;

    window.contentView.removeChildView(removed.view);
    removed.view.webContents.close();

    // 에이전트 탭이 띄운 팝업은 아무도 닫지 않아 실행마다 쌓인다. 부모와 함께 걷어낸다.
    // 사용자가 연 탭에는 적용하지 않는다. 보고 있던 창이 같이 사라지면 안 된다.
    if (removed.openedByAgent) descendantTabIds(tabs, id).forEach(closeTab);

    if (activeId === id) {
      const fallback = tabs[index] ?? tabs[index - 1];
      activeId = fallback?.id ?? null;
    }

    if (tabs.length === 0) {
      createTab();
      return;
    }

    layout();
    emit();
  };

  const navigate = (id: number, input: string) => {
    const tab = findTab(id);
    if (!tab) return;

    void tab.view.webContents.loadURL(normalizeUrl(input));
  };

  const goBack = (id: number) => {
    findTab(id)?.view.webContents.navigationHistory.goBack();
  };

  const goForward = (id: number) => {
    findTab(id)?.view.webContents.navigationHistory.goForward();
  };

  const reload = (id: number) => {
    findTab(id)?.view.webContents.reload();
  };

  return {
    createTab,
    closeTab,
    selectTab,
    navigate,
    goBack,
    goForward,
    reload,
    layout,
    snapshot,
  };
};

export type TabManager = ReturnType<typeof createTabManager>;
