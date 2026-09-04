import { ONBOARDING, CHAT } from '../messages';
import type { AgentCardOutcome } from '../bridge';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { addThinking } from './thinking';
import { readableError } from './readable-error';

/**
 * 에이전트가 exposure_login 을 부르면 이 카드가 뜬다.
 * 비밀번호는 여기서 메인으로만 가고 모델은 보지 않는다.
 */
export const requestAgentExposureLogin = ({ id, reason }: { id: number; reason: string }) => {
  const finish = async (outcome: AgentCardOutcome) => {
    const accepted = await api.answerExposureLogin(id, JSON.stringify(outcome));

    if (accepted) {
      addThinking();
      return;
    }

    appendEntry(CHAT.roleSystem, CHAT.answerExpired, 'error');
  };

  appendCard({
    // 첫 줄은 코드 문장으로 고정한다. reason 은 모델 문자열이라 note 로만 내려간다.
    lead: ONBOARDING.askExposureLogin,
    note: reason,
    fields: [
      { placeholder: ONBOARDING.exposureUserPlaceholder },
      { placeholder: ONBOARDING.exposurePassPlaceholder, type: 'password' },
    ],
    submitLabel: ONBOARDING.exposureLoginLabel,
    hint: ONBOARDING.exposureLoginHint,
    onSubmit: async ([loginId, password], setError) => {
      if (!loginId?.trim() || !password) return false;

      try {
        await api.loginExposure({ loginId: loginId.trim(), password });
        appendEntry(CHAT.roleAgent, ONBOARDING.exposureLoginSaved(loginId.trim()));
        await finish({ status: 'exposure_login', name: loginId.trim() });
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      void finish({ status: 'cancelled' });
    },
  });
};
