/**
 * 패널의 답을 기다리는 대기 레지스트리.
 *
 * 메인이 패널에 카드를 띄우고 답을 기다리는 자리가 두 곳(질문, 다붓 로그인)이다.
 * 둘 다 실행 슬롯을 잡은 채 기다리므로, 사용자가 카드를 무시하거나 패널이 리로드되면
 * 그 promise 는 영영 안 풀리고 agentRunning 이 true 로 굳어 앱을 재시작해야 한다.
 * 그래서 대기는 반드시 타이머를 달고, 만료되면 reject 한다.
 *
 * 타이머 주입은 테스트용이다. 실제 10분을 기다리지 않고 만료 경로를 검증한다.
 */

export type PendingTimer = ReturnType<typeof setTimeout>;

type PendingRegistryOptions = {
  timeoutMs: number;
  /** 만료 시 promise 를 거절할 에러. 문구는 messages.ts 가 가진다. */
  onTimeout: () => Error;
  setTimer?: (handler: () => void, ms: number) => PendingTimer;
  clearTimer?: (timer: PendingTimer) => void;
};

type PendingEntry<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer: PendingTimer;
};

export const createPendingRegistry = <T>({
  timeoutMs,
  onTimeout,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: PendingRegistryOptions) => {
  const pending = new Map<number, PendingEntry<T>>();
  let seq = 0;

  /**
   * emit 은 id 를 받아 패널로 카드를 보낸다. 채널과 페이로드는 부르는 쪽이 정한다.
   * 등록을 먼저 하고 보내야 답이 먼저 도착해도 놓치지 않는다.
   */
  const push = (emit: (id: number) => void): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      seq += 1;
      const id = seq;

      const timer = setTimer(() => {
        pending.delete(id);
        reject(onTimeout());
      }, timeoutMs);

      pending.set(id, { resolve, reject, timer });

      try {
        emit(id);
      } catch (error) {
        // 카드를 못 보냈으면 아무도 답할 수 없다. 타이머만 남기면 10분 뒤에야 풀린다.
        pending.delete(id);
        clearTimer(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

  /** 만료된 뒤 도착한 답은 false 다. 패널이 이걸로 "이미 닫힌 카드" 를 표시한다. */
  const settle = (id: number, value: T) => {
    const entry = pending.get(id);
    if (!entry) return false;

    pending.delete(id);
    clearTimer(entry.timer);
    entry.resolve(value);

    return true;
  };

  /**
   * 실행을 멈출 때 쓴다. 답을 기다리는 도구는 정지 신호를 못 보므로, 대기를 풀어 주지 않으면
   * 사용자가 정지를 눌러도 카드에 답할 때까지 실행이 계속 붙잡혀 있다.
   */
  const cancelAll = (error: () => Error) => {
    const entries = [...pending.values()];
    pending.clear();

    entries.forEach(({ reject, timer }) => {
      clearTimer(timer);
      reject(error());
    });

    return entries.length;
  };

  return { push, settle, cancelAll, size: () => pending.size };
};

export type PendingRegistry<T> = ReturnType<typeof createPendingRegistry<T>>;
