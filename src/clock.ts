/**
 * 날짜 판정은 전부 KST 기준이다.
 *
 * 사용자도 스케줄러도 한국 시간으로 말하는데 Date 의 toISOString 은 UTC 다.
 * UTC 로 "오늘" 을 구하면 한국 시간 09:00 이전에는 전날이 나오고, 그 값으로 과거 날짜를
 * 거르면 오늘 예약이 거부되거나 어제 예약이 통과한다.
 *
 * 시계를 읽는 것과 날짜를 만드는 것을 분리해서, 만드는 쪽은 순수 함수로 둔다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** now 를 KST 로 옮겨 YYYY-MM-DD 로 만든다. */
export const toKstDate = (now: Date): string =>
  new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/** 지금의 KST 날짜. 시계를 읽는 유일한 자리다. */
export const kstToday = () => toKstDate(new Date());

/**
 * now 를 KST 자정으로부터 지난 분으로 만든다.
 *
 * 날짜만 봐서는 "오늘 06시" 예약을 22시에 거는 것을 막지 못한다. 그건 지난 날짜와 똑같이
 * 밀린 job 이 되어 워커가 바로 집어간다. 시각까지 비교하려면 이 값이 필요하다.
 */
export const toKstMinutes = (now: Date): number => {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);

  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

/** 지금의 KST 분. 시계를 읽는 자리는 여기와 kstToday 둘뿐이다. */
export const kstMinutesNow = () => toKstMinutes(new Date());
