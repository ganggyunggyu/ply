import { PANEL, ONBOARDING, SETTINGS, CHAT } from '../messages';
import { sendEl, stopEl } from './dom';
import { PLACEHOLDERS } from './constants';

export const applyStaticLabels = () => {
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('panel-title', PANEL.title);
  set('settings-toggle', PANEL.settingsToggle);
  set('lbl-apikey', PANEL.apiKeyField);
  set('save-key', ONBOARDING.apiKeySaveLabel);
  set('lbl-agent-model', PANEL.agentModelField);
  set('lbl-writer-model', PANEL.writerModelField);
  set('lbl-endpoints', PANEL.endpointsField);
  set('save-endpoints', PANEL.endpointsSaveLabel);
  set('endpoint-hint', SETTINGS.endpointsHint);
  set('lbl-scheduler', SETTINGS.serviceLoginField);
  set('sch-login', SETTINGS.serviceLoginLabel);
  set('lbl-viro', SETTINGS.viroTokenField);
  set('viro-save', SETTINGS.viroTokenSaveLabel);
  set('lbl-accounts', PANEL.accountsField);
  set('add-account', PANEL.accountAddLabel);
  set('account-hint', ONBOARDING.accountHint);
  set('lbl-chrome-import', SETTINGS.chromeImportField);
  set('lbl-chrome-cookies', SETTINGS.chromeImportCookies);
  set('lbl-chrome-bookmarks', SETTINGS.chromeImportBookmarks);
  set('lbl-chrome-history', SETTINGS.chromeImportHistory);
  set('run-chrome-import', SETTINGS.chromeImportButton);
  set('chrome-import-hint', SETTINGS.chromeImportHint);
  set('composer-hint', CHAT.composerHint);
  set('send', CHAT.sendLabel);
  set('stop', CHAT.stopLabel);

  sendEl.setAttribute('aria-label', CHAT.composerPlaceholder);
  stopEl.setAttribute('aria-label', CHAT.stopTitle);
  stopEl.title = CHAT.stopTitle;

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-ph]').forEach((el) => {
    const key = el.dataset.ph ?? '';
    if (PLACEHOLDERS[key]) el.placeholder = PLACEHOLDERS[key];
  });
};
