import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createHistoryStore } from './history';

const dirs: string[] = [];
const makeStore = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ply-histstore-'));
  dirs.push(dir);
  return createHistoryStore({ filePath: join(dir, 'history.json') });
};

const visit = (url: string, lastVisit: number, title = url) => ({ url, title, visitCount: 1, lastVisit });

after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

test('최근 방문순으로 저장한다', () => {
  const store = makeStore();
  store.merge([visit('https://a.com', 100), visit('https://b.com', 300), visit('https://c.com', 200)]);

  assert.deepEqual(
    store.list().map((v) => v.url),
    ['https://b.com', 'https://c.com', 'https://a.com'],
  );
});

test('같은 url 은 더 최근 방문 시각을 남긴다', () => {
  const store = makeStore();
  store.merge([visit('https://a.com', 100)]);
  store.merge([visit('https://a.com', 500)]);

  const rows = store.list();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.lastVisit, 500);
});
