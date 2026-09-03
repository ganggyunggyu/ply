import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toKstDate, toKstMinutes } from './clock';

test('UTC 15:00 은 KST 로 다음 날이다', () => {
  assert.equal(toKstDate(new Date('2026-09-02T15:00:00Z')), '2026-09-03');
});

test('UTC 14:59 은 아직 같은 날이다', () => {
  assert.equal(toKstDate(new Date('2026-09-02T14:59:59Z')), '2026-09-02');
});

test('연말 경계도 KST 로 넘어간다', () => {
  assert.equal(toKstDate(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
});

test('KST 자정은 0분이다', () => {
  assert.equal(toKstMinutes(new Date('2026-09-02T15:00:00Z')), 0);
});

test('UTC 06:30 은 KST 15시 30분이다', () => {
  assert.equal(toKstMinutes(new Date('2026-09-02T06:30:00Z')), 15 * 60 + 30);
});

test('KST 23시 59분이 하루의 마지막 분이다', () => {
  assert.equal(toKstMinutes(new Date('2026-09-02T14:59:00Z')), 23 * 60 + 59);
});
