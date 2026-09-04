import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeNickname, toArticleUrl, toCafeSlug, toMobileCafeHomeUrl, toPcCafeHomeUrl } from './urls';

test('슬러그 주소에서 슬러그만 뽑는다', () => {
  assert.equal(toCafeSlug('https://cafe.naver.com/steamindiegame'), 'steamindiegame');
  assert.equal(toCafeSlug('https://cafe.naver.com/steamindiegame/12345'), 'steamindiegame');
  assert.equal(toCafeSlug('steamindiegame'), 'steamindiegame');
});

test('ca-fe 는 슬러그가 아니라 숫자 id 경로의 접두사다', () => {
  // 이걸 슬러그로 쓰면 cafe.naver.com/ca-fe 라는 없는 카페로 간다.
  assert.equal(toCafeSlug('https://cafe.naver.com/ca-fe/cafes/31750099'), undefined);
  assert.equal(toCafeSlug(''), undefined);
  assert.equal(toCafeSlug(undefined), undefined);
});

test('슬러그가 없으면 숫자 id 경로로 간다', () => {
  assert.equal(toPcCafeHomeUrl({ cafeId: '31750099' }), 'https://cafe.naver.com/ca-fe/cafes/31750099');
  assert.equal(
    toMobileCafeHomeUrl({ cafeId: '31750099' }),
    'https://m.cafe.naver.com/ca-fe/web/cafes/31750099',
  );
});

test('슬러그가 있으면 그쪽을 쓴다', () => {
  const target = { cafeId: '31750099', cafeUrl: 'https://cafe.naver.com/mealtalkdht' };

  assert.equal(toPcCafeHomeUrl(target), 'https://cafe.naver.com/mealtalkdht');
  assert.equal(toMobileCafeHomeUrl(target), 'https://m.cafe.naver.com/mealtalkdht');
  assert.equal(toArticleUrl(target, 42), 'https://cafe.naver.com/mealtalkdht/42');
});

test('글 주소도 슬러그가 없으면 숫자 id 경로를 쓴다', () => {
  assert.equal(
    toArticleUrl({ cafeId: '31750099' }, '42'),
    'https://cafe.naver.com/ca-fe/cafes/31750099/articles/42',
  );
});

test('별명은 한글과 영숫자만 남기고 20자에서 자른다', () => {
  assert.equal(sanitizeNickname('돌쇠 냥이!!'), '돌쇠냥이');
  assert.equal(sanitizeNickname('가'.repeat(30)).length, 20);
});

test('별명이 통째로 걸러지면 대체값을 쓴다', () => {
  // 특수문자만 준 경우다. 빈 문자열을 넣으면 폼이 되돌려보낸다.
  assert.equal(sanitizeNickname('!!!', 'myblog01'), 'myblog01');
  assert.equal(sanitizeNickname('!!!', '!!!'), '회원');
});
