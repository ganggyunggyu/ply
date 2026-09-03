import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXPOSURE_COOKIE_MAX_AGE_MS,
  EXPOSURE_COOKIE_NAME,
  describeExposureError,
  isExposureCookieExpired,
  isExposureUnauthorized,
  readSessionCookie,
} from './exposure-api';

const token = (issuedAt: number) => `${issuedAt}.member-1.c2lnbmF0dXJl`;

test('Set-Cookie 에서 세션 값만 뽑는다', () => {
  const headers = [
    'other=zzz; Path=/',
    `${EXPOSURE_COOKIE_NAME}=1756800000000.m1.sig; Path=/; HttpOnly; SameSite=Lax`,
  ];

  assert.equal(readSessionCookie(headers), '1756800000000.m1.sig');
});

test('이름이 다른 쿠키는 가져오지 않는다', () => {
  assert.equal(readSessionCookie(['session=abc; Path=/']), null);
  assert.equal(readSessionCookie([]), null);
  assert.equal(readSessionCookie(undefined), null);
});

test('앞 공백이 있어도 읽는다', () => {
  assert.equal(readSessionCookie([`  ${EXPOSURE_COOKIE_NAME}=v1; Path=/`]), 'v1');
});

test('값이 비면 없는 것으로 본다', () => {
  assert.equal(readSessionCookie([`${EXPOSURE_COOKIE_NAME}=; Path=/`]), null);
});

test('7일이 지나면 만료로 본다', () => {
  const now = 1_800_000_000_000;

  assert.equal(isExposureCookieExpired(token(now - 1000), now), false);
  assert.equal(isExposureCookieExpired(token(now - EXPOSURE_COOKIE_MAX_AGE_MS + 1000), now), false);
  assert.equal(isExposureCookieExpired(token(now - EXPOSURE_COOKIE_MAX_AGE_MS - 1), now), true);
});

test('미래 발급 시각도 만료로 본다', () => {
  const now = 1_800_000_000_000;

  assert.equal(isExposureCookieExpired(token(now + 1), now), true);
});

test('모양이 어긋난 토큰은 전부 만료다', () => {
  const now = 1_800_000_000_000;

  assert.equal(isExposureCookieExpired('', now), true);
  assert.equal(isExposureCookieExpired('a.b', now), true);
  assert.equal(isExposureCookieExpired('a.b.c.d', now), true);
  assert.equal(isExposureCookieExpired('notanumber.m1.sig', now), true);
  assert.equal(isExposureCookieExpired('..sig', now), true);
});

test('401 만 재로그인 신호다', () => {
  assert.equal(isExposureUnauthorized({ response: { status: 401 } }), true);
  assert.equal(isExposureUnauthorized({ response: { status: 403 } }), false);
  assert.equal(isExposureUnauthorized(new Error('boom')), false);
  assert.equal(isExposureUnauthorized(null), false);
});

test('대시보드가 쓴 한국어 문구를 그대로 꺼낸다', () => {
  // 이 문구는 대시보드가 사용자에게 보여주려고 쓴 것이다. axios 메시지로 덮으면 원인이 사라진다.
  const error = Object.assign(new Error('Request failed with status code 400'), {
    response: { status: 400, data: { error: '패키지: 읽기 시트 ID가 비어 있음' } },
  });

  assert.equal(describeExposureError(error), '패키지: 읽기 시트 ID가 비어 있음');
});

test('본문에 error 가 없으면 원래 메시지를 쓴다', () => {
  const error = Object.assign(new Error('boom'), { response: { status: 500, data: {} } });

  assert.equal(describeExposureError(error), 'boom');
  assert.equal(describeExposureError(new Error('그냥 에러')), '그냥 에러');
});
