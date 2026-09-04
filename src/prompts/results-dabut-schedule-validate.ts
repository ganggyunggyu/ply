import { IMAGE_SOURCES, MANUSCRIPT_TYPES } from '../scheduler-enums';

export const dabutScheduleValidateResults = {
  dabutEmpty: '다붓이 빈 원고를 돌려줬다. 서비스 상태를 확인해야 한다.',
  dabutNotLoggedIn: '다붓 로그인이 안 되어 있다. dabut_login 도구로 바로 로그인을 받아라.',
  dabutLoginDone: (label: string) => `${label} 으로 로그인됐다. 이어서 진행할 것.`,
  dabutLoginSkipped: '사용자가 로그인을 건너뛰었다. generate_manuscript 로 대체할 것.',
  dabutLoginNoAnswer:
    '사용자가 다붓 로그인 카드에 답하지 않아 시간이 지났다. 로그인되지 않았다. 다시 부르지 말고, 다붓 로그인이 필요하다는 것을 한 줄로 알리고 멈출 것.',
  projectChangesEmpty: '바꿀 항목이 비어 있다. changes 에 고칠 키만 담아서 다시 부를 것.',
  noDabutProjects: '이 계정에 만들어 둔 프로젝트가 없다. 다붓 앱에서 먼저 프로젝트를 만들어야 한다.',
  projectNotFound: (id: string) => `프로젝트 ${id} 를 찾지 못했다. list_dabut_projects 로 확인할 것.`,
  noSchedulerAccounts: '스케줄러에 등록된 계정이 없다.',
  schedulerUnreachable: (message: string) => `스케줄러 계정 목록을 못 가져왔다. 서버가 꺼져 있을 수 있다: ${message}`,
  emptyKeywords: '키워드가 비어 있다.',
  schedulerAccountRequired: 'accountId 가 비어 있다. list_scheduler_accounts 로 id 를 먼저 받을 것.',
  scheduleDateRequired: 'scheduleDate 가 비어 있다. YYYY-MM-DD 로 넣을 것. 날짜를 모르면 사용자에게 물어볼 것.',
  /**
   * 지난 날짜는 스케줄러가 거르지 않는다. 그대로 등록되면 워커가 밀린 job 으로 보고 바로 집어간다.
   * 사용자가 말한 적 없는 시각에 글이 올라가므로 여기서 막는다.
   */
  scheduleDatePast: (value: string, today: string) =>
    `${value} 는 오늘(${today}) 보다 이전이다. 지난 날짜로는 예약을 걸 수 없다. 스케줄러가 밀린 예약으로 보고 바로 발행할 수 있다. 오늘이거나 그 뒤 날짜를 넣을 것. 사용자가 말한 날짜가 애매하면 ask_user_form 으로 확인할 것.`,
  /**
   * 날짜만 봐서는 오늘 22시에 "오늘 06시" 예약을 거는 것을 못 막는다. 그것도 지난 날짜와 똑같이
   * 밀린 job 이 되어 워커가 바로 집어간다. 그래서 오늘인 경우에만 시각까지 본다.
   */
  scheduleStartHourPast: (startHour: number, today: string, nowHour: number) =>
    `${today} ${startHour}시는 이미 지났다(지금 KST ${nowHour}시). 지난 시각으로 예약을 걸면 스케줄러가 밀린 예약으로 보고 바로 발행할 수 있다. 오늘 걸려면 지금보다 뒤 시각을, 아니면 내일 이후 날짜를 넣을 것. 사용자가 말한 시각이 애매하면 ask_user_form 으로 확인할 것.`,
  scheduleStartHourRequired:
    'startHour 가 비어 있다. 첫 글을 몇 시에 올릴지 정하지 않으면 스케줄러 기본값으로 걸린다. 0 에서 23 사이 숫자를 넣을 것. 모르면 ask_user_form 으로 사용자에게 물어볼 것.',
  unknownManuscriptType: (value: string) =>
    `${value} 는 스케줄러가 아는 원고 스타일이 아니다. 아래 중에서 고를 것: ${MANUSCRIPT_TYPES.join(', ')}`,
  unknownImageSource: (value: string) =>
    `${value} 는 스케줄러가 아는 이미지 출처가 아니다. 아래 중에서 고를 것: ${IMAGE_SOURCES.join(', ')}`,
  scheduleOutOfRange: (field: string, min: number, max: number) =>
    `${field} 는 ${min} 에서 ${max} 사이여야 한다. 범위 밖 값은 스케줄러가 거부한다.`,
  scheduled: (payload: string) =>
    `예약이 등록됐다: ${payload}. 아직 저장된 내용을 확인하지 않았다. 응답 안의 scheduleIds 에 있는 id 로 get_schedule 을 바로 불러서 키워드, 발행 시각, 원고 프로젝트가 실제로 저장됐는지 읽고, 그 결과까지 확인한 뒤에 사용자에게 보고할 것.`,
  scheduleFailed: (detail: string) =>
    `예약이 걸리지 않았다. 스케줄러가 거부했다: ${detail}. 아무것도 등록되지 않았으니 완료라고 말하지 말 것. 사용자에게 실패 사실과 원인을 그대로 알리고, 고쳐야 할 값이 있으면 한 줄로 적을 것.`,
  /**
   * 지문에 projectId 가 빠져 있어(schedule-idempotency 의 normalizeItemOverrides 가 projectId 를 버린다)
   * 프로젝트만 바꿔 다시 걸면 반드시 여기로 떨어진다. 즉 저장값이 보낸 값과 다른 것이 보장된
   * 유일한 분기다. 검증이 가장 필요한 자리이므로 scheduled 와 똑같이 get_schedule 을 강제한다.
   */
  scheduleReused: (totalJobs: number, payload: string) =>
    `같은 조건의 예약이 이미 있어 스케줄러가 기존 것을 그대로 돌려줬다. 새로 등록된 것이 아니다(기존 잡 ${totalJobs}건). 저장된 내용은 예전 그대로일 가능성이 높다. 특히 원고 프로젝트만 바꿔 다시 건 경우라면 그 변경은 들어가지 않았다. 추측하지 말고 응답 안의 scheduleIds 에 있는 id 로 get_schedule 을 바로 불러서 지금 저장돼 있는 키워드·발행 시각·원고 프로젝트를 읽을 것. 그 결과를 보고, 사용자가 원한 프로젝트와 다르면 다르다고 분명히 말하고 바꾸려면 기존 예약을 먼저 취소해야 한다고 알릴 것: ${payload}`,
  scheduleDateFormat: (value: string) =>
    `${value} 는 날짜 형식이 아니다. YYYY-MM-DD 로, 월과 일을 두 자리로 넣을 것. 실제로 있는 날짜여야 한다.`,
  projectNotListed:
    'projectId 를 확인 없이 넘겼다. list_dabut_projects 를 먼저 부르고, 그 결과에 있는 id 만 쓸 것. 기억으로 id 를 지어내지 말 것.',
} as const;
