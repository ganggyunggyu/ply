import { ONBOARDING, CHAT } from '../messages';
import { api, accountLabelEl, accountIdEl, accountPwEl } from './dom';
import { renderAccounts } from './account-list';
import { clearEmptyState, appendEntry } from './chat-log';
import { readableError } from './readable-error';

export const handleAddAccount = async () => {
  try {
    const accounts = await api.addAccount({
      label: accountLabelEl.value,
      naverId: accountIdEl.value,
      password: accountPwEl.value || undefined,
    });

    accountLabelEl.value = '';
    accountIdEl.value = '';
    accountPwEl.value = '';
    renderAccounts(accounts);

    if (accounts.length === 1) {
      clearEmptyState();
      appendEntry(CHAT.roleAgent, ONBOARDING.accountSaved(accounts[0]?.naverId ?? ''));
    }
  } catch (error) {
    appendEntry(CHAT.roleSystem, readableError(error), 'error');
  }
};
