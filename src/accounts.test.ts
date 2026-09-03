import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createAccountStore, nextAccountId, toPublicAccount, type SecretCrypto } from './accounts';

const REVERSIBLE_PREFIX = 'enc:';

const fakeCrypto = (available = true): SecretCrypto => ({
  isAvailable: () => available,
  encrypt: (plainText) => `${REVERSIBLE_PREFIX}${Buffer.from(plainText).toString('base64')}`,
  decrypt: (cipherText) =>
    Buffer.from(cipherText.slice(REVERSIBLE_PREFIX.length), 'base64').toString('utf-8'),
});

const dirs: string[] = [];

const makeStore = (crypto: SecretCrypto = fakeCrypto()) => {
  const dir = mkdtempSync(join(tmpdir(), 'gng-accounts-'));
  dirs.push(dir);
  return createAccountStore({ filePath: join(dir, 'accounts.json'), crypto });
};

after(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

test('id 는 겹치면 번호를 붙인다', () => {
  assert.equal(nextAccountId('메인 계정', new Set()), '메인-계정');
  assert.equal(nextAccountId('메인 계정', new Set(['메인-계정'])), '메인-계정-2');
  assert.equal(nextAccountId('!!!', new Set()), 'account');
});

test('공개 형태에는 비밀번호가 없다', () => {
  const account = toPublicAccount({ id: 'a', label: 'A', naverId: 'aid', passwordCipher: 'enc:xx' });

  assert.equal(account.hasPassword, true);
  assert.equal(Object.hasOwn(account, 'passwordCipher'), false);
});

test('계정을 추가하고 비밀번호를 복호화한다', () => {
  const store = makeStore();
  const created = store.add({ label: '메인', naverId: 'myblog01', password: 'pw1234' });

  assert.equal(created.id, '메인');
  assert.equal(created.hasPassword, true);
  assert.equal(store.readPassword('메인'), 'pw1234');
  assert.equal(store.list().length, 1);
});

test('저장된 파일에 평문 비밀번호가 없다', () => {
  const store = makeStore();
  store.add({ label: '메인', naverId: 'id1', password: 'supersecret' });

  const dumped = JSON.stringify(store.list());
  assert.equal(dumped.includes('supersecret'), false);
});

test('비밀번호 없이도 계정을 만들 수 있다', () => {
  const store = makeStore();
  const created = store.add({ label: '수동', naverId: 'id2' });

  assert.equal(created.hasPassword, false);
  assert.equal(store.readPassword('수동'), null);
});

test('안전 저장소가 없으면 비밀번호 저장을 거부한다', () => {
  const store = makeStore(fakeCrypto(false));

  assert.throws(() => store.add({ label: 'x', naverId: 'id3', password: 'pw' }), /안전 저장소/);
});

test('네이버 아이디가 비면 거부한다', () => {
  const store = makeStore();

  assert.throws(() => store.add({ label: 'x', naverId: '  ' }), /네이버 아이디/);
});

test('계정을 지운다', () => {
  const store = makeStore();
  store.add({ label: 'a', naverId: 'id1' });
  store.add({ label: 'b', naverId: 'id2' });

  assert.equal(store.remove('a').length, 1);
  assert.equal(store.find('a'), null);
});

test('비밀번호를 바꿔도 id 가 그대로다', () => {
  // remove + add 로 흉내내면 slug 규칙 때문에 id 가 -2 로 밀리고 프로필 파티션이 갈린다.
  const store = makeStore();
  const created = store.add({ label: 'qwzx16', naverId: 'qwzx16', password: 'old' });

  const updated = store.updatePassword(created.id, 'new-pass');

  assert.equal(updated?.id, created.id);
  assert.equal(updated?.hasPassword, true);
  assert.equal(store.readPassword(created.id), 'new-pass');
  assert.equal(store.list().length, 1);
});

test('비밀번호를 바꿔도 라벨과 아이디는 안 건드린다', () => {
  const store = makeStore();
  store.add({ label: '메인 계정', naverId: 'myblog01', password: 'old' });

  const updated = store.updatePassword('메인-계정', 'new');

  assert.equal(updated?.label, '메인 계정');
  assert.equal(updated?.naverId, 'myblog01');
});

test('비밀번호가 없던 계정도 이걸로 채운다', () => {
  const store = makeStore();
  store.add({ label: '수동', naverId: 'id9' });

  assert.equal(store.updatePassword('수동', 'pw')?.hasPassword, true);
});

test('없는 계정이면 null 이다. 던지지 않는다', () => {
  const store = makeStore();

  assert.equal(store.updatePassword('없음', 'pw'), null);
});

test('빈 비밀번호와 안전 저장소 없음은 거부한다', () => {
  const store = makeStore();
  store.add({ label: 'a', naverId: 'id1' });

  assert.throws(() => store.updatePassword('a', ''), /비밀번호/);

  const noCrypto = makeStore(fakeCrypto(false));
  noCrypto.add({ label: 'a', naverId: 'id1' });

  assert.throws(() => noCrypto.updatePassword('a', 'pw'), /안전 저장소/);
});

test('바꾼 비밀번호도 파일에 평문으로 안 남는다', () => {
  const store = makeStore();
  const created = store.add({ label: '메인', naverId: 'id1', password: 'old' });
  store.updatePassword(created.id, 'brandnewsecret');

  assert.equal(JSON.stringify(store.list()).includes('brandnewsecret'), false);
});
