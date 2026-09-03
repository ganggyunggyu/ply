import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addUsage,
  EMPTY_USAGE,
  formatCost,
  formatTokenCount,
  totalTokens,
  usageCost,
} from './usage';

test('usage 는 호출마다 쌓인다', () => {
  const first = addUsage(EMPTY_USAGE, { promptTokens: 1200, completionTokens: 300 });
  const second = addUsage(first, { promptTokens: 800, completionTokens: 200 });

  assert.deepEqual(second, { promptTokens: 2000, completionTokens: 500 });
  assert.equal(totalTokens(second), 2500);
});

test('이상한 값은 0 으로 본다', () => {
  const total = addUsage(EMPTY_USAGE, { promptTokens: Number.NaN, completionTokens: -5 });

  assert.deepEqual(total, { promptTokens: 0, completionTokens: 0 });
});

test('누적은 원본을 건드리지 않는다', () => {
  addUsage(EMPTY_USAGE, { promptTokens: 10, completionTokens: 10 });

  assert.deepEqual(EMPTY_USAGE, { promptTokens: 0, completionTokens: 0 });
});

test('비용은 입출력 단가를 따로 매긴다', () => {
  const cost = usageCost(
    { promptTokens: 1_000_000, completionTokens: 1_000_000 },
    { inputPerMillion: 0.075, outputPerMillion: 0.25 },
  );

  assert.equal(cost, 0.325);
});

test('모델을 모르면 비용을 만들지 않는다', () => {
  assert.equal(usageCost({ promptTokens: 1000, completionTokens: 1000 }), null);
});

test('토큰 수는 칩 너비에 맞게 줄인다', () => {
  assert.equal(formatTokenCount(0), '0');
  assert.equal(formatTokenCount(999), '999');
  assert.equal(formatTokenCount(1500), '1.5k');
  assert.equal(formatTokenCount(2_500_000), '2.50M');
});

test('비용은 1센트 아래에서 자리수를 더 준다', () => {
  assert.equal(formatCost(0.0032), '0.0032');
  assert.equal(formatCost(1.234), '1.23');
});
