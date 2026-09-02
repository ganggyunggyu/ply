import { TOOLBAR } from './messages';
import type { BrowserStateView, Profile, TabSnapshotView } from './bridge';

const { gngBrowser } = window;

const addressEl = document.getElementById('address') as HTMLInputElement;
const backEl = document.getElementById('back') as HTMLButtonElement;
const forwardEl = document.getElementById('forward') as HTMLButtonElement;
const reloadEl = document.getElementById('reload') as HTMLButtonElement;
const profileChipEl = document.getElementById('profile-chip') as HTMLSpanElement;
const togglePanelEl = document.getElementById('toggle-panel') as HTMLButtonElement;

let state: BrowserStateView = { tabs: [], activeId: null };
let profiles: Profile[] = [];

const activeTab = (): TabSnapshotView | null =>
  state.tabs.find(({ id }) => id === state.activeId) ?? null;

const labelOf = (profileId: string) =>
  profiles.find(({ id }) => id === profileId)?.label ?? profileId;

const render = () => {
  const tab = activeTab();

  backEl.disabled = !tab?.canGoBack;
  forwardEl.disabled = !tab?.canGoForward;
  reloadEl.disabled = !tab;

  profileChipEl.textContent = tab && tab.profileId !== 'default' ? labelOf(tab.profileId) : '';

  if (tab && document.activeElement !== addressEl) addressEl.value = tab.url;
};

const handleState = (next: BrowserStateView) => {
  state = next;
  render();
};

const handleAddressKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return;

  const tab = activeTab();
  if (!tab) return;

  void gngBrowser.navigate(tab.id, addressEl.value);
  addressEl.blur();
};

const handleBack = () => {
  const tab = activeTab();
  if (tab) void gngBrowser.goBack(tab.id);
};

const handleForward = () => {
  const tab = activeTab();
  if (tab) void gngBrowser.goForward(tab.id);
};

const handleReload = () => {
  const tab = activeTab();
  if (tab) void gngBrowser.reload(tab.id);
};

const handleTogglePanel = () => {
  void gngBrowser.togglePanel();
};

const handleShortcut = (event: KeyboardEvent) => {
  if (!event.metaKey && !event.ctrlKey) return;

  if (event.key === 'j') {
    event.preventDefault();
    handleTogglePanel();
    return;
  }

  if (event.key === 't') {
    event.preventDefault();
    void gngBrowser.createTab({ profileId: activeTab()?.profileId ?? 'default' });
    return;
  }

  if (event.key === 'l') {
    event.preventDefault();
    addressEl.focus();
    addressEl.select();
    return;
  }

  if (event.key === 'w') {
    event.preventDefault();
    const tab = activeTab();
    if (tab) void gngBrowser.closeTab(tab.id);
  }
};

const applyStaticLabels = () => {
  backEl.setAttribute('aria-label', TOOLBAR.backLabel);
  forwardEl.setAttribute('aria-label', TOOLBAR.forwardLabel);
  reloadEl.setAttribute('aria-label', TOOLBAR.reloadLabel);
  addressEl.placeholder = TOOLBAR.addressPlaceholder;
  togglePanelEl.setAttribute('aria-label', TOOLBAR.panelToggleLabel);
  togglePanelEl.title = TOOLBAR.panelToggleTitle;
};

const init = async () => {
  applyStaticLabels();
  const [initialState, initialProfiles] = await Promise.all([
    gngBrowser.getState(),
    gngBrowser.listProfiles(),
  ]);

  state = initialState;
  profiles = initialProfiles;
  render();

  gngBrowser.onState(handleState);
};

backEl.addEventListener('click', handleBack);
forwardEl.addEventListener('click', handleForward);
reloadEl.addEventListener('click', handleReload);
togglePanelEl.addEventListener('click', handleTogglePanel);
addressEl.addEventListener('keydown', handleAddressKeydown);
window.addEventListener('keydown', handleShortcut);

gngBrowser.onAgentRunning((running) => {
  document.body.dataset.running = String(running);
});

void init();

export {};
