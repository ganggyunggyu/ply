import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldFocusNewTab } from './tab-focus';

test('사용자가 연 탭은 바로 보여준다', () => {
  assert.equal(shouldFocusNewTab({ openedByAgent: false, hasActive: true }), true);
  assert.equal(shouldFocusNewTab({ openedByAgent: false, hasActive: false }), true);
});

test('에이전트가 연 탭은 화면을 뺏지 않는다', () => {
  assert.equal(shouldFocusNewTab({ openedByAgent: true, hasActive: true }), false);
});

test('보여줄 탭이 하나도 없으면 에이전트 탭이라도 띄운다', () => {
  // 첫 탭이 에이전트 탭인 경우. 안 띄우면 창이 빈 채로 남는다.
  assert.equal(shouldFocusNewTab({ openedByAgent: true, hasActive: false }), true);
});

test('보여주려고 연 탭은 에이전트 탭이라도 화면을 옮긴다', () => {
  assert.equal(shouldFocusNewTab({ openedByAgent: true, hasActive: true, focus: true }), true);
});

test('focus 를 안 주면 예전 판정 그대로다', () => {
  assert.equal(shouldFocusNewTab({ openedByAgent: true, hasActive: true, focus: false }), false);
});
