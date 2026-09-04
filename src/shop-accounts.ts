import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { SecretCrypto } from './accounts';
import { ERRORS } from './messages';
import { normalizeBaseUrl } from './shop/urls';

export type ShopAccount = {
  id: string;
  label: string;
  baseUrl: string;
  memberId: string;
  hasPassword: boolean;
};

export type AddShopAccountInput = {
  label: string;
  baseUrl: string;
  memberId: string;
  password?: string;
};

type StoredShopAccount = {
  id: string;
  label: string;
  baseUrl: string;
  memberId: string;
  passwordCipher?: string;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'shop';

const nextId = (base: string, taken: Set<string>) => {
  const slug = slugify(base);
  if (!taken.has(slug)) return slug;

  let suffix = 2;
  while (taken.has(`${slug}-${suffix}`)) suffix += 1;

  return `${slug}-${suffix}`;
};

const toPublic = ({ id, label, baseUrl, memberId, passwordCipher }: StoredShopAccount): ShopAccount => ({
  id,
  label,
  baseUrl,
  memberId,
  hasPassword: Boolean(passwordCipher),
});

/** 쇼핑몰 계정 저장소. accounts.ts 와 같은 규칙이되 baseUrl(몰 주소)이 더 붙는다. */
export const createShopAccountStore = ({ filePath, crypto }: { filePath: string; crypto: SecretCrypto }) => {
  const read = (): StoredShopAccount[] => {
    if (!existsSync(filePath)) return [];
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredShopAccount[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const write = (accounts: StoredShopAccount[]) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(accounts, null, 2), 'utf-8');
  };

  const list = () => read().map(toPublic);

  const add = ({ label, baseUrl, memberId, password }: AddShopAccountInput) => {
    const url = normalizeBaseUrl(baseUrl);
    const trimmedId = memberId.trim();
    if (!url) throw new Error(ERRORS.shopBaseUrlRequired);
    if (!trimmedId) throw new Error(ERRORS.shopMemberIdRequired);
    if (password && !crypto.isAvailable()) throw new Error(ERRORS.safeStorageUnavailable);

    const accounts = read();
    const id = nextId(label || trimmedId, new Set(accounts.map((a) => a.id)));
    const created: StoredShopAccount = {
      id,
      label: label.trim() || trimmedId,
      baseUrl: url,
      memberId: trimmedId,
      passwordCipher: password ? crypto.encrypt(password) : undefined,
    };

    write([...accounts, created]);
    return toPublic(created);
  };

  const remove = (id: string) => {
    write(read().filter((a) => a.id !== id));
    return list();
  };

  const find = (id: string) => {
    const account = read().find((a) => a.id === id);
    return account ? toPublic(account) : null;
  };

  /** 로그인 도구가 쓴다. 앱 이름이 바뀌어 암호문이 안 풀리면 던지지 않고 null 을 준다. */
  const readPassword = (id: string) => {
    const account = read().find((a) => a.id === id);
    if (!account?.passwordCipher) return null;
    try {
      return crypto.decrypt(account.passwordCipher);
    } catch {
      return null;
    }
  };

  return { list, add, remove, find, readPassword };
};

export type ShopAccountStore = ReturnType<typeof createShopAccountStore>;
