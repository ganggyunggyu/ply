import type { BrowserStateView, NaverAccount, Profile, TabSnapshotView } from './bridge';
import { SETTINGS, SIDEBAR } from './messages';
import { createLibrary } from './sidebar/library';

const api = window.gngBrowser;

const profileButtonEl = document.getElementById('profile-button') as HTMLButtonElement;
const profileNameEl = document.getElementById('profile-name') as HTMLSpanElement;
const profileMenuEl = document.getElementById('profile-menu') as HTMLDivElement;
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
let profiles: Profile[] = [];
let accounts: NaverAccount[] = [];
let currentProfileId = 'default';
let agentCollapsed = false;

/**
 * 세션 이름을 사람이 읽는 이름으로 푼다. 에이전트가 계정을 로그인할 때 profileId 로 계정 id 를 쓰기
 * 때문에(naver-login.ts), 계정 id 로 뜬 세션은 계정 이름으로 보여야 "지금 어느 계정 창인지" 가 보인다.
 */
const labelOf = (profileId: string) => {
  if (profileId === 'default') return SIDEBAR.generalSession;

  return (
    accounts.find(({ id }) => id === profileId)?.label ??
    profiles.find(({ id }) => id === profileId)?.label ??
    profileId
  );
};

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
  if (active) {
    currentProfileId = active.profileId;
    profileNameEl.textContent = labelOf(active.profileId);
  }
};

/**
 * 세션 목록. 등록된 계정이 곧 세션이다(각자 로그인이 분리돼 있다). 그 뒤에 사용자가 손으로 만든
 * 커스텀 프로필, 마지막에 아무 계정에도 안 묶인 일반 브라우징 세션을 둔다. "기본" 이라는 빈 이름
 * 대신 실제 계정 이름이 떠서 지금 어느 창인지 바로 보인다.
 */
const sessionEntries = (): { id: string; label: string }[] => {
  const accountSessions = accounts.map(({ id, label }) => ({ id, label }));
  const customProfiles = profiles.filter(({ id }) => id !== 'default').map(({ id, label }) => ({ id, label }));

  return [...accountSessions, ...customProfiles, { id: 'default', label: SIDEBAR.generalSession }];
};

const renderProfileMenu = () => {
  const entries = sessionEntries().map(({ id, label }) => {
    const button = document.createElement('button');
    button.textContent = label;

    const handlePick = () => {
      currentProfileId = id;
      profileNameEl.textContent = label;
      profileMenuEl.hidden = true;
      void api.createTab({ profileId: id });
    };

    button.addEventListener('click', handlePick);
    return button;
  });

  const add = document.createElement('button');
  add.className = 'add';
  add.textContent = SIDEBAR.addProfileLabel;

  const handleAdd = async () => {
    const label = prompt(SETTINGS.profilePrompt);
    if (!label) return;

    profiles = await api.addProfile(label);
    renderProfileMenu();
  };

  add.addEventListener('click', handleAdd);
  profileMenuEl.replaceChildren(...entries, add);
};

const handleProfileToggle = () => {
  profileMenuEl.hidden = !profileMenuEl.hidden;
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
  profileButtonEl.setAttribute('aria-label', SIDEBAR.profileLabel);
};

const init = async () => {
  applyStaticLabels();
  const [initialState, initialProfiles, initialAccounts] = await Promise.all([
    api.getState(),
    api.listProfiles(),
    api.listAccounts(),
  ]);

  state = initialState;
  profiles = initialProfiles;
  accounts = initialAccounts;

  // 활성 탭이 아직 없으면 프로필 이름 칸이 비어 보인다. 일반 세션 이름으로 채워 둔다.
  if (!state.tabs.some(({ id }) => id === state.activeId)) profileNameEl.textContent = SIDEBAR.generalSession;

  renderProfileMenu();
  render();
  void library.load();

  api.onState(handleState);
  api.onLibraryChanged(() => void library.load());
};

profileButtonEl.addEventListener('click', handleProfileToggle);
newTabEl.addEventListener('click', handleNewTab);
agentHeadEl.addEventListener('click', handleAgentToggle);

api.onAgentRunning((running) => {
  document.body.dataset.running = String(running);
});

void init();

export {};
