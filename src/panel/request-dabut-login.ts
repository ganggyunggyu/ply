import { ONBOARDING, SETTINGS, CHAT } from '../messages';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { addThinking } from './thinking';
import { renderSchedulerStatus, renderViroStatus } from './scheduler-status';
import { refreshServiceChip } from './chips';
import { readableError } from './readable-error';

/** 에이전트가 dabut_login 을 부르면 이 카드가 뜬다. 끝나면 결과를 메인으로 돌려준다. */
export const requestAgentDabutLogin = ({ id, reason }: { id: number; reason: string }) => {
  // 대기가 10분을 넘기면 메인이 false 를 준다. 그대로 삼키면 사용자는 눌렀는데 아무 일도
  // 안 일어난 것처럼 보이고, 스피너만 계속 돈다.
  const finish = async (result: string) => {
    const accepted = await api.answerDabutLogin(id, result);

    if (accepted) {
      addThinking();
      return;
    }

    appendEntry(CHAT.roleSystem, CHAT.answerExpired, 'error');
  };

  appendCard({
    lead: reason.trim() || ONBOARDING.askServiceLogin,
    fields: [
      { placeholder: SETTINGS.serviceUserPlaceholder },
      { placeholder: SETTINGS.servicePassPlaceholder, type: 'password' },
    ],
    submitLabel: SETTINGS.serviceLoginLabel,
    hint: SETTINGS.serviceLoginHint,
    onSubmit: async ([username, password], setError) => {
      if (!username?.trim() || !password) return false;

      try {
        const settings = await api.loginDabut({ username: username.trim(), password });
        renderSchedulerStatus(settings);
  renderViroStatus(settings);
        void refreshServiceChip();
        appendEntry(CHAT.roleAgent, ONBOARDING.serviceLoginSaved(settings.schedulerLabel));
        await finish(`로그인 성공: ${settings.schedulerLabel}`);
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      void finish('사용자가 로그인을 건너뛰었다');
    },
  });
};
