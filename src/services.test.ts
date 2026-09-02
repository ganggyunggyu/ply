import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyServiceUrls, catalogSummary, findService, resolveServices, SERVICE_CATALOG } from './services';

test('모든 항목이 https 주소를 가진다', () => {
  SERVICE_CATALOG.forEach(({ url, key }) => {
    assert.match(url, /^https:\/\//, `${key} 주소가 https 가 아님`);
  });
});

test('key 가 겹치지 않는다', () => {
  const keys = SERVICE_CATALOG.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
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

test('요약에 모든 주소가 들어간다', () => {
  const summary = catalogSummary();
  SERVICE_CATALOG.forEach(({ url }) => assert.ok(summary.includes(url)));
});

test('resolveServices 는 카탈로그를 변이시키지 않는다', () => {
  const before = SERVICE_CATALOG.map(({ url }) => url);
  const resolved = resolveServices({ 'cafe-bot': 'https://cafe.internal' });

  assert.equal(resolved.find((s) => s.key === 'cafe-bot')?.url, 'https://cafe.internal');
  assert.equal(resolved.find((s) => s.key === 'cafe-bot')?.custom, true);
  assert.deepEqual(SERVICE_CATALOG.map(({ url }) => url), before);
});

test('applyServiceUrls 는 왕복 가능하다', (t) => {
  const before = SERVICE_CATALOG.map(({ url }) => url);
  t.after(() => applyServiceUrls({}));

  applyServiceUrls({ 'cafe-bot': 'https://cafe.internal' });
  assert.equal(SERVICE_CATALOG.find((s) => s.key === 'cafe-bot')?.url, 'https://cafe.internal');

  applyServiceUrls({});
  assert.deepEqual(SERVICE_CATALOG.map(({ url }) => url), before);
});
