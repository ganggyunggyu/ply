import { CHAT } from '../messages';
import { sendEl, stopEl } from './dom';
import { panelState } from './state';

export const setRunning = (next: boolean) => {
  panelState.running = next;
  sendEl.disabled = next;
  sendEl.textContent = next ? CHAT.sendRunningLabel : CHAT.sendLabel;
  // 정지 버튼은 돌고 있을 때만 보인다. 새 실행마다 다시 누를 수 있어야 한다.
  stopEl.hidden = !next;
  if (next) stopEl.disabled = false;
  document.body.dataset.running = String(next);
};
