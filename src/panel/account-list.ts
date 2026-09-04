import type { NaverAccount } from '../bridge';
import { SETTINGS } from '../messages';
import { accountListEl, api } from './dom';

export const renderAccounts = (accounts: NaverAccount[]) => {
  accountListEl.replaceChildren(
    ...accounts.map((account) => {
      const item = document.createElement('li');

      const meta = document.createElement('div');
      meta.innerHTML = '';
      meta.textContent = account.label;

      const sub = document.createElement('span');
      sub.className = 'account-meta';
      sub.textContent = ` ${account.naverId} · ${account.hasPassword ? SETTINGS.accountPasswordSaved : SETTINGS.accountManualLogin}`;
      meta.append(sub);

      const remove = document.createElement('button');
      remove.className = 'ghost';
      remove.textContent = SETTINGS.accountRemoveLabel;

      const handleRemove = async () => {
        renderAccounts(await api.removeAccount(account.id));
      };
      remove.addEventListener('click', handleRemove);

      item.append(meta, remove);
      return item;
    }),
  );

  if (accounts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'account-meta';
    empty.textContent = SETTINGS.accountsEmpty;
    accountListEl.append(empty);
  }
};
