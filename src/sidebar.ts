import type { BrowserStateView, Profile, TabSnapshotView } from './bridge';
import { SETTINGS, SIDEBAR } from './messages';

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

let state: BrowserStateView = { tabs: [], activeId: null };
let profiles: Profile[] = [];
let currentProfileId = 'default';
let agentCollapsed = false;

const labelOf = (profileId: string) =>
  profiles.find(({ id }) => id === profileId)?.label ?? profileId;

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

const renderProfileMenu = () => {
  const entries = profiles.map(({ id, label }) => {
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

  newTabEl.setAttribute('aria-label', SIDEBAR.newTabLabel);
  newTabEl.title = SIDEBAR.newTabTitle;
  profileButtonEl.setAttribute('aria-label', SIDEBAR.profileLabel);
};

const init = async () => {
  applyStaticLabels();
  const [initialState, initialProfiles] = await Promise.all([
    api.getState(),
    api.listProfiles(),
  ]);

  state = initialState;
  profiles = initialProfiles;

  renderProfileMenu();
  render();

  api.onState(handleState);
};

profileButtonEl.addEventListener('click', handleProfileToggle);
newTabEl.addEventListener('click', handleNewTab);
agentHeadEl.addEventListener('click', handleAgentToggle);

api.onAgentRunning((running) => {
  document.body.dataset.running = String(running);
});

void init();

export {};
