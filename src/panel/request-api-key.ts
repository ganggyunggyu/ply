import { ONBOARDING, CHAT } from '../messages';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { readableError } from './readable-error';
import { requestAccount } from './request-account';
import { runMessage } from './run-message';
import { panelState } from './state';
import { OPENROUTER_KEYS_URL } from './constants';

export const requestApiKey = (lead: string) => {
  appendCard({
    lead,
    fields: [{ placeholder: ONBOARDING.apiKeyPlaceholder, type: 'password' }],
    submitLabel: ONBOARDING.apiKeySaveLabel,
    skipLabel: ONBOARDING.apiKeyIssueLabel,
    hint: ONBOARDING.apiKeyHint,
    onSubmit: async ([value], setError) => {
      if (!value?.trim()) return false;

      try {
        const settings = await api.setApiKey(value.trim());
        panelState.hasApiKey = settings.hasApiKey;
        appendEntry(CHAT.roleAgent, ONBOARDING.apiKeySaved);

        if (panelState.pendingMessage) {
          const next = panelState.pendingMessage;
          panelState.pendingMessage = null;
          void runMessage(next);
          return true;
        }

        const accounts = await api.listAccounts();
        if (accounts.length === 0) {
          requestAccount(ONBOARDING.askAccountAfterKey);
        } else {
          appendEntry(CHAT.roleAgent, ONBOARDING.ready);
        }

        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      void api.createTab({ url: OPENROUTER_KEYS_URL });
    },
  });
};
