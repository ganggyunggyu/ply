import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isServiceUrl, normalizeServiceUrl, normalizeUrl } from './url';

test('스킴이 있으면 그대로 둔다', () => {
  assert.equal(normalizeUrl('https://naver.com/x'), 'https://naver.com/x');
  assert.equal(normalizeUrl('file:///tmp/a.html'), 'file:///tmp/a.html');
});

test('localhost 는 http 로 붙인다', () => {
  assert.equal(normalizeUrl('localhost:3007'), 'http://localhost:3007');
  assert.equal(normalizeUrl('127.0.0.1:8000/api'), 'http://127.0.0.1:8000/api');
});

test('도메인처럼 보이면 https 로 붙인다', () => {
  assert.equal(normalizeUrl('blog.naver.com'), 'https://blog.naver.com');
  assert.equal(normalizeUrl('naver.com/search?q=1'), 'https://naver.com/search?q=1');
});

test('그 외에는 검색어로 넘긴다', () => {
  assert.match(normalizeUrl('강아지 유치원'), /^https:\/\/www\.google\.com\/search\?q=/);
});

test('빈 입력은 홈으로 간다', () => {
  assert.equal(normalizeUrl('   '), 'https://www.google.com');
});

test('서비스 주소는 앞뒤 공백과 끝 슬래시만 정리한다', () => {
  assert.equal(normalizeServiceUrl('  https://a.internal/  '), 'https://a.internal');
  assert.equal(normalizeServiceUrl('https://a.internal///'), 'https://a.internal');
  assert.equal(normalizeServiceUrl('http://localhost:4500/x'), 'http://localhost:4500/x');
  assert.equal(normalizeServiceUrl('   '), '');
});

test('서비스 주소는 http/https 만 통과시킨다', () => {
  assert.equal(isServiceUrl('https://a.internal'), true);
  assert.equal(isServiceUrl('http://localhost:4500'), true);
  assert.equal(isServiceUrl('a.internal'), false);
  assert.equal(isServiceUrl('ftp://a.internal'), false);
  assert.equal(isServiceUrl('file:///tmp/a.html'), false);
  assert.equal(isServiceUrl('ㅁㄴㅇㄹ'), false);
  assert.equal(isServiceUrl(''), false);
});
