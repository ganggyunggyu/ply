import { api } from './dom';
import { schUserEl, schPassEl, schLoginEl, schStatusEl } from './dom';
import { readableError } from './readable-error';
import { renderSchedulerStatus, renderViroStatus } from './scheduler-status';
import { refreshServiceChip } from './chips';

export const handleSchedulerPassKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') void handleSchedulerLogin();
};

export const handleSchedulerLogin = async () => {
  const username = schUserEl.value.trim();
  if (!username || !schPassEl.value) return;

  schLoginEl.disabled = true;

  try {
    const settings = await api.loginDabut({ username, password: schPassEl.value });
    schPassEl.value = '';
    renderSchedulerStatus(settings);
  renderViroStatus(settings);
    void refreshServiceChip();
  } catch (error) {
    schStatusEl.textContent = readableError(error);
  } finally {
    schLoginEl.disabled = false;
  }
};
