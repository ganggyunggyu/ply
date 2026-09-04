import { SETTINGS, CHAT, ONBOARDING } from '../messages';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { renderSchedulerStatus, renderViroStatus } from './scheduler-status';
import { refreshServiceChip } from './chips';
import { requestCookieLogin } from './request-cookie-login';
import { readableError } from './readable-error';

export const requestServiceLogin = (lead: string) => {
  appendCard({
    lead,
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
        appendEntry(CHAT.roleAgent, ONBOARDING.serviceLoginSaved(settings.schedulerLabel));
        renderSchedulerStatus(settings);
  renderViroStatus(settings);
        void refreshServiceChip();
        requestCookieLogin();
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: requestCookieLogin,
  });
};
