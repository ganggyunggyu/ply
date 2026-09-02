import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { describeRequestError } from './openrouter';

const httpError = (status: number, message?: string) => {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: message ? { error: { message } } : {},
  };
  return error;
};

test('401 은 키 문제로 안내한다', () => {
  assert.match(describeRequestError(httpError(401), 'x'), /키가 맞지 않아요/);
  assert.match(describeRequestError(httpError(403), 'x'), /키가 맞지 않아요/);
});

test('402 는 잔액 부족으로 안내한다', () => {
  assert.match(describeRequestError(httpError(402), 'x'), /잔액이 부족/);
});

test('429 는 잠시 뒤로 안내한다', () => {
  assert.match(describeRequestError(httpError(429), 'x'), /너무 잦아요/);
});

test('404 는 모델 이름을 알려준다', () => {
  assert.match(describeRequestError(httpError(404), 'minimax/minimax-m2.5'), /minimax\/minimax-m2\.5/);
});

test('5xx 와 네트워크 실패를 구분한다', () => {
  assert.match(describeRequestError(httpError(503), 'x'), /응답하지 않아요/);
  assert.match(describeRequestError(new AxiosError('connect ECONNREFUSED'), 'x'), /연결하지 못했어요/);
});

test('축 오류가 아니면 원문을 유지한다', () => {
  assert.equal(describeRequestError(new Error('그냥 에러'), 'x'), '그냥 에러');
});
