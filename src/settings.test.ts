import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { SecretCrypto } from './accounts';
import { DEFAULT_AGENT_MODEL, DEFAULT_WRITER_MODEL } from './models';
import { DEFAULT_ENDPOINTS } from './hub';
import { createSettingsStore } from './settings';

const crypto = (available = true): SecretCrypto => ({
  isAvailable: () => available,
  encrypt: (plainText) => `enc:${Buffer.from(plainText).toString('base64')}`,
  decrypt: (cipherText) => Buffer.from(cipherText.slice(4), 'base64').toString('utf-8'),
});

const dirs: string[] = [];

const makeStore = (secret: SecretCrypto = crypto()) => {
  const dir = mkdtempSync(join(tmpdir(), 'gng-settings-'));
  dirs.push(dir);
  const filePath = join(dir, 'settings.json');
  return { store: createSettingsStore({ filePath, crypto: secret }), filePath };
};

after(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

test('기본 모델이 채워진다', () => {
  const { store } = makeStore();
  const settings = store.get();

  assert.equal(settings.hasApiKey, false);
  assert.equal(settings.agentModel, DEFAULT_AGENT_MODEL);
  assert.equal(settings.writerModel, DEFAULT_WRITER_MODEL);
});

test('API 키는 암호화해서 저장하고 공개 형태로는 안 내보낸다', () => {
  const { store, filePath } = makeStore();
  const settings = store.setApiKey('sk-or-v1-secret');

  assert.equal(settings.hasApiKey, true);
  assert.equal(Object.hasOwn(settings, 'apiKey'), false);
  assert.equal(readFileSync(filePath, 'utf-8').includes('sk-or-v1-secret'), false);
  assert.equal(store.readApiKey(), 'sk-or-v1-secret');
});

test('빈 문자열로 키를 지운다', () => {
  const { store } = makeStore();
  store.setApiKey('sk-or-v1-secret');

  assert.equal(store.setApiKey('   ').hasApiKey, false);
  assert.equal(store.readApiKey(), null);
});

test('안전 저장소가 없으면 키 저장을 거부한다', () => {
  const { store } = makeStore(crypto(false));

  assert.throws(() => store.setApiKey('sk-or-v1-secret'), /안전 저장소/);
});

test('엔드포인트 기본값은 비어 있는 노출지기 경로를 준다', () => {
  const { store } = makeStore();
  const { endpoints } = store.get();

  assert.equal(endpoints.exposureBotDir, '');
  assert.equal(endpoints.dabutBaseUrl, DEFAULT_ENDPOINTS.dabutBaseUrl);
  assert.match(endpoints.dabutBaseUrl, /^https?:\/\//);
});

test('엔드포인트를 저장하고 다시 읽는다', () => {
  const { store } = makeStore();
  store.setApiKey('sk-or-v1-secret');
  const settings = store.setEndpoints({ exposureBotDir: '/tmp/bot' });

  assert.equal(settings.endpoints.exposureBotDir, '/tmp/bot');
  assert.equal(settings.endpoints.schedulerBaseUrl, DEFAULT_ENDPOINTS.schedulerBaseUrl);
  assert.equal(store.readApiKey(), 'sk-or-v1-secret');
  assert.equal(store.readEndpoints().exposureBotDir, '/tmp/bot');
});

test('스케줄러 토큰은 암호화해서 저장하고 비밀번호는 안 남긴다', () => {
  const { store, filePath } = makeStore();
  const settings = store.setSchedulerToken('jwt-token-value', '테스트계정');

  assert.equal(settings.hasSchedulerToken, true);
  assert.equal(settings.schedulerLabel, '테스트계정');
  assert.equal(Object.hasOwn(settings, 'schedulerToken'), false);
  assert.equal(readFileSync(filePath, 'utf-8').includes('jwt-token-value'), false);
  assert.equal(store.readSchedulerToken(), 'jwt-token-value');
});

test('스케줄러 로그아웃하면 토큰이 사라진다', () => {
  const { store } = makeStore();
  store.setSchedulerToken('jwt', 'x');

  assert.equal(store.setSchedulerToken('', '').hasSchedulerToken, false);
  assert.equal(store.readSchedulerToken(), null);
});

test('모델만 바꿔도 키가 남아있다', () => {
  const { store } = makeStore();
  store.setApiKey('sk-or-v1-secret');
  const settings = store.setModels({ agentModel: 'z-ai/glm-4.7' });

  assert.equal(settings.agentModel, 'z-ai/glm-4.7');
  assert.equal(settings.writerModel, DEFAULT_WRITER_MODEL);
  assert.equal(store.readApiKey(), 'sk-or-v1-secret');
});
