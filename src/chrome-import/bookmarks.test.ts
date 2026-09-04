import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBookmarksJson } from './bookmarks';

test('폴더를 재귀로 훑어 url 노드만 평평하게 뽑는다', () => {
  const raw = JSON.stringify({
    roots: {
      bookmark_bar: {
        type: 'folder',
        children: [
          { type: 'url', name: '네이버', url: 'https://naver.com' },
          {
            type: 'folder',
            name: '개발',
            children: [{ type: 'url', name: 'GitHub', url: 'https://github.com' }],
          },
        ],
      },
      other: { type: 'folder', children: [{ type: 'url', name: '구글', url: 'https://google.com' }] },
    },
  });

  assert.deepEqual(
    parseBookmarksJson(raw).map((b) => b.url),
    ['https://naver.com', 'https://github.com', 'https://google.com'],
  );
});

test('javascript: 같은 비 http 스킴은 뺀다', () => {
  const raw = JSON.stringify({
    roots: { bookmark_bar: { children: [{ type: 'url', name: 'x', url: 'javascript:void(0)' }] } },
  });

  assert.equal(parseBookmarksJson(raw).length, 0);
});

test('이름이 비면 url 을 이름으로 쓴다', () => {
  const raw = JSON.stringify({
    roots: { bookmark_bar: { children: [{ type: 'url', name: '', url: 'https://a.com' }] } },
  });

  assert.equal(parseBookmarksJson(raw)[0]?.name, 'https://a.com');
});

test('깨진 JSON 은 빈 배열로 넘어간다', () => {
  assert.deepEqual(parseBookmarksJson('{not json'), []);
});
