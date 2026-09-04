import { ERRORS, ONBOARDING, CHAT } from '../messages';
import { api } from './dom';
import { setRunning } from './run-state';
import { addThinking, removeThinking } from './thinking';
import { appendEntry } from './chat-log';
import { readableError } from './readable-error';
import { requestApiKey } from './request-api-key';
import { panelState } from './state';

export const runMessage = async (message: string) => {
  setRunning(true);
  addThinking();

  try {
    panelState.history = await api.runAgent(message, panelState.history);
  } catch (error) {
    // 클라이언트는 키가 있다고 알고 있는데 메인 프로세스가 거부하는 경우다 -
    // 예전 빌드가 암호화해 둔 값이 지금 실행 환경 키체인에서 안 풀릴 때 생긴다.
    // 문구만 띄우면 막다른 길이니 등록 폼을 바로 띄운다.
    if (readableError(error) === ERRORS.apiKeyRequired) {
      panelState.hasApiKey = false;
      panelState.pendingMessage = message;
      requestApiKey(ONBOARDING.askApiKeyMidTask);
    } else {
      appendEntry(CHAT.roleSystem, readableError(error), 'error');
    }
  } finally {
    removeThinking();
    setRunning(false);
  }
};
