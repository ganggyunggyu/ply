import { ONBOARDING, SETTINGS } from '../messages';
import { api, apiKeyEl, issueKeyEl, keyStatusEl } from './dom';
import { panelState } from './state';

export const handleSaveKey = async () => {
  try {
    const settings = await api.setApiKey(apiKeyEl.value);
    apiKeyEl.value = '';
    keyStatusEl.textContent = settings.hasApiKey ? SETTINGS.keyStatusSaved : SETTINGS.keyStatusMissing;
  } catch (error) {
    keyStatusEl.textContent = error instanceof Error ? error.message : String(error);
  }
};

/**
 * OpenRouter 대시보드에서 키를 자동 발급받는다. 로그인 세션이 있으면 그대로 만들어 저장하고,
 * 로그인 화면이면 탭만 열어 두고 사용자가 직접 로그인하게 안내한다.
 */
export const handleIssueKey = async () => {
  issueKeyEl.disabled = true;
  keyStatusEl.textContent = ONBOARDING.apiKeyIssuing;

  try {
    const result = await api.issueOpenRouterKey();

    if (result.status === 'created') {
      panelState.hasApiKey = true;
      keyStatusEl.textContent = ONBOARDING.apiKeyIssued;
    } else if (result.status === 'login_required') {
      keyStatusEl.textContent = ONBOARDING.apiKeyIssueLogin;
    } else {
      keyStatusEl.textContent = ONBOARDING.apiKeyIssueFailed(result.detail);
    }
  } catch (error) {
    keyStatusEl.textContent = ONBOARDING.apiKeyIssueFailed(error instanceof Error ? error.message : String(error));
  } finally {
    issueKeyEl.disabled = false;
  }
};
