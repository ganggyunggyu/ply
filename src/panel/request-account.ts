import { ONBOARDING, CHAT } from '../messages';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { renderAccounts } from './account-list';
import { readableError } from './readable-error';
import { requestServiceLogin } from './request-service-login';

export const requestAccount = (lead: string) => {
  appendCard({
    lead,
    fields: [
      { placeholder: ONBOARDING.accountIdPlaceholder },
      { placeholder: ONBOARDING.accountPwPlaceholder, type: 'password' },
    ],
    submitLabel: ONBOARDING.accountSaveLabel,
    hint: ONBOARDING.accountHint,
    onSubmit: async ([naverId, password], setError) => {
      if (!naverId?.trim()) return false;

      try {
        const accounts = await api.addAccount({
          label: naverId.trim(),
          naverId: naverId.trim(),
          password: password || undefined,
        });

        renderAccounts(accounts);
        appendEntry(CHAT.roleAgent, ONBOARDING.accountSaved(naverId.trim()));

        const settings = await api.getSettings();
        if (!settings.hasSchedulerToken) requestServiceLogin(ONBOARDING.askServiceLogin);

        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      appendEntry(CHAT.roleAgent, ONBOARDING.accountSkipped);
      void api.getSettings().then((settings) => {
        if (!settings.hasSchedulerToken) requestServiceLogin(ONBOARDING.askServiceLogin);
      });
    },
  });
};
