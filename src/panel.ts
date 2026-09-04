import { CHAT, ONBOARDING, SETTINGS } from './messages';
import {
  api,
  addAccountEl,
  agentModelEl,
  runChromeImportEl,
  chipModelEl,
  chipServicesEl,
  composerEl,
  endpointStatusEl,
  epDabutEl,
  epExposureEl,
  epSchedulerEl,
  keyStatusEl,
  issueKeyEl,
  logEl,
  promptEl,
  saveEndpointsEl,
  saveKeyEl,
  schLoginEl,
  schPassEl,
  settingsEl,
  settingsToggleEl,
  stopEl,
  viroSaveEl,
  writerModelEl,
} from './panel/dom';
import { panelState } from './panel/state';
import { applyStaticLabels } from './panel/static-labels';
import { renderModelOptions } from './panel/model-options';
import { renderAccounts } from './panel/account-list';
import { applySettings } from './panel/service-catalog';
import { renderChips, refreshServiceChip } from './panel/chips';
import { renderSchedulerStatus, renderViroStatus } from './panel/scheduler-status';
import { requestApiKey } from './panel/request-api-key';
import { requestAccount } from './panel/request-account';
import { appendEntry, renderEmptyState } from './panel/chat-log';
import { setRunning } from './panel/run-state';
import { handleAgentEvent } from './panel/agent-event';
import { addStep } from './panel/steps';
import { renderQuestion } from './panel/render-question';
import { requestAgentDabutLogin } from './panel/request-dabut-login';
import { requestAgentExposureLogin } from './panel/request-exposure-login';
import { requestAgentAccountCard } from './panel/request-account-card';
import { handleSettingsToggle, handleServiceChipClick } from './panel/settings-toggle';
import { handleModelChipClick } from './panel/model-chip';
import { handleSaveKey, handleIssueKey } from './panel/key-handlers';
import { handleAgentModelChange, handleWriterModelChange } from './panel/model-select-handlers';
import { handleSaveEndpoints } from './panel/endpoint-handlers';
import { handleSchedulerLogin, handleSchedulerPassKeydown } from './panel/scheduler-handlers';
import { handleViroTokenSave } from './panel/viro-handlers';
import { handleAddAccount } from './panel/account-handlers';
import { initChromeImport, handleRunChromeImport } from './panel/chrome-import-handlers';
import { handleSubmit, handlePromptKeydown, handleStopClick } from './panel/composer-handlers';

const init = async () => {
  applyStaticLabels();
  // 실행 중에 패널이 리로드되면 여기서만 상태를 되찾을 수 있다. 안 물어보면 정지 버튼도 안 뜨고
  // 메시지를 보내면 agentBusy 로 튕긴다.
  const [settings, models, accounts, status] = await Promise.all([
    api.getSettings(),
    api.listModels(),
    api.listAccounts(),
    api.getAgentStatus(),
  ]);

  panelState.hasApiKey = settings.hasApiKey;
  panelState.agentPresets = models.agent;
  keyStatusEl.textContent = settings.hasApiKey ? SETTINGS.keyStatusSaved : SETTINGS.keyStatusMissing;
  renderModelOptions(agentModelEl, models.agent, settings.agentModel);
  renderModelOptions(writerModelEl, models.writer, settings.writerModel);
  renderAccounts(accounts);

  epDabutEl.value = settings.endpoints.dabutBaseUrl;
  epSchedulerEl.value = settings.endpoints.schedulerBaseUrl;
  epExposureEl.value = settings.endpoints.exposureBotDir;
  endpointStatusEl.textContent = settings.endpoints.exposureBotDir
    ? SETTINGS.endpointsSaved
    : SETTINGS.exposurePathMissing;
  applySettings(settings);

  renderChips(settings);
  renderSchedulerStatus(settings);
  renderViroStatus(settings);
  void refreshServiceChip();

  settingsEl.hidden = true;

  if (!panelState.hasApiKey) {
    requestApiKey(ONBOARDING.askApiKeyFirst);
  } else if (accounts.length === 0) {
    requestAccount(ONBOARDING.askAccountOnStart);
  } else {
    appendEntry(CHAT.roleAgent, ONBOARDING.readyShort);
  }

  if (panelState.hasApiKey && accounts.length > 0) renderEmptyState();

  setRunning(status.running);

  api.onAgentRunning(setRunning);
  api.onAgentEvent(handleAgentEvent);
  api.onAgentProgress((message) => {
    const running = logEl.querySelector('.step[data-state="running"]:not(.thinking)');
    const detail = running?.querySelector('.step-detail') as HTMLElement | null | undefined;
    if (detail) detail.textContent = message;
    else addStep(CHAT.roleProgress, message);
  });
  api.onAgentQuestion(renderQuestion);
  api.onDabutLoginRequest(requestAgentDabutLogin);
  api.onExposureLoginRequest(requestAgentExposureLogin);
  api.onAccountCardRequest(requestAgentAccountCard);

  void initChromeImport();
};

settingsToggleEl.addEventListener('click', handleSettingsToggle);
chipModelEl.addEventListener('click', handleModelChipClick);
chipServicesEl.addEventListener('click', handleServiceChipClick);
saveKeyEl.addEventListener('click', handleSaveKey);
issueKeyEl.addEventListener('click', handleIssueKey);
agentModelEl.addEventListener('change', handleAgentModelChange);
writerModelEl.addEventListener('change', handleWriterModelChange);
saveEndpointsEl.addEventListener('click', handleSaveEndpoints);
schLoginEl.addEventListener('click', handleSchedulerLogin);
viroSaveEl.addEventListener('click', handleViroTokenSave);
schPassEl.addEventListener('keydown', handleSchedulerPassKeydown);
addAccountEl.addEventListener('click', handleAddAccount);
runChromeImportEl.addEventListener('click', handleRunChromeImport);
composerEl.addEventListener('submit', handleSubmit);
promptEl.addEventListener('keydown', handlePromptKeydown);
stopEl.addEventListener('click', handleStopClick);

void init();

export {};
