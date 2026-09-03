import assert from 'node:assert/strict';
import { test } from 'node:test';
import { descendantTabIds } from './tab-tree';

test('아무도 열지 않은 탭은 딸린 탭이 없다', () => {
  assert.deepEqual(descendantTabIds([{ id: 1 }, { id: 2 }], 1), []);
});

test('작업 탭이 띄운 팝업을 찾아낸다', () => {
  const tabs = [{ id: 1 }, { id: 2, openerId: 1 }, { id: 3 }];

  assert.deepEqual(descendantTabIds(tabs, 1), [2]);
});

test('팝업이 또 띄운 팝업까지 따라간다', () => {
  const tabs = [{ id: 1 }, { id: 2, openerId: 1 }, { id: 3, openerId: 2 }];

  assert.deepEqual(descendantTabIds(tabs, 1).sort(), [2, 3]);
});

test('순환이 생겨도 멈춘다', () => {
  // 실제로는 생기지 않지만, 여기서 무한 루프가 나면 탭을 닫는 동안 앱이 굳는다.
  const tabs = [
    { id: 1, openerId: 2 },
    { id: 2, openerId: 1 },
  ];

  assert.deepEqual(descendantTabIds(tabs, 1), [2]);
});
