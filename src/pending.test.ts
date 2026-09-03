import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPendingRegistry, type PendingTimer } from './pending';

/** 타이머를 손으로 돌린다. 10분을 실제로 기다리지 않고 만료 경로를 본다. */
const createFakeTimers = () => {
  const fired: (() => void)[] = [];
  const cleared: PendingTimer[] = [];

  return {
    fired,
    cleared,
    setTimer: (handler: () => void) => {
      fired.push(handler);
      return fired.length as unknown as PendingTimer;
    },
    clearTimer: (timer: PendingTimer) => {
      cleared.push(timer);
    },
    runAll: () => fired.splice(0).forEach((handler) => handler()),
  };
};

const createRegistry = (timers: ReturnType<typeof createFakeTimers>) =>
  createPendingRegistry<string>({
    timeoutMs: 1000,
    onTimeout: () => new Error('시간 초과'),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

test('settle 이 불리면 그 값으로 resolve 되고 타이머가 해제된다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  let settledId = 0;
  const promise = registry.push((id) => {
    settledId = id;
  });

  assert.equal(registry.size(), 1);
  assert.equal(registry.settle(settledId, '답'), true);
  assert.equal(await promise, '답');
  assert.equal(registry.size(), 0);
  assert.equal(timers.cleared.length, 1);
});

test('타임아웃이 지나면 reject 되고 레지스트리에서 사라진다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  const promise = registry.push(() => undefined);
  timers.runAll();

  await assert.rejects(promise, /시간 초과/);
  assert.equal(registry.size(), 0);
});

test('타임아웃 뒤에 도착한 settle 은 false 를 주고 아무것도 안 한다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  let pendingId = 0;
  const promise = registry.push((id) => {
    pendingId = id;
  });

  timers.runAll();
  await assert.rejects(promise, /시간 초과/);

  assert.equal(registry.settle(pendingId, '늦은 답'), false);
  assert.equal(registry.size(), 0);
});

test('id 는 대기마다 새로 발급되고 서로 섞이지 않는다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  const ids: number[] = [];
  const first = registry.push((id) => ids.push(id));
  const second = registry.push((id) => ids.push(id));

  assert.deepEqual(ids, [1, 2]);
  assert.equal(registry.size(), 2);

  registry.settle(2, '두 번째');
  assert.equal(await second, '두 번째');
  assert.equal(registry.size(), 1);

  registry.settle(1, '첫 번째');
  assert.equal(await first, '첫 번째');
});

test('cancelAll 은 기다리던 대기를 전부 거절한다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  const first = registry.push(() => undefined);
  const second = registry.push(() => undefined);

  assert.equal(registry.cancelAll(() => new Error('멈춤')), 2);

  await assert.rejects(first, /멈춤/);
  await assert.rejects(second, /멈춤/);
  assert.equal(registry.size(), 0);
  assert.equal(timers.cleared.length, 2);
});

test('멈춘 뒤 도착한 답은 받지 않는다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  let pendingId = 0;
  const promise = registry.push((id) => {
    pendingId = id;
  });

  registry.cancelAll(() => new Error('멈춤'));
  await assert.rejects(promise, /멈춤/);

  assert.equal(registry.settle(pendingId, '늦은 답'), false);
});

test('카드를 못 보내면 대기를 남기지 않고 바로 거절한다', async () => {
  const timers = createFakeTimers();
  const registry = createRegistry(timers);

  const promise = registry.push(() => {
    throw new Error('패널 없음');
  });

  await assert.rejects(promise, /패널 없음/);
  assert.equal(registry.size(), 0);
  assert.equal(timers.cleared.length, 1);
});
