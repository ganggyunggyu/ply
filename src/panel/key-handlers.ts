import { ONBOARDING, SETTINGS } from '../messages';
import { api, apiKeyEl, issueKeyEl, keyStatusEl } from './dom';
import { panelState } from './state';

// 발급 중에 메인이 보내는 중간 안내(이메일 인증 코드 넣으라는 등). 발급이 몇 분 걸릴 수 있어서
// '발급받는 중…' 만 띄워 두면 사용자가 뭘 해야 하는지 모른다. 모듈 로드 시 한 번만 구독한다.
api.onOpenRouterProgress((message) => {
  keyStatusEl.textContent = message;
});

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
    } else if (result.status === 'manual') {
      keyStatusEl.textContent = result.detail;
    } else {
      keyStatusEl.textContent = ONBOARDING.apiKeyIssueFailed(result.detail);
    }
  } catch (error) {
    keyStatusEl.textContent = ONBOARDING.apiKeyIssueFailed(error instanceof Error ? error.message : String(error));
  } finally {
    issueKeyEl.disabled = false;
  }
};
