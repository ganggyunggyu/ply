import { api, viroSaveEl, viroTokenEl, viroStatusEl } from './dom';
import { readableError } from './readable-error';
import { renderViroStatus } from './scheduler-status';

export const handleViroTokenSave = async () => {
  viroSaveEl.disabled = true;

  try {
    // 값을 지우고 저장하면 토큰이 삭제된다. 빈 칸을 막지 않는 이유다.
    renderViroStatus(await api.setViroToken(viroTokenEl.value.trim()));
    viroTokenEl.value = '';
  } catch (error) {
    viroStatusEl.textContent = readableError(error);
  } finally {
    viroSaveEl.disabled = false;
  }
};
