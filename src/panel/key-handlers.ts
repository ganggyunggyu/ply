import { SETTINGS } from '../messages';
import { api, apiKeyEl, keyStatusEl } from './dom';

export const handleSaveKey = async () => {
  try {
    const settings = await api.setApiKey(apiKeyEl.value);
    apiKeyEl.value = '';
    keyStatusEl.textContent = settings.hasApiKey ? SETTINGS.keyStatusSaved : SETTINGS.keyStatusMissing;
  } catch (error) {
    keyStatusEl.textContent = error instanceof Error ? error.message : String(error);
  }
};
