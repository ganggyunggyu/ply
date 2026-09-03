/**
 * 토큰 사용량 누적과 표기.
 *
 * OpenRouter 의 usage 는 호출 한 번의 값만 온다. 실행 하나가 도구를 열 번 부르면
 * 열 번 따로 오므로, 사람이 볼 숫자는 여기서 합친다.
 * 판정과 포맷을 panel.ts 밖에 두어야 테스트가 붙는다.
 */

export type UsageTotal = {
  promptTokens: number;
  completionTokens: number;
};

export const EMPTY_USAGE: UsageTotal = { promptTokens: 0, completionTokens: 0 };

/** 음수나 NaN 은 0 으로 본다. 서버가 이상한 값을 줘도 합계가 깨지지 않아야 한다. */
const safeCount = (value: number) => (Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0);

export const addUsage = (
  total: UsageTotal,
  next: { promptTokens: number; completionTokens: number },
): UsageTotal => ({
  promptTokens: total.promptTokens + safeCount(next.promptTokens),
  completionTokens: total.completionTokens + safeCount(next.completionTokens),
});

export const totalTokens = ({ promptTokens, completionTokens }: UsageTotal) =>
  promptTokens + completionTokens;

/** 단가는 100만 토큰당 달러다 (models.ts). 모델을 모르면 비용을 만들지 않는다. */
export const usageCost = (
  total: UsageTotal,
  price?: { inputPerMillion: number; outputPerMillion: number },
): number | null => {
  if (!price) return null;

  const { promptTokens, completionTokens } = total;
  const cost =
    (promptTokens * price.inputPerMillion + completionTokens * price.outputPerMillion) / 1_000_000;

  return Number.isFinite(cost) ? cost : null;
};

/** 칩은 좁다. 천 단위부터 k 로 줄인다. */
export const formatTokenCount = (count: number): string => {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;

  return `${(count / 1_000_000).toFixed(2)}M`;
};

/** 소수점 아래가 길면 칩이 밀린다. 1센트 미만은 자리수를 더 준다. */
export const formatCost = (cost: number): string =>
  cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2);
