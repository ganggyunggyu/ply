import { SETTINGS } from '../messages';
import { api, epDabutEl, epSchedulerEl, epExposureEl, endpointStatusEl } from './dom';
import { readableError } from './readable-error';
import { refreshServiceChip } from './chips';

export const handleSaveEndpoints = async () => {
  try {
    const settings = await api.setEndpoints({
      dabutBaseUrl: epDabutEl.value.trim(),
      schedulerBaseUrl: epSchedulerEl.value.trim(),
      exposureBotDir: epExposureEl.value.trim(),
    });

    endpointStatusEl.textContent = settings.endpoints.exposureBotDir
      ? SETTINGS.endpointsSaved
      : SETTINGS.exposurePathMissing;
    void refreshServiceChip();
  } catch (error) {
    endpointStatusEl.textContent = readableError(error);
  }
};
