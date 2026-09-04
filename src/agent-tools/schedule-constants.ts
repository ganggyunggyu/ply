/** 예약 취소는 한 번에 하나라 개수 상한 대신 실행 상한만 둔다. */
export const MAX_CANCEL_PER_RUN = 3;

/** 계정별 목록을 합친 뒤 모델에게 보낼 최대 건수. 스케줄러의 계정당 상한과 같은 수로 맞춘다. */
export const MAX_LIST_SCHEDULES = 50;

/**
 * 계정별로 나눠 부를 때의 상한. 스케줄러의 GET /schedules 는 한 번에 최근 50건이라
 * 계정 수만큼 요청이 늘어난다. 이 수를 넘으면 조용히 자르지 않고 계정을 좁히라고 알린다.
 */
export const MAX_SCHEDULE_ACCOUNTS = 12;
