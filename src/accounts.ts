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

  /**
   * 저장된 비밀번호만 바꾼다. id 는 그대로 둔다.
   *
   * remove + add 로 흉내내면 nextAccountId 의 slug 규칙 때문에 같은 라벨이라도
   * qwzx16 -> qwzx16-2 가 되고, 프로필 파티션이 id 를 쓰기 때문에 로그인 세션이 통째로 갈린다.
   * 그래서 이 자리에 따로 둔다.
   *
   * 없는 id 면 null 이다. 던지지 않는다. "계정을 못 찾았다" 는 부르는 쪽이 사용자에게
   * 그대로 전할 수 있는 결과이지 예외가 아니다.
   */
  const updatePassword = (id: string, password: string): NaverAccount | null => {
    if (!password) throw new Error(ERRORS.passwordRequired);
    if (!crypto.isAvailable()) throw new Error(ERRORS.safeStorageUnavailable);

    const accounts = read();
    const index = accounts.findIndex((account) => account.id === id);
    if (index === -1) return null;

    const current = accounts[index] as StoredAccount;
    const updated: StoredAccount = { ...current, passwordCipher: crypto.encrypt(password) };

    write(accounts.map((account, at) => (at === index ? updated : account)));

    return toPublicAccount(updated);
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

  return { list, add, updatePassword, remove, find, readPassword };
};

export type AccountStore = ReturnType<typeof createAccountStore>;
