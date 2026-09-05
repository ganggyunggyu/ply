import { ONBOARDING, CHAT } from '../messages';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { readableError } from './readable-error';
import { requestAccount } from './request-account';
import { runMessage } from './run-message';
import { panelState } from './state';

/**
 * 키가 생긴 뒤 공통으로 이어지는 길. 붙여 넣기로 왔든 자동 발급으로 왔든 같다.
 * 키를 기다리던 메시지가 있으면 그걸 먼저 돌리고, 아니면 계정 등록으로 넘어간다.
 */
const continueAfterKey = async () => {
  if (panelState.pendingMessage) {
    const next = panelState.pendingMessage;
    panelState.pendingMessage = null;
    void runMessage(next);
    return;
  }

  const accounts = await api.listAccounts();
  if (accounts.length === 0) requestAccount(ONBOARDING.askAccountAfterKey);
  else appendEntry(CHAT.roleAgent, ONBOARDING.ready);
};

/**
 * 첫 실행이나 작업 중에 키가 없을 때 뜨는 카드. 주된 길은 자동 발급('키 발급받기')이고,
 * 이미 키가 있는 사람만 붙여 넣는다. 발급은 이메일 인증을 기다리는 동안 몇 분이 걸릴 수 있어서
 * 중간 안내를 카드 힌트에 흘려 보낸다.
 */
export const requestApiKey = (lead: string) => {
  appendCard({
    lead,
    fields: [{ placeholder: ONBOARDING.apiKeyPlaceholder, type: 'password' }],
    submitLabel: ONBOARDING.apiKeySaveLabel,
    skipLabel: ONBOARDING.apiKeyIssueLabel,
    skipPrimary: true,
    hint: ONBOARDING.apiKeyHint,
    onSubmit: async ([value], setError) => {
      if (!value?.trim()) return false;

      try {
        const settings = await api.setApiKey(value.trim());
        panelState.hasApiKey = settings.hasApiKey;
        appendEntry(CHAT.roleAgent, ONBOARDING.apiKeySaved);
        await continueAfterKey();
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkipAsync: async (setError, setHint) => {
      setHint(ONBOARDING.apiKeyIssuing);
      panelState.keyProgressSink = setHint;

      try {
        const result = await api.issueOpenRouterKey();

        if (result.status === 'created') {
          panelState.hasApiKey = true;
          appendEntry(CHAT.roleAgent, ONBOARDING.apiKeyIssued);
          await continueAfterKey();
          return true;
        }

        // 로그인·인증·복사가 남은 경우다. 탭은 열려 있고, 카드는 남겨 다시 누를 수 있게 한다.
        setHint(ONBOARDING.apiKeyHint);
        setError(result.status === 'login_required' ? ONBOARDING.apiKeyIssueLogin : ONBOARDING.apiKeyIssueFailed(result.detail));
        return false;
      } catch (error) {
        setHint(ONBOARDING.apiKeyHint);
        setError(readableError(error));
        return false;
      } finally {
        panelState.keyProgressSink = null;
      }
    },
  });
};
