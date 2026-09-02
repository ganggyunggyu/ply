import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServiceCatalogItemView } from './bridge';
import { collectServiceUrls, connectionStates, cookieLoginServices } from './service-form';

const item = (over: Partial<ServiceCatalogItemView> & { key: string }): ServiceCatalogItemView => ({
  name: over.key,
  url: `https://${over.key}.example.com`,
  defaultUrl: `https://${over.key}.example.com`,
  custom: false,
  kind: 'ui',
  auth: 'cookie',
  description: '',
  ...over,
});

test('빈 칸은 지우기 신호로 그대로 실린다', () => {
  const { next, invalid } = collectServiceUrls([
    { key: 'a', name: 'A', raw: '   ' },
    { key: 'b', name: 'B', raw: 'https://b.internal' },
  ]);

  assert.deepEqual(invalid, []);
  assert.deepEqual(next, { a: '', b: 'https://b.internal' });
});

test('끝 슬래시와 공백을 정리해서 되비춘다', () => {
  const { normalized } = collectServiceUrls([{ key: 'a', name: 'A', raw: '  https://a.internal//  ' }]);

  assert.equal(normalized['a'], 'https://a.internal');
});

test('스킴이 틀린 칸은 저장 대상에서 빠지고 이름이 남는다', () => {
  const { next, invalid } = collectServiceUrls([
    { key: 'a', name: '노출지기', raw: 'exposure.internal' },
    { key: 'b', name: '카페봇', raw: 'javascript:alert(1)' },
    { key: 'c', name: '시트앱', raw: 'https://sheet.internal' },
  ]);

  assert.deepEqual(invalid, [
    { key: 'a', name: '노출지기' },
    { key: 'b', name: '카페봇' },
  ]);
  assert.deepEqual(next, { c: 'https://sheet.internal' });
});

test('주소를 넣은 쿠키 서비스만 로그인 칩이 된다', () => {
  const chips = cookieLoginServices([
    item({ key: 'set', custom: true }),
    item({ key: 'unset' }),
    item({ key: 'api', custom: true, kind: 'api' }),
    item({ key: 'open', custom: true, auth: 'none' }),
  ]);

  assert.deepEqual(chips.map(({ key }) => key), ['set']);
});

test('칩은 서비스 주소와 노출지기 경로를 함께 센다', () => {
  const states = connectionStates(
    [item({ key: 'a', custom: true }), item({ key: 'b' })],
    '/tmp/bot',
  );

  assert.equal(states.length, 3);
  assert.deepEqual(states.map(({ ok }) => ok), [true, false, true]);
  assert.equal(states.filter(({ ok }) => ok).length, 2);
});

test('노출지기 경로가 공백뿐이면 안 센다', () => {
  const [dot] = connectionStates([], '   ');

  assert.equal(dot?.ok, false);
});
