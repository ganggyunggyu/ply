import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyServiceUrls,
  catalogSummary,
  configuredServices,
  findService,
  isServiceConfigured,
  resolveServices,
  SERVICE_CATALOG,
} from './services';

/** 전역 카탈로그를 만지는 테스트는 전부 이걸로 원복한다. */
const withOverrides = (overrides: Record<string, string>, t: { after: (fn: () => void) => void }) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls(overrides);
};

test('모든 항목이 https 주소를 가진다', () => {
  SERVICE_CATALOG.forEach(({ url, key }) => {
    assert.match(url, /^https:\/\//, `${key} 주소가 https 가 아님`);
  });
});

test('key 가 겹치지 않는다', () => {
  const keys = SERVICE_CATALOG.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('도구가 부르는 API 서버는 카탈로그에 없다', () => {
  const keys = SERVICE_CATALOG.map((s) => s.key);

  assert.equal(keys.includes('dabut-api'), false);
  assert.equal(keys.includes('scheduler-api'), false);
});

test('이름으로 찾는다', () => {
  assert.equal(findService('노출지기')?.key, 'exposure-dashboard');
  assert.equal(findService('노출지기 대시보드')?.key, 'exposure-dashboard');
  assert.equal(findService('exposure-dashboard')?.key, 'exposure-dashboard');
  assert.equal(findService('카페봇')?.key, 'cafe-bot');
});

test('모르는 이름은 null', () => {
  assert.equal(findService('없는서비스'), null);
  assert.equal(findService('  '), null);
});

test('주소를 안 넣으면 아무것도 설정되지 않은 상태다', (t) => {
  withOverrides({}, t);

  assert.deepEqual(configuredServices(), []);
  assert.equal(catalogSummary(), '');
  SERVICE_CATALOG.forEach(({ key }) => assert.equal(isServiceConfigured(key), false));
});

test('요약에는 주소를 넣은 서비스만 들어간다', (t) => {
  withOverrides({ 'cafe-bot': 'https://cafe.internal' }, t);

  const summary = catalogSummary();

  assert.ok(summary.includes('https://cafe.internal'));
  assert.equal(summary.includes('example.com'), false);
  assert.deepEqual(configuredServices().map(({ key }) => key), ['cafe-bot']);
  assert.equal(isServiceConfigured('cafe-bot'), true);
  assert.equal(isServiceConfigured('sheet-app'), false);
});

test('주소를 지우면 다시 미설정으로 돌아간다', (t) => {
  withOverrides({ 'cafe-bot': 'https://cafe.internal' }, t);

  applyServiceUrls({});

  assert.equal(isServiceConfigured('cafe-bot'), false);
  assert.deepEqual(configuredServices(), []);
});

test('resolveServices 는 카탈로그를 변이시키지 않는다', () => {
  const before = SERVICE_CATALOG.map(({ url }) => url);
  const resolved = resolveServices({ 'cafe-bot': 'https://cafe.internal' });

  assert.equal(resolved.find((s) => s.key === 'cafe-bot')?.url, 'https://cafe.internal');
  assert.equal(resolved.find((s) => s.key === 'cafe-bot')?.custom, true);
  assert.deepEqual(SERVICE_CATALOG.map(({ url }) => url), before);
  assert.equal(isServiceConfigured('cafe-bot'), false);
});

test('applyServiceUrls 는 왕복 가능하다', (t) => {
  const before = SERVICE_CATALOG.map(({ url }) => url);
  t.after(() => applyServiceUrls({}));

  applyServiceUrls({ 'cafe-bot': 'https://cafe.internal' });
  assert.equal(SERVICE_CATALOG.find((s) => s.key === 'cafe-bot')?.url, 'https://cafe.internal');

  applyServiceUrls({});
  assert.deepEqual(SERVICE_CATALOG.map(({ url }) => url), before);
});
