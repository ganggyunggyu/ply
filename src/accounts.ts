import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ERRORS } from './messages';

export type SecretCrypto = {
  isAvailable: () => boolean;
  encrypt: (plainText: string) => string;
  decrypt: (cipherText: string) => string;
};

export type NaverAccount = {
  id: string;
  label: string;
  naverId: string;
  hasPassword: boolean;
};

export type AddAccountInput = {
  label: string;
  naverId: string;
  password?: string;
};

type StoredAccount = {
  id: string;
  label: string;
  naverId: string;
  passwordCipher?: string;
};

type AccountStoreOptions = {
  filePath: string;
  crypto: SecretCrypto;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'account';

export const toPublicAccount = ({ id, label, naverId, passwordCipher }: StoredAccount): NaverAccount => ({
  id,
  label,
  naverId,
  hasPassword: Boolean(passwordCipher),
});

export const nextAccountId = (base: string, taken: Set<string>) => {
  const slug = slugify(base);
  if (!taken.has(slug)) return slug;

  let suffix = 2;
  while (taken.has(`${slug}-${suffix}`)) suffix += 1;

  return `${slug}-${suffix}`;
};

export const createAccountStore = ({ filePath, crypto }: AccountStoreOptions) => {
  const read = (): StoredAccount[] => {
    if (!existsSync(filePath)) return [];

    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredAccount[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(ERRORS.accountsFileUnreadable, error);
      return [];
    }
  };

  const write = (accounts: StoredAccount[]) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(accounts, null, 2), 'utf-8');
  };

  const list = () => read().map(toPublicAccount);

  const add = ({ label, naverId, password }: AddAccountInput) => {
    const trimmedNaverId = naverId.trim();
    if (!trimmedNaverId) throw new Error(ERRORS.naverIdRequired);

    if (password && !crypto.isAvailable()) {
      throw new Error(ERRORS.safeStorageUnavailable);
    }

    const accounts = read();
    const id = nextAccountId(label || trimmedNaverId, new Set(accounts.map((account) => account.id)));

    const created: StoredAccount = {
      id,
      label: label.trim() || trimmedNaverId,
      naverId: trimmedNaverId,
      passwordCipher: password ? crypto.encrypt(password) : undefined,
    };

    write([...accounts, created]);

    return toPublicAccount(created);
  };

  const remove = (id: string) => {
    write(read().filter((account) => account.id !== id));
    return list();
  };

  const find = (id: string) => {
    const account = read().find((entry) => entry.id === id);
    return account ? toPublicAccount(account) : null;
  };

  const readPassword = (id: string) => {
    const account = read().find((entry) => entry.id === id);
    if (!account?.passwordCipher) return null;

    return crypto.decrypt(account.passwordCipher);
  };

  return { list, add, remove, find, readPassword };
};

export type AccountStore = ReturnType<typeof createAccountStore>;
