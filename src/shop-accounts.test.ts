import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createShopAccountStore } from './shop-accounts';
import type { SecretCrypto } from './accounts';

const PREFIX = 'enc:';
const fakeCrypto = (available = true): SecretCrypto => ({
  isAvailable: () => available,
  encrypt: (plain) => `${PREFIX}${Buffer.from(plain).toString('base64')}`,
  decrypt: (cipher) => Buffer.from(cipher.slice(PREFIX.length), 'base64').toString('utf-8'),
});

const dirs: string[] = [];
const makeStore = (crypto: SecretCrypto = fakeCrypto()) => {
  const dir = mkdtempSync(join(tmpdir(), 'ply-shop-'));
  dirs.push(dir);
  return { store: createShopAccountStore({ filePath: join(dir, 'shop.json'), crypto }), dir };
};

after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

test('몰 주소 끝 슬래시를 정리해 저장한다', () => {
  const { store } = makeStore();
  const created = store.add({ label: '한려담원', baseUrl: 'https://myshop.com/', memberId: 'buyer1', password: 'pw' });
  assert.equal(created.baseUrl, 'https://myshop.com');
  assert.equal(created.hasPassword, true);
});

test('몰 주소나 아이디가 비면 거부한다', () => {
  const { store } = makeStore();
  assert.throws(() => store.add({ label: '', baseUrl: '', memberId: 'x' }), /주소/);
  assert.throws(() => store.add({ label: '', baseUrl: 'https://a.com', memberId: '  ' }), /아이디/);
});

test('저장 파일에 평문 비밀번호가 없다', () => {
  const { store, dir } = makeStore();
  store.add({ label: 'A', baseUrl: 'https://a.com', memberId: 'buyer', password: 'secret-pw' });
  const raw = readFileSync(join(dir, 'shop.json'), 'utf-8');
  assert.equal(raw.includes('secret-pw'), false);
});

test('readPassword 로 복호화해 되찾는다', () => {
  const { store } = makeStore();
  const { id } = store.add({ label: 'A', baseUrl: 'https://a.com', memberId: 'buyer', password: 'secret-pw' });
  assert.equal(store.readPassword(id), 'secret-pw');
});

test('안전 저장소가 없으면 비밀번호 저장을 거부한다', () => {
  const { store } = makeStore(fakeCrypto(false));
  assert.throws(() => store.add({ label: 'A', baseUrl: 'https://a.com', memberId: 'buyer', password: 'pw' }), /안전 저장소/);
});
