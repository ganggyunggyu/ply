import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webkitToUnixMs } from './webkit-time';

test('WebKit epoch 를 Unix ms 로 옮긴다', () => {
  // 2021-01-01T00:00:00Z = Unix 1609459200000ms.
  // WebKit(1601 기준 마이크로초) = (1609459200 + 11644473600) * 1_000_000.
  const webkit = (1609459200 + 11644473600) * 1_000_000;
  assert.equal(webkitToUnixMs(webkit), 1609459200000);
});

test('0 은 방문 시각 없음이라 0 으로 둔다', () => {
  assert.equal(webkitToUnixMs(0), 0);
});

test('음수도 0 으로 막는다', () => {
  assert.equal(webkitToUnixMs(-5), 0);
});

test('WebKit epoch 시작점(0 마이크로초)은 1601 이므로 음수 ms 가 되지 않고 0 으로 막힌다', () => {
  assert.equal(webkitToUnixMs(11644473600 * 1_000_000), 0);
});
