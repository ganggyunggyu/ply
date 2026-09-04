import { CHAT, ONBOARDING } from '../messages';
import { api, promptEl, stopEl } from './dom';
import { appendEntry } from './chat-log';
import { requestApiKey } from './request-api-key';
import { runMessage } from './run-message';
import { panelState } from './state';

export const handleSubmit = async (event: Event) => {
  event.preventDefault();

  const message = promptEl.value.trim();
  if (!message || panelState.running) return;

  promptEl.value = '';
  appendEntry(CHAT.roleUser, message, 'user');

  if (!panelState.hasApiKey) {
    panelState.pendingMessage = message;
    requestApiKey(ONBOARDING.askApiKeyMidTask);
    return;
  }

  await runMessage(message);
};

export const handlePromptKeydown = (event: KeyboardEvent) => {
  // 그냥 엔터가 전송이다. 줄바꿈이 필요하면 Shift+Enter 로 넣는다.
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void handleSubmit(event);
  }
};

/** 한 번만 누를 수 있게 잠근다. 실제 정지는 다음 반복에서 일어난다. */
export const handleStopClick = () => {
  stopEl.disabled = true;
  appendEntry(CHAT.roleSystem, CHAT.cancelRequested);
  void api.cancelAgent();
};
