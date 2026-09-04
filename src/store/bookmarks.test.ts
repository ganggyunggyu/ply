import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createBookmarkStore } from './bookmarks';

const dirs: string[] = [];
const makeStore = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ply-bmstore-'));
  dirs.push(dir);
  return createBookmarkStore({ filePath: join(dir, 'bookmarks.json') });
};

after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

test('처음엔 비어 있다', () => {
  assert.deepEqual(makeStore().list(), []);
});

test('merge 는 새로 추가된 수를 돌려준다', () => {
  const store = makeStore();
  assert.equal(store.merge([{ name: 'a', url: 'https://a.com' }]), 1);
  assert.equal(store.list().length, 1);
});

test('url 이 겹치면 중복으로 안 쌓는다', () => {
  const store = makeStore();
  store.merge([{ name: 'a', url: 'https://a.com' }]);
  const added = store.merge([
    { name: 'a-again', url: 'https://a.com' },
    { name: 'b', url: 'https://b.com' },
  ]);

  assert.equal(added, 1);
  assert.equal(store.list().length, 2);
});
