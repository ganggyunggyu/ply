import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { SecretCrypto } from './accounts';
import { DEFAULT_AGENT_MODEL, DEFAULT_WRITER_MODEL } from './models';
import { DEFAULT_ENDPOINTS } from './hub';
import { resolveServices, SERVICE_CATALOG } from './services';
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
  return { store: createSettingsStore({ filePath, crypto: secret }), filePath, dir };
};

const writeLegacy = (dir: string, body: string) => {
  const legacyPath = join(dir, 'services.json');
  writeFileSync(legacyPath, body, 'utf-8');

  return legacyPath;
};

/** 카탈로그 전역이 아니라 순수 해석 함수에서 기본값을 얻는다. 이 파일은 전역을 건드리지 않는다. */
const DEFAULTS = resolveServices({});

const defaultUrlOf = (key: string) => DEFAULTS.find((s) => s.key === key)?.defaultUrl ?? '';

const urlOf = (services: { key: string; url: string }[], key: string) =>
  services.find((s) => s.key === key)?.url ?? '';

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

test('서비스 주소 기본값은 빈 오버라이드와 코드 주소를 준다', () => {
  const { store } = makeStore();
  const { serviceUrls, services } = store.get();

  assert.deepEqual(serviceUrls, {});
  assert.equal(services.length, SERVICE_CATALOG.length);
  services.forEach(({ key, url, custom }) => {
    assert.equal(url, defaultUrlOf(key));
    assert.equal(custom, false);
  });
});

test('서비스 주소를 저장하면 해석된 카탈로그에 반영된다', () => {
  const { store } = makeStore();
  const { serviceUrls, services } = store.setServiceUrls({ 'cafe-bot': 'https://cafe.internal' });

  assert.equal(serviceUrls['cafe-bot'], 'https://cafe.internal');
  assert.equal(urlOf(services, 'cafe-bot'), 'https://cafe.internal');
  assert.equal(services.find((s) => s.key === 'cafe-bot')?.custom, true);

  services
    .filter(({ key }) => key !== 'cafe-bot')
    .forEach(({ key, url }) => assert.equal(url, defaultUrlOf(key)));

  assert.deepEqual(store.readServiceUrls(), { 'cafe-bot': 'https://cafe.internal' });
});

test('서비스 주소를 부분 저장해도 병합되고 다른 설정을 건드리지 않는다', () => {
  const { store } = makeStore();
  store.setApiKey('sk-or-v1-secret');
  store.setServiceUrls({ 'cafe-bot': 'https://cafe.internal' });

  const { serviceUrls, endpoints } = store.setServiceUrls({ 'sheet-app': 'https://sheet.internal' });

  assert.equal(serviceUrls['cafe-bot'], 'https://cafe.internal');
  assert.equal(serviceUrls['sheet-app'], 'https://sheet.internal');
  assert.equal(store.readApiKey(), 'sk-or-v1-secret');
  assert.deepEqual(endpoints, DEFAULT_ENDPOINTS);
});

test('빈 값은 오버라이드를 지우고 기본값으로 되돌린다', () => {
  const { store } = makeStore();
  store.setServiceUrls({ 'cafe-bot': 'https://cafe.internal' });

  const { serviceUrls, services } = store.setServiceUrls({ 'cafe-bot': '   ' });

  assert.equal(Object.hasOwn(serviceUrls, 'cafe-bot'), false);
  assert.equal(urlOf(services, 'cafe-bot'), defaultUrlOf('cafe-bot'));
  assert.deepEqual(serviceUrls, {});
});

test('모르는 서비스 key 는 저장하지 않는다', () => {
  const { store } = makeStore();
  const { serviceUrls, services } = store.setServiceUrls({ 'nope-service': 'https://x.internal' });

  assert.equal(Object.hasOwn(serviceUrls, 'nope-service'), false);
  assert.equal(services.length, SERVICE_CATALOG.length);
});

test('예전 services.json 을 설정으로 옮기고 파일은 남긴다', () => {
  const { store, dir, filePath } = makeStore();
  const legacyPath = writeLegacy(dir, JSON.stringify({ 'cafe-bot': 'https://legacy.internal' }));

  const { serviceUrls, services } = store.migrateServiceUrls(legacyPath);

  assert.equal(serviceUrls['cafe-bot'], 'https://legacy.internal');
  assert.equal(urlOf(services, 'cafe-bot'), 'https://legacy.internal');
  assert.equal(existsSync(legacyPath), true);
  assert.equal(readFileSync(filePath, 'utf-8').includes('https://legacy.internal'), true);
  assert.equal(store.get().serviceUrls['cafe-bot'], 'https://legacy.internal');
});

test('이미 저장된 주소가 있으면 이관하지 않는다', () => {
  const { store, dir } = makeStore();
  store.setServiceUrls({ 'cafe-bot': 'https://mine.internal' });
  const legacyPath = writeLegacy(dir, JSON.stringify({ 'cafe-bot': 'https://legacy.internal' }));

  assert.equal(store.migrateServiceUrls(legacyPath).serviceUrls['cafe-bot'], 'https://mine.internal');
});

test('전부 지운 뒤에도 예전 파일을 다시 읽지 않는다', () => {
  const { store, dir } = makeStore();
  const legacyPath = writeLegacy(dir, JSON.stringify({ 'cafe-bot': 'https://legacy.internal' }));
  store.migrateServiceUrls(legacyPath);
  store.setServiceUrls({ 'cafe-bot': '' });

  assert.deepEqual(store.migrateServiceUrls(legacyPath).serviceUrls, {});
});

test('깨진 예전 파일은 던지지 않고 다음 기회를 남긴다', () => {
  const { store, dir, filePath } = makeStore();
  const legacyPath = writeLegacy(dir, '{oops');

  assert.deepEqual(store.migrateServiceUrls(legacyPath).serviceUrls, {});
  assert.equal(existsSync(filePath) && readFileSync(filePath, 'utf-8').includes('serviceUrls'), false);
});

test('스킴이 없는 주소는 저장하지 않는다', () => {
  const { store } = makeStore();
  const { serviceUrls, services } = store.setServiceUrls({
    'cafe-bot': 'javascript:alert(1)',
    'sheet-app': 'cafe.internal',
    'dabut-app': 'https://dabut.internal/',
  });

  assert.equal(Object.hasOwn(serviceUrls, 'cafe-bot'), false);
  assert.equal(Object.hasOwn(serviceUrls, 'sheet-app'), false);
  assert.equal(serviceUrls['dabut-app'], 'https://dabut.internal');
  assert.equal(urlOf(services, 'cafe-bot'), defaultUrlOf('cafe-bot'));
});

test('예전 파일의 API 주소는 카탈로그가 아니라 endpoints 빈칸을 채운다', () => {
  const { store, dir } = makeStore();
  const legacyPath = writeLegacy(
    dir,
    JSON.stringify({
      'cafe-bot': 'https://cafe.internal',
      'dabut-api': 'https://api.internal',
      'scheduler-api': 'https://sch.internal',
    }),
  );

  const { serviceUrls, endpoints } = store.migrateServiceUrls(legacyPath);

  assert.equal(Object.hasOwn(serviceUrls, 'dabut-api'), false);
  assert.equal(Object.hasOwn(serviceUrls, 'scheduler-api'), false);
  assert.equal(endpoints.dabutBaseUrl, 'https://api.internal');
  assert.equal(endpoints.schedulerBaseUrl, 'https://sch.internal');
  assert.equal(endpoints.exposureBotDir, '');
});

test('이미 저장된 endpoints 는 예전 파일이 덮지 않는다', () => {
  const { store, dir } = makeStore();
  store.setEndpoints({ dabutBaseUrl: 'https://mine.internal' });
  const legacyPath = writeLegacy(dir, JSON.stringify({ 'dabut-api': 'https://legacy.internal' }));

  assert.equal(store.migrateServiceUrls(legacyPath).endpoints.dabutBaseUrl, 'https://mine.internal');
});

test('이관이 비밀값을 날리지 않는다', () => {
  const { store, dir } = makeStore();
  store.setApiKey('sk-or-v1-secret');
  store.setSchedulerToken('jwt-token-value', '테스트계정');
  const legacyPath = writeLegacy(dir, JSON.stringify({ 'cafe-bot': 'https://legacy.internal' }));

  store.migrateServiceUrls(legacyPath);

  assert.equal(store.readApiKey(), 'sk-or-v1-secret');
  assert.equal(store.readSchedulerToken(), 'jwt-token-value');
});
