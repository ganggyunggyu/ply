import type { PublicSettings } from '../bridge';
import { SETTINGS } from '../messages';
import { schStatusEl, viroStatusEl } from './dom';

export const renderSchedulerStatus = (settings: PublicSettings) => {
  schStatusEl.textContent = settings.hasSchedulerToken
    ? SETTINGS.serviceLoggedIn(settings.schedulerLabel)
    : SETTINGS.serviceLoginHint;
};

export const renderViroStatus = (settings: PublicSettings) => {
  viroStatusEl.textContent = settings.hasViroToken
    ? SETTINGS.viroTokenSaved
    : SETTINGS.viroTokenHint;
};
