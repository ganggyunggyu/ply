import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHAT, CONFIRM, ERRORS } from './messages';

test('바쁠 때의 문구가 하지 않는 약속을 하지 않는다', () => {
  // 큐가 없다. 거절된 메시지는 버려지므로 "이어서 할게요" 는 거짓이다.
  assert.equal(ERRORS.agentBusy.includes('이어서'), false);
  assert.equal(ERRORS.agentBusy.includes('대기열'), false);
  assert.equal(ERRORS.agentBusy.includes('예약'), false);
});

test('정지 결과 문구가 진행 중이던 작업을 숨기지 않는다', () => {
  // 도구 하나는 끝까지 돈다. "즉시 멈췄다" 로 읽히면 사용자가 결과를 확인하지 않는다.
  assert.ok(CHAT.cancelled.includes('끝까지'));
});

test('승인 토큰 두 개는 서로 다르다', () => {
  // 값이 겹치면 글 삭제 승인이 예약 취소 승인으로 샌다.
  assert.notEqual(CONFIRM.deleteYes, CONFIRM.cancelScheduleYes);
});
