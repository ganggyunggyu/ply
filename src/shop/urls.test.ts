import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBaseUrl, loginUrl, productUrl, adminLoginUrl } from './urls';

test('baseUrl 끝 슬래시를 떼서 이중 슬래시를 막는다', () => {
  assert.equal(normalizeBaseUrl('https://myshop.com/'), 'https://myshop.com');
  assert.equal(normalizeBaseUrl('https://myshop.com///'), 'https://myshop.com');
  assert.equal(normalizeBaseUrl('  https://myshop.com  '), 'https://myshop.com');
});

test('로그인 경로는 Cafe24 표준 member/login.html 이다', () => {
  assert.equal(loginUrl('https://myshop.com/'), 'https://myshop.com/member/login.html');
});

test('상품 상세는 product_no 쿼리로 연다', () => {
  assert.equal(productUrl('https://myshop.com', 128), 'https://myshop.com/product/detail.html?product_no=128');
});

test('관리자 로그인은 몰과 무관한 Cafe24 공용 주소다', () => {
  assert.equal(adminLoginUrl(), 'https://eclogin.cafe24.com/Shop/');
});
