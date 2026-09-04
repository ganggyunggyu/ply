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
  assert.equal(findService('이미지 생성기')?.key, 'image-generator');
});

test('모르는 이름은 null', () => {
  assert.equal(findService('없는서비스'), null);
  assert.equal(findService('  '), null);
});

test('주소를 안 넣어도 코드 기본값으로 열 수 있다', (t) => {
  // 설정 화면에 서비스 주소 칸이 없다. 오버라이드가 있어야 설정된 것으로 치면 아무것도 못 연다.
  withOverrides({}, t);

  assert.equal(configuredServices().length, SERVICE_CATALOG.length);
  assert.ok(catalogSummary().includes('https://'));
  SERVICE_CATALOG.forEach(({ key }) => assert.equal(isServiceConfigured(key), true));
});

test('요약에는 사용자가 넣은 주소가 기본값을 이긴다', (t) => {
  withOverrides({ 'image-generator': 'https://image.internal' }, t);

  const summary = catalogSummary();

  assert.ok(summary.includes('https://image.internal'));
  assert.equal(summary.includes('example.com'), false);
  assert.equal(isServiceConfigured('image-generator'), true);
  assert.equal(isServiceConfigured('sheet-app'), true);
});

test('주소를 지우면 코드 기본값으로 돌아간다', (t) => {
  const [first] = SERVICE_CATALOG;
  const fallback = first?.url ?? '';

  withOverrides({ 'image-generator': 'https://image.internal' }, t);
  applyServiceUrls({});

  assert.equal(isServiceConfigured('image-generator'), true);
  assert.notEqual(
    SERVICE_CATALOG.find((service) => service.key === 'image-generator')?.url,
    'https://image.internal',
  );
  assert.equal(SERVICE_CATALOG[0]?.url, fallback);
});

test('resolveServices 는 카탈로그를 변이시키지 않는다', () => {
  const before = SERVICE_CATALOG.map(({ url }) => url);
  const resolved = resolveServices({ 'image-generator': 'https://image.internal' });

  assert.equal(resolved.find((s) => s.key === 'image-generator')?.url, 'https://image.internal');
  assert.equal(resolved.find((s) => s.key === 'image-generator')?.custom, true);
  assert.deepEqual(SERVICE_CATALOG.map(({ url }) => url), before);
});

test('applyServiceUrls 는 왕복 가능하다', (t) => {
  const before = SERVICE_CATALOG.map(({ url }) => url);
  t.after(() => applyServiceUrls({}));

  applyServiceUrls({ 'image-generator': 'https://image.internal' });
  assert.equal(SERVICE_CATALOG.find((s) => s.key === 'image-generator')?.url, 'https://image.internal');

  applyServiceUrls({});
  assert.deepEqual(SERVICE_CATALOG.map(({ url }) => url), before);
});
