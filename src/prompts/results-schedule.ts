export const scheduleResults = {
  noSchedules: '내 계정에 걸려 있는 예약이 없다. 계정으로 걸렀다면 조건을 빼고 다시 볼 것.',
  scheduleIdRequired: 'scheduleId 가 비어 있다. list_schedules 로 목록을 먼저 받을 것.',
  /**
   * 스케줄러의 소유자 스코프는 다붓 인증이 켜져 있을 때만 걸린다. 꺼진 배포에서는 아무나 전부 읽고 지운다.
   * 우리 쪽 판정의 유일한 근거가 /api/blog-accounts 라서, 그걸 못 읽으면 되돌릴 수 없는 작업을 열 수 없다.
   */
  scheduleAccountsUnknown: (detail: string) =>
    `내 계정 목록을 읽지 못해서 어떤 예약이 내 것인지 가릴 수 없다: ${detail}. 스케줄러의 소유자 구분은 서버 설정에 달려 있어서 계정 목록 없이는 남의 예약을 건드릴 수 있다. 아무것도 읽지 않았다. 사용자에게 다붓 로그인 상태를 확인해 달라고 알릴 것.`,
  scheduleAccountFilterUnknown: (value: string) =>
    `${value} 는 내 계정 목록에 없다. list_scheduler_accounts 가 돌려준 id 나 이름만 넣을 것. 어떤 계정인지 모르면 accountId 를 아예 빼고 부를 것.`,
  scheduleTooManyAccounts: (count: number, max: number) =>
    `내 계정이 ${count}개라 한 번에 다 훑을 수 없다(최대 ${max}개). 아무것도 읽지 않았다. list_scheduler_accounts 로 계정을 확인하고 accountId 에 하나를 넣어 다시 부를 것. 어느 계정인지 모르면 사용자에게 물어볼 것.`,
  scheduleNotOwned: (id: string) =>
    `${id} 예약은 내 다붓 계정에 등록된 블로그의 것이 아니다. 스케줄러는 계정을 가리지 않고 돌려주므로 남의 예약일 수 있다. 읽지도 취소하지도 않았다. list_schedules 로 내 예약만 다시 받을 것.`,
  scheduleNotFound: (id: string) =>
    `${id} 예약을 스케줄러에서 찾지 못했다. 이미 지워졌거나 id 가 틀렸다. list_schedules 로 다시 확인할 것.`,
  scheduleNotRead: (id: string) =>
    `${id} 는 이번 실행에서 읽은 적 없는 예약이다. id 를 기억이나 짐작으로 만들지 말고 list_schedules 나 get_schedule 로 먼저 확인할 것.`,
  scheduleReadFailed: (detail: string) =>
    `예약 내용을 읽지 못했다: ${detail}. 아무것도 바뀌지 않았다. 저장된 값을 확인하지 못했다는 사실을 그대로 알릴 것.`,
  scheduleNoJobs: (id: string, status: string) =>
    `${id} 예약(상태: ${status})에 등록된 글이 하나도 없다. 예약은 만들어졌지만 발행할 건이 붙지 않은 상태다.`,
  /** projectId 가 저장되지 않았다는 사실 자체가 확인 결과다. 표에 그대로 보여준다. */
  scheduleProjectMissing: '저장 안 됨',
  /**
   * manuscriptType 도 같은 사각지대다. auto_schedule_posts 의 최상위 manuscript_type 은
   * 등록 시점 큐 페이로드에만 실리고 ScheduleJob 문서에는 남지 않는다(calculateSchedule 이
   * keyword/category/scheduledAt/slot 만 채운다). 열을 없애면 "확인했다" 는 거짓 보고가 되므로
   * 저장 안 됐다는 사실을 표에 남긴다.
   */
  scheduleManuscriptTypeMissing: '저장 안 됨',
  scheduleStatus: {
    pending: '대기',
    processing: '진행 중',
    completed: '완료',
    failed: '실패',
    cancelled: '취소됨',
  },
  scheduleJobStatus: {
    pending: '대기',
    generating: '원고 생성 중',
    generated: '원고 완료',
    publishing: '발행 중',
    published: '발행됨',
    failed: '실패',
    cancelled: '취소됨',
  },
  scheduleAlreadyCancelled: (id: string) =>
    `${id} 예약은 이미 취소되어 있다. 아무것도 하지 않았다. 다시 부르지 말고 사용자에게 이미 취소된 예약이라고 알릴 것.`,
  scheduleCancelRefusedEarlier: (id: string) =>
    `사용자가 이번 실행에서 이미 ${id} 예약 취소를 승인하지 않았다. 같은 예약으로 다시 확인을 요청하지 말고 멈출 것.`,
  scheduleCancelRetryBlocked: (id: string) =>
    `이미 취소를 시도한 예약이다: ${id}. 다시 시도하지 말고 get_schedule 로 상태를 읽어 사용자에게 알릴 것.`,
  scheduleCancelRunLimit: (max: number) =>
    `이번 실행에서 취소할 수 있는 ${max}건을 다 썼다. 더 취소하려면 사용자에게 새로 요청받아야 한다.`,
  scheduleCancelNotApproved: (answer: string) =>
    `사용자가 예약 취소를 승인하지 않았다(답변: ${answer}). 예약은 그대로 있다. 다시 부르지 말고 사용자에게 무엇을 할지 물어볼 것.`,
  /** 답이 아예 없었던 경우. 사용자가 하지 않은 답변을 지어내 보고하지 않는다. */
  scheduleCancelNoAnswer: (id: string) =>
    `${id} 예약 취소 확인에 사용자가 답하지 않아 시간이 지났다. 거절한 것이 아니라 답이 없었던 것이다. 취소하지 않았고 예약은 그대로 있다. 다시 부르지 말고, 확인을 받지 못해 멈췄다고 사용자에게 알릴 것.`,
  /**
   * 스케줄러의 DELETE 는 published job 까지 status 를 cancelled 로 덮는다.
   * 이미 올라간 글은 네이버에 그대로 남으므로 전체 건수를 "안 올라간다" 로 말하면 거짓이 된다.
   */
  scheduleCancelled: (id: string, stoppable: number, total: number, published: number) =>
    [
      `${id} 예약을 취소했다(예약에 담긴 전체 ${total}건).`,
      stoppable > 0
        ? `이 중 발행 예정이던 ${stoppable}건은 그 시각에 올라가지 않는다.`
        : '남은 발행 예정이 없어서 실제로 멈춘 글은 없고 기록만 취소로 바뀌었다.',
      published > 0
        ? `이미 발행된 ${published}건은 네이버에 그대로 남아 있다. 취소해도 글이 내려가지 않는다는 사실을 사용자에게 반드시 함께 알릴 것.`
        : '',
      '되살리려면 같은 내용으로 다시 걸어야 한다.',
    ]
      .filter(Boolean)
      .join(' '),
  scheduleCancelNotConfirmed: (id: string) =>
    `스케줄러가 ${id} 취소를 성공으로 확인해 주지 않았다. 취소가 됐는지 알 수 없다. 다시 부르지 말고 get_schedule 로 상태를 읽어 사용자에게 알릴 것.`,
  scheduleCancelFailed: (detail: string) =>
    `예약 취소가 되지 않았다: ${detail}. 예약이 그대로 남아 있을 수 있다. 다시 부르지 말고 get_schedule 로 상태를 확인해 사용자에게 알릴 것.`,
} as const;
