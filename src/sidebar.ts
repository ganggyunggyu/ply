import type { BrowserStateView, NaverAccount, TabSnapshotView } from './bridge';
import { SIDEBAR } from './messages';
import { createLibrary } from './sidebar/library';

const api = window.gngBrowser;

const newTabEl = document.getElementById('new-tab') as HTMLButtonElement;
const tabListEl = document.getElementById('tab-list') as HTMLUListElement;
const tabCountEl = document.getElementById('tab-count') as HTMLSpanElement;
const agentSectionEl = document.getElementById('agent-section') as HTMLElement;
const agentHeadEl = document.getElementById('agent-head') as HTMLButtonElement;
const agentListEl = document.getElementById('agent-list') as HTMLUListElement;
const agentCountEl = document.getElementById('agent-count') as HTMLSpanElement;
const agentChevEl = document.getElementById('agent-chev') as HTMLSpanElement;
const libTabBookmarksEl = document.getElementById('lib-tab-bookmarks') as HTMLButtonElement;
const libTabHistoryEl = document.getElementById('lib-tab-history') as HTMLButtonElement;
const libSearchEl = document.getElementById('lib-search') as HTMLInputElement;
const libListEl = document.getElementById('lib-list') as HTMLUListElement;

const library = createLibrary(api, {
  tabBookmarks: libTabBookmarksEl,
  tabHistory: libTabHistoryEl,
  search: libSearchEl,
  list: libListEl,
});

let state: BrowserStateView = { tabs: [], activeId: null };
let accounts: NaverAccount[] = [];
/** 새 탭은 지금 보고 있는 탭과 같은 세션에서 연다. 계정 탭에서 + 를 누르면 그 계정으로 하나 더. */
let currentProfileId = 'default';
let agentCollapsed = false;

/**
 * 탭 배지에 쓸 세션 이름. 에이전트는 계정을 로그인할 때 profileId 로 계정 id 를 쓰기 때문에
 * (naver-login.ts) 계정 id 로 뜬 세션은 계정 이름으로 보여야 어느 계정 창인지 보인다.
 */
const labelOf = (profileId: string) => accounts.find(({ id }) => id === profileId)?.label ?? profileId;

const faviconFor = (url: string) => {
  try {
    const { origin } = new URL(url);
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
};

const buildTab = (tab: TabSnapshotView) => {
  const { id, title, url, loading, profileId, openedByAgent } = tab;

  const item = document.createElement('li');
  const button = document.createElement('button');
  button.className = 'tab';
  button.dataset.active = String(id === state.activeId);
  button.title = url;

  const icon = document.createElement('img');
  icon.className = 'favicon';
  icon.src = faviconFor(url);
  icon.alt = '';
  icon.addEventListener('error', () => {
    icon.removeAttribute('src');
  });

  const label = document.createElement('span');
  label.className = 'tab-title';
  label.textContent = loading ? SIDEBAR.tabLoading : title;

  const close = document.createElement('button');
  close.className = 'tab-close';
  close.textContent = '×';
  close.setAttribute('aria-label', SIDEBAR.tabCloseLabel);

  const handleSelect = () => {
    void api.selectTab(id);
  };
  const handleClose = (event: MouseEvent) => {
    event.stopPropagation();
    void api.closeTab(id);
  };

  button.addEventListener('click', handleSelect);
  close.addEventListener('click', handleClose);

  button.append(icon, label);

  if (!openedByAgent && profileId !== 'default') {
    const badge = document.createElement('span');
    badge.className = 'tab-badge';
    badge.textContent = labelOf(profileId);
    button.append(badge);
  }

  button.append(close);
  item.append(button);

  return item;
};

const render = () => {
  const agentTabs = state.tabs.filter(({ openedByAgent }) => openedByAgent);
  const normalTabs = state.tabs.filter(({ openedByAgent }) => !openedByAgent);

  tabListEl.replaceChildren(...normalTabs.map(buildTab));
  tabCountEl.textContent = normalTabs.length ? String(normalTabs.length) : '';

  agentSectionEl.hidden = agentTabs.length === 0;
  agentCountEl.textContent = String(agentTabs.length);
  agentChevEl.textContent = agentCollapsed ? '›' : '⌄';
  agentListEl.replaceChildren(...(agentCollapsed ? [] : agentTabs.map(buildTab)));

  const active = state.tabs.find(({ id }) => id === state.activeId);
  if (active) currentProfileId = active.profileId;
};

const handleNewTab = () => {
  void api.createTab({ profileId: currentProfileId });
};

const handleAgentToggle = () => {
  agentCollapsed = !agentCollapsed;
  render();
};

const handleState = (next: BrowserStateView) => {
  state = next;
  render();
};

const applyStaticLabels = () => {
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('lbl-tabs', SIDEBAR.groupTabs);
  set('lbl-agent-tabs', SIDEBAR.groupAgentTabs);
  set('lib-tab-bookmarks', SIDEBAR.libBookmarks);
  set('lib-tab-history', SIDEBAR.libHistory);
  libSearchEl.placeholder = SIDEBAR.libSearchPlaceholder;

  newTabEl.setAttribute('aria-label', SIDEBAR.newTabLabel);
  newTabEl.title = SIDEBAR.newTabTitle;
};

const init = async () => {
  applyStaticLabels();
  const [initialState, initialAccounts] = await Promise.all([api.getState(), api.listAccounts()]);

  state = initialState;
  accounts = initialAccounts;

  render();
  void library.load();

  api.onState(handleState);
  api.onLibraryChanged(() => void library.load());
};

newTabEl.addEventListener('click', handleNewTab);
agentHeadEl.addEventListener('click', handleAgentToggle);

api.onAgentRunning((running) => {
  document.body.dataset.running = String(running);
});

void init();

export {};
