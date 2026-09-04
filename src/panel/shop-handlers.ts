import type { ShopAccountView } from '../bridge';
import { SETTINGS } from '../messages';
import {
  api,
  shopListEl,
  shopLabelEl,
  shopUrlEl,
  shopIdEl,
  shopPwEl,
  shopHintEl,
} from './dom';
import { readableError } from './readable-error';

const buildRow = (account: ShopAccountView) => {
  const item = document.createElement('li');

  const meta = document.createElement('div');
  meta.textContent = account.label;

  const sub = document.createElement('span');
  sub.className = 'account-meta';
  sub.textContent = ` ${account.baseUrl}`;
  meta.append(sub);

  const login = document.createElement('button');
  login.className = 'ghost';
  login.textContent = SETTINGS.shopLoginLabel;
  login.addEventListener('click', () => void handleShopLogin(account.id));

  const remove = document.createElement('button');
  remove.className = 'ghost';
  remove.textContent = SETTINGS.shopRemoveLabel;
  remove.addEventListener('click', () => void handleShopRemove(account.id));

  item.append(meta, login, remove);
  return item;
};

export const renderShopAccounts = (accounts: ShopAccountView[]) => {
  if (accounts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'account-meta';
    empty.textContent = SETTINGS.shopEmpty;
    shopListEl.replaceChildren(empty);
    return;
  }

  shopListEl.replaceChildren(...accounts.map(buildRow));
};

export const initShopAccounts = async () => {
  try {
    renderShopAccounts(await api.listShopAccounts());
  } catch (error) {
    shopHintEl.textContent = readableError(error);
  }
};

export const handleAddShop = async () => {
  try {
    const accounts = await api.addShopAccount({
      label: shopLabelEl.value,
      baseUrl: shopUrlEl.value,
      memberId: shopIdEl.value,
      password: shopPwEl.value || undefined,
    });

    shopLabelEl.value = '';
    shopUrlEl.value = '';
    shopIdEl.value = '';
    shopPwEl.value = '';
    renderShopAccounts(accounts);
  } catch (error) {
    shopHintEl.textContent = readableError(error);
  }
};

const handleShopRemove = async (id: string) => {
  try {
    renderShopAccounts(await api.removeShopAccount(id));
  } catch (error) {
    shopHintEl.textContent = readableError(error);
  }
};

const handleShopLogin = async (id: string) => {
  shopHintEl.textContent = SETTINGS.shopLoginLabel + '…';
  try {
    const { detail } = await api.loginShop(id);
    shopHintEl.textContent = detail;
  } catch (error) {
    shopHintEl.textContent = readableError(error);
  }
};
