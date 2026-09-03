import { catalogSummary } from './services';
import { IMAGE_SOURCES, MANUSCRIPT_TYPES, SCHEDULE_STATUSES } from './scheduler-enums';

/**
 * 모델이 읽는 문장을 전부 여기 모은다.
 * 도구 설명, 파라미터 설명, 도구가 모델에게 돌려주는 문장, 시스템 프롬프트.
 * 에이전트 행동을 바꾸고 싶으면 코드가 아니라 이 파일을 고친다.
 * 사용자에게 보이는 UI 문구는 messages.ts 에 있다.
 */


export const TOOL_DESCRIPTIONS = {
  listAccounts:
    '이 브라우저에 등록된 네이버 계정 목록을 돌려준다. 계정 이름이나 아이디가 확실하지 않으면 먼저 이걸 부른다.',
  checkLogin: '해당 계정 프로필에 네이버 로그인 세션이 살아있는지 확인한다. 글쓰기 전에 반드시 먼저 확인한다.',
  naverLogin:
    '네이버 로그인 탭을 열고 저장된 비밀번호로 로그인을 시도한다. 캡차나 2차 인증이 뜨면 자동으로 넘기지 못하므로 사용자에게 직접 마무리하라고 알린다.',
  generateManuscript: '키워드로 네이버 블로그 원고 한 편을 생성한다. 첫 줄이 제목, 나머지가 본문이다.',
  dabutLogin:
    '다붓 계정 로그인 카드를 띄우고 사용자가 입력을 끝낼 때까지 기다린다. 다붓 로그인이 안 되어 있으면 사용자에게 "가서 로그인하세요"라고 말하지 말고 이 도구를 부른다.',
  listDabutProjects:
    '다붓 계정에 만들어 둔 원고 프로젝트 목록을 돌려준다. 프로젝트 하나가 곧 원고 뽑는 방식이다(모델·지침·전후 단계가 묶여 있다). 다붓으로 원고를 뽑기 전에 반드시 먼저 부른다.',
  generateManuscriptDabut:
    '다붓 프로젝트로 원고를 생성한다. 실제 발행용 원고는 이걸 쓴다. projectId 는 list_dabut_projects 에서 고른다. 프로젝트가 여러 개면 ask_user 로 어느 것으로 뽑을지 먼저 물어본다. 다붓 로그인이 안 되어 있으면 generate_manuscript 로 대체한다.',
  publishBlogPost: '네이버 블로그에 글을 실제로 발행한다. 되돌릴 수 없으므로 사용자가 발행을 명확히 요청했을 때만 부른다.',
  openTab: '브라우저에 새 탭을 연다. 사용자가 특정 페이지를 보고 싶어할 때 쓴다.',
  askUser:
    '실행에 필요한 값이 하나일 때 사용자에게 물어본다. 원고 스타일, 발행 날짜, 계정, 키워드처럼 추측하면 안 되는 값은 반드시 이걸로 확인한 뒤 실행한다. 값이 두 개 이상 필요하면 이걸 쓰지 말고 ask_user_form 을 쓴다.',
  askUserForm:
    '값이 두 개 이상 필요할 때 사용자에게 입력 폼을 띄운다. 칸마다 라벨과 입력 방식을 정해 한 번에 받는다. 예약 발행처럼 날짜·계정·키워드·스타일을 한꺼번에 받아야 하는 경우에 쓴다. 질문 하나에 번호를 붙여 여러 값을 한 줄로 받게 하지 않는다. 보기가 정해진 칸은 choices 를 채워 고르게 한다. choices 는 label 과 value 를 따로 준다. 사용자에게는 label 이 보이고 답으로는 value 가 돌아오므로, 프로젝트처럼 이름과 id 가 다른 값은 label 에 이름을 value 에 id 를 넣는다. 이미 아는 값은 value 에 미리 넣어 사용자가 확인만 하게 한다.',
  checkServices:
    '이 컴퓨터에서 돌고 있는 연동 서비스(다붓 백엔드, 블로그 스케줄러, 노출지기) 상태를 확인한다. 해당 서비스를 쓰는 작업 전에 먼저 확인한다.',
  listSchedulerAccounts:
    '블로그 스케줄러 서버에 등록된 계정 목록을 돌려준다. auto_schedule_posts 의 accountId 는 반드시 여기서 나온 id 여야 한다. 브라우저 프로필 id 와는 다른 값이다.',
  autoSchedulePosts:
    '블로그 스케줄러 서버에 예약 발행을 건다. 원고 생성부터 발행까지 서버가 처리한다. 부르기 전에 반드시 list_scheduler_accounts 로 계정 id 를, list_dabut_projects 로 원고 프로젝트를 확인한다. projectId 는 list_dabut_projects 가 이번 실행에서 돌려준 id 만 받는다. 원고를 어떻게 뽑을지는 projectId 가 정하고 manuscriptType 은 원고 생성에서만 무시된다. 되돌리기 어려우니 값이 하나라도 불확실하면 ask_user_form 으로 먼저 확인한다.',
  listSchedules:
    '내 다붓 계정에 등록된 블로그에 걸려 있는 예약 목록을 읽는다. 아무것도 바꾸지 않는다. 계정마다 최근 50건까지만 나오고 그보다 오래된 예약은 보이지 않는다. 여기서는 묶음 단위 정보(날짜, 상태, 건수)만 나오고 키워드와 발행 시각은 get_schedule 로 봐야 한다. 예약을 취소하려면 반드시 이걸 먼저 부른다.',
  getSchedule:
    '예약 하나에 실제로 저장된 내용을 읽는다. 아무것도 바꾸지 않는다. 건마다 키워드, 발행 시각, 상태, 저장된 원고 프로젝트(project 는 사람이 읽는 이름, projectId 는 원문 id)를 돌려준다. 예약을 걸고 나면 이걸 불러서 내가 보낸 값이 실제로 저장됐는지 확인한 뒤 보고한다. 사용자가 어떤 프로젝트로 걸렸는지 물으면 이름만 보고 판단하지 말고 projectId 가 보낸 id 와 같은지 대조한다. project 나 manuscriptType 이 "저장 안 됨" 이면 그 값이 예약 문서에 남지 않았다는 뜻이니 그대로 알린다.',
  cancelSchedule:
    '예약을 취소한다. 그 시각에 글이 올라가지 않는다. 되살리는 기능이 스케줄러에 없어서 취소하면 같은 내용으로 처음부터 다시 걸어야 한다. list_schedules 나 get_schedule 이 이번 실행에서 돌려준 scheduleId 만 받고, 그 밖의 id 는 전부 거부한다. 이 도구는 실행 중에 스스로 사용자에게 취소 확인을 받는다. 이미 승인받았다고 가정하지 않는다. 실패하거나 결과가 애매해도 절대 다시 부르지 않는다.',
  listExposureJobs: '노출지기에서 돌릴 수 있는 노출체크 작업 목록을 돌려준다.',
  listServices:
    '사용자가 주소를 넣어둔 서비스들의 이름과 주소 목록을 돌려준다. "노출지기 열어줘" 처럼 서비스 이름이 나오면 여기서 주소를 찾는다. 목록에 없는 이름은 아직 주소가 설정되지 않은 것이다.',
  openService:
    '서비스를 브라우저 탭으로 연다. 서비스 이름(노출지기, 다붓, 시트앱 등)만 주면 주소를 알아서 찾는다. 사용자에게 주소를 묻지 않는다. 사용자가 설정에 주소를 넣지 않은 서비스는 열지 않고 그 사실을 돌려준다.',
  runExposureCheck:
    '노출지기로 네이버 노출체크를 실행한다. 수 분에서 수십 분 걸린다. 어떤 시트를 돌릴지 확실하지 않으면 list_exposure_jobs 로 확인하고 ask_user 로 물어본다.',
  listMyPosts:
    '해당 계정 블로그의 최근 글 목록(logNo, 제목, 날짜, 주소)을 읽어온다. 아무것도 바꾸지 않는다. 글을 지우려면 반드시 이걸 먼저 부른다. 목록에 나온 순서는 최신순이 아닐 수 있다. 공지로 고정된 글과 아직 발행되지 않은 예약 글이 위에 올 수 있으니, 앞에서 N개를 잘라 지우지 말고 제목과 날짜를 사용자에게 보여주고 확인받는다.',
  deleteBlogPosts:
    '네이버 블로그 글을 영구 삭제한다. 복구할 수 없다. 지울 글의 logNo 배열을 직접 받는다. "최근 3개", "그거", "다" 같은 말을 이 도구가 알아서 해석하지 않는다. list_my_posts 가 이번 실행에서 돌려준 logNo 만 받고, 그 밖의 번호는 전부 거부한다. 이 도구는 실행 중에 스스로 사용자에게 삭제 확인을 받는다. 이미 승인받았다고 가정하지 않는다. 한 번에 최대 10개. 실패하거나 결과가 "지워졌는지 확인 못 함" 으로 나와도 절대 다시 부르지 않는다.',
} as const;

export const PARAM_DESCRIPTIONS = {
  accountId: 'list_accounts 가 돌려준 계정 id',
  schedulerAccountId: 'list_scheduler_accounts 가 돌려준 id. 브라우저 프로필 id 를 그대로 넣으면 안 된다.',
  keyword: '글의 주제 키워드',
  tone: '원하는 톤. 없으면 생략',
  angle: '같은 키워드로 여러 편 쓸 때 각 편의 차별점',
  ref: '참고 자료나 업체 정보',
  model: '지정할 모델. 비우면 다붓 기본값',
  profileId: '이 계정 프로필로 열고 싶을 때만',
  question: '사용자에게 보여줄 질문 한 문장',
  choices: '고르게 할 보기. 자유 입력이면 생략',
  formFields: [
    '받을 값 목록. 칸 하나가 객체 하나다.',
    'key 는 결과에서 값을 찾을 이름, label 은 칸 왼쪽에 보이는 짧은 이름이다.',
    'type 은 text/number/date/time 중 하나이고 기본은 text 다. 날짜는 date, 시각은 time 을 쓴다.',
    'choices 를 주면 고르는 칸이 된다. 보기 하나는 { label, value } 다. label 은 화면에 보이는 글자, value 는 답으로 돌아오는 값이다. 이름과 id 가 다르면 반드시 둘을 나눠 넣는다.',
    '칸의 value 는 미리 채워둘 값이다. choices 가 있으면 그 보기의 value 중 하나여야 한다. optional 이 true 면 비워도 넘어간다.',
    '비밀번호는 절대 이걸로 받지 않는다.',
  ].join(' '),
  formChoiceItems:
    '보기 목록. 보기 하나는 { label, value } 다. label 은 사용자가 보는 글자, value 는 답으로 돌아오는 값이다. 이름과 id 가 다르면 label 에 이름을, value 에 id 를 넣는다. 둘이 같아도 되지만 둘 다 채운다.',
  scheduleDate:
    'YYYY-MM-DD 형식의 실제 날짜. 월과 일은 두 자리로 쓴다. 오늘이거나 그 뒤여야 한다. 오늘 날짜는 시스템 프롬프트에 적혀 있다',
  manuscriptType: `원고 스타일. 아래 목록 밖의 값을 넣으면 스케줄러가 거부한다: ${MANUSCRIPT_TYPES.join(', ')}. projectId 를 넘기면 원고 생성에서는 이 값이 무시되지만 발행 모드 계산에는 그대로 쓰인다`,
  imageSource: `본문에 넣을 이미지를 어디서 가져올지: ${IMAGE_SOURCES.join(', ')}. 안 주면 ai 로 돈다`,
  scheduleProjectId:
    'list_dabut_projects 가 이번 실행에서 돌려준 프로젝트 id. 목록에 없던 id 는 거부된다. 넘기면 원고를 그 프로젝트 방식으로 뽑는다(원고 생성에서만 manuscriptType 을 대신한다). 다붓 로그인이 되어 있을 때만 쓴다',
  postsPerDay: '하루에 몇 건 발행할지. 1 에서 10 사이',
  startHour:
    '첫 글을 몇 시에 올릴지. 0 에서 23 사이. 필수다. 사용자가 말하지 않았으면 ask_user_form 으로 물어보고, 짐작해서 채우지 않는다',
  intervalMinutes: '글 사이 간격(분). 10 에서 720 사이',
  keywordCategory: '이 예약 묶음에 붙일 카테고리. 없으면 생략',
  blogName: '스케줄러 계정에 등록된 블로그 이름. 없으면 생략',
  scheduleId:
    'list_schedules 나 get_schedule 이 이번 실행에서 돌려준 scheduleId. sch_ 로 시작하는 문자열을 접두사까지 그대로 넣는다',
  scheduleAccountFilter:
    '특정 계정의 예약만 보고 싶을 때만. list_scheduler_accounts 가 돌려준 id 나 이름을 그대로 넣는다. 생략하면 내 계정 전부를 본다. 목록에 없는 값을 넣으면 거부된다',
  scheduleStatusFilter: `상태로 거를 때만: ${SCHEDULE_STATUSES.join(', ')}. 예약 묶음의 상태이고 건별 상태(generating, published 등)와는 다르다. 확실하지 않으면 생략한다`,
  exposureJob: 'list_exposure_jobs 의 key',
  serviceName: '서비스 이름 또는 key. 예: 노출지기, 다붓, 시트앱, cafe-bot',
  projectId: 'list_dabut_projects 가 돌려준 프로젝트 id',
  loginReason: '왜 로그인이 필요한지 한 문장. 카드에 그대로 보인다',
  businessName: '업체를 고정하고 싶을 때만. 웹검색 단계가 이 업체로 검색한다',
  withImages: '이미지까지 만들지 여부. 기본은 원고만',
  postLimit: '가져올 글 개수. 기본 10, 최대 30',
  logNos: 'list_my_posts 가 돌려준 logNo 문자열 배열. 목록에 없던 번호를 넣으면 거부된다. 최대 10개',
} as const;

export const TOOL_RESULTS = {
  noAccounts: '등록된 계정이 없다. 사용자에게 설정에서 계정을 추가하라고 안내할 것.',
  accountNotFound: (id: string) => `계정 ${id} 을 찾지 못했다.`,
  sessionAlive: '로그인 세션 있음',
  sessionMissing: '로그인 안 되어 있음',

  noStoredPassword: '비밀번호가 저장되어 있지 않다. 열어둔 탭에서 사용자가 직접 로그인해야 한다.',
  decryptFailed: '저장된 비밀번호를 복호화하지 못했다. 사용자가 직접 로그인해야 한다.',
  blockedByCaptcha: '캡차가 떴다. 사용자가 탭에서 직접 캡차를 풀어야 한다.',
  blockedByTwoFactor: '2차 인증이 필요하다. 사용자가 탭에서 직접 인증해야 한다.',
  wrongCredentials: '아이디 또는 비밀번호가 맞지 않는다.',
  stillOnLoginPage: '아직 로그인 페이지에 머물러 있다. 사용자가 탭에서 확인해야 한다.',
  loginSucceeded: '로그인 성공',

  notLoggedIn: '로그인이 안 되어 있다. naver_login 을 먼저 불러라.',
  published: (url: string) => `발행 완료: ${url}`,
  tabOpened: (url: string) => `탭을 열었다: ${url}`,
  userAnswered: (answer: string) => `사용자 답변: ${answer}`,
  userDidNotAnswer:
    '사용자가 답하지 않아 질문이 닫혔다. 추측해서 진행하지 말고, 무엇이 필요한지 한 줄로 알리고 멈출 것.',
  userAnsweredForm: (lines: string[]) => `사용자 입력:\n${lines.join('\n')}`,
  formCancelled:
    '사용자가 입력 폼을 취소했다. 추측해서 진행하지 말고, 무엇이 필요한지 한 줄로 알리고 멈출 것.',
  formNoFields: 'fields 가 비어 있다. 받을 칸을 하나 이상 넣어야 한다.',
  formBadFields:
    'fields 항목마다 key 와 label 이 필요하다. key 는 서로 달라야 하고, type 은 text/number/date/time 중 하나여야 한다.',
  formPrefillNotInChoices: (key: string) =>
    `${key} 칸의 value 가 choices 에 없다. 미리 채울 값은 그 칸 choices 의 value 중 하나여야 한다. 화면에 안 보이는 값을 미리 채우면 사용자가 눈치채지 못한 채 다른 값이 나간다.`,
  formEmptyAnswer:
    '사용자가 폼을 빈 채로 확인했다. 받은 값이 하나도 없다. 추측해서 진행하지 말고, 무엇이 필요한지 한 줄로 알리고 멈출 것.',

  dabutEmpty: '다붓이 빈 원고를 돌려줬다. 서비스 상태를 확인해야 한다.',
  dabutNotLoggedIn: '다붓 로그인이 안 되어 있다. dabut_login 도구로 바로 로그인을 받아라.',
  dabutLoginDone: (label: string) => `${label} 으로 로그인됐다. 이어서 진행할 것.`,
  dabutLoginSkipped: '사용자가 로그인을 건너뛰었다. generate_manuscript 로 대체할 것.',
  dabutLoginNoAnswer:
    '사용자가 다붓 로그인 카드에 답하지 않아 시간이 지났다. 로그인되지 않았다. 다시 부르지 말고, 다붓 로그인이 필요하다는 것을 한 줄로 알리고 멈출 것.',
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

  noSchedules: '내 계정에 걸려 있는 예약이 없다. 계정으로 걸렀다면 조건을 빼고 다시 볼 것.',
  scheduleIdRequired: 'scheduleId 가 비어 있다. list_schedules 로 목록을 먼저 받을 것.',
  /**
   * 스케줄러의 GET/DELETE /schedules 에는 소유자 스코프가 없어서, 토큰만 유효하면 남의 예약도 읽고 지운다.
   * 소유 판정의 유일한 근거가 /api/blog-accounts 라서, 그걸 못 읽으면 되돌릴 수 없는 작업을 열 수 없다.
   */
  scheduleAccountsUnknown: (detail: string) =>
    `내 계정 목록을 읽지 못해서 어떤 예약이 내 것인지 가릴 수 없다: ${detail}. 스케줄러의 예약 조회에는 소유자 구분이 없어서 계정 목록 없이는 남의 예약을 건드릴 수 있다. 아무것도 읽지 않았다. 사용자에게 다붓 로그인 상태를 확인해 달라고 알릴 것.`,
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

  unknownExposureJob: '모르는 작업이다. list_exposure_jobs 로 확인할 것.',
  serviceNotFound: (name: string) =>
    `${name} 은 아는 서비스가 아니다. list_services 로 목록을 확인할 것.`,
  serviceNotConfigured: (name: string) =>
    `${name} 주소가 비어 있어 아무것도 열지 않았다. 주소를 지어내지 말고, ${name} 주소를 몰라서 열지 못했다고 사용자에게 알릴 것.`,
  noServicesConfigured:
    '주소가 있는 서비스가 하나도 없다. 열 수 있는 화면이 없다. 주소를 지어내지 말고, 열 수 있는 화면이 없다고 사용자에게 알릴 것.',
  serviceOpened: (name: string, url: string) => `${name} 을 탭으로 열었다: ${url}`,
  exposureDirUnset: '노출지기 저장소 경로가 설정되어 있지 않다. 사용자에게 설정에서 경로를 넣어달라고 안내할 것.',
  exposureNoJobs: (dir: string) =>
    `${dir} 의 package.json 에 exposure: 로 시작하는 스크립트가 없다. 경로가 맞는지 사용자에게 확인할 것.`,
  exposureDone: (label: string, output: string) => `노출체크 완료 (${label})\n${output}`,
  exposureFailed: (code: number | null, output: string) => `실패 코드 ${code}\n${output}`,

  noPosts: (blogId: string) => `${blogId} 블로그에서 글을 찾지 못했다.`,
  deleteNoTargets: '지울 logNo 가 비어 있다. list_my_posts 로 목록을 먼저 받을 것.',
  deleteInvalidLogNo: (values: string[]) => `logNo 형식이 아니다: ${values.join(', ')}`,
  deleteTooMany: (max: number) => `한 번에 ${max}개까지만 지울 수 있다. 사용자에게 나눠서 진행할지 물어볼 것.`,
  deleteUnknownLogNo: (values: string[]) =>
    `이번 실행의 list_my_posts 결과에 없는 logNo 다: ${values.join(', ')}. 번호를 지어내지 말고 list_my_posts 를 먼저 부를 것.`,
  deleteAccountMismatch: '목록을 읽은 계정과 삭제하려는 계정이 다르다. 같은 계정으로 list_my_posts 를 다시 부를 것.',
  deleteBlogMismatch: '서로 다른 블로그의 글이 섞여 있다. 한 블로그씩 나눠서 진행할 것.',
  deleteRetryBlocked: (values: string[]) =>
    `이미 삭제를 시도한 글이다: ${values.join(', ')}. 다시 시도하지 말고 사용자에게 블로그에서 직접 확인해 달라고 할 것.`,
  deleteRefusedEarlier: (values: string[]) =>
    `사용자가 이번 실행에서 이미 삭제를 거절한 글이다: ${values.join(', ')}. 같은 글로 다시 확인을 요청하지 말고 멈출 것.`,
  deleteRunLimit: (max: number) =>
    `이번 실행에서 삭제를 시도할 수 있는 ${max}개를 다 썼다. 더 지우려면 사용자에게 새로 요청받아야 한다.`,
  deleteBlogChanged: (expected: string, actual: string) =>
    `목록을 읽을 때는 ${expected} 블로그였는데 지금 세션은 ${actual} 블로그다. 아무것도 지우지 않았다. 사용자에게 계정을 확인해 달라고 할 것.`,
  deleteCancelled: (answer: string) =>
    `사용자가 삭제를 승인하지 않았다(답변: ${answer}). 아무 글도 지우지 않았다. 다시 부르지 말고 사용자에게 무엇을 할지 물어볼 것.`,
  deleteStatus: {
    deleted: '삭제됨',
    notFound: '이미 없음',
    titleMismatch: '제목이 달라 건너뜀',
    unknown: '지워졌는지 확인 못 함',
  },
  /** 배치 중간에 정지가 걸렸을 때 남은 글에 붙는 상태. 손대지 않았다는 뜻이다. */
  deleteStatusStopped: '정지로 건너뜀',
  deleteStoppedBeforeStart:
    '사용자가 정지를 눌러서 아무 글도 지우지 않았다. 다시 부르지 말고, 삭제하지 않았다는 것만 알릴 것.',
  toolSkippedByStop: '사용자가 실행을 멈춰서 이 도구는 실행하지 않았다.',
  runStopped: '사용자가 실행을 멈췄다. 이어서 하지 말고 여기서 끝낼 것.',
} as const;

export const MANUSCRIPT_SYSTEM = `너는 네이버 블로그 원고를 쓰는 한국어 작가다.

지켜야 할 것
- 사람이 말하듯 담백하게 쓴다. 번역체와 딱딱한 문어체를 쓰지 않는다.
- 미들닷(·)을 쓰지 않는다. 쉼표나 줄바꿈으로 대체한다.
- 없는 사실을 지어내지 않는다.
- 마크다운 기호(#, **, -)를 쓰지 않는다. 네이버 에디터에 그대로 들어갈 평문으로 쓴다.
- 첫 줄은 제목만 쓰고, 그다음 줄부터 본문을 쓴다.`;

export const buildManuscriptPrompt = ({
  keyword,
  tone,
  angle,
}: {
  keyword: string;
  tone?: string;
  angle?: string;
}) =>
  [
    `키워드: ${keyword}`,
    tone ? `톤: ${tone}` : '',
    angle ? `이번 글의 관점: ${angle}` : '',
    '',
    '1200자 내외로 네이버 블로그 글 한 편을 써라.',
  ]
    .filter(Boolean)
    .join('\n');

/**
 * 주소가 설정된 서비스만 모델에게 보여준다.
 * 코드 기본값은 example.com 이고 그 도메인은 실제로 응답한다.
 * 미설정 항목을 그대로 실으면 모델이 그 주소를 진짜로 믿고 열어 "열었어요" 라고 보고한다.
 */
const serviceSection = () => {
  const summary = catalogSummary();

  if (!summary) {
    return `## 사용자가 쓰는 서비스

아직 주소가 있는 서비스가 없다. open_service 로 열 수 있는 화면이 하나도 없다.
서비스 이름이 나오면 주소를 추측하거나 지어내지 말고, 그 화면 주소를 몰라서 열지 못한다고 한 줄로 알린다.`;
  }

  return `## 사용자가 쓰는 서비스 (아래 주소는 이 앱이 알고 있는 값이다. 사용자에게 다시 묻지 마라)

${summary}

여기 있는 서비스 이름이 나오면 open_service 로 바로 연다. "주소를 알려주시면" 같은 말을 하지 않는다.
여기 없는 이름은 주소를 모르는 것이다. 지어내지 말고 설정에서 넣어달라고 알린다.`;
};

/**
 * 서비스 주소를 설정에서 덮어쓴 뒤에 읽어야 하므로 상수가 아니라 함수다.
 * 오늘 날짜는 인자로 받는다. 여기서 시계를 읽으면 프롬프트 테스트가 실행 시각에 묶인다.
 */
export const buildAgentSystemPrompt = ({ today }: { today: string }) =>
  `너는 GNG Browser 안에서 도는 네이버 작업 에이전트다.
사용자가 한국어로 시키는 일을 도구를 써서 실제로 실행한다.

너는 이 사용자의 네이버 관련 서비스들을 지휘한다.
원고 생성은 다붓 백엔드, 예약 발행은 블로그 스케줄러, 노출체크는 노출지기를 도구로 부른다.

## 오늘 날짜

오늘은 ${today} 다. 시간대는 KST(한국 표준시)다.
"오늘", "내일", "모레", "이번 주 금요일" 은 전부 이 날짜에서 계산한다. 기억에 있는 날짜를 쓰지 않는다.
예약 날짜는 오늘이거나 그 뒤여야 한다. 지난 날짜로 예약을 걸면 도구가 거부한다.
오늘로 예약할 때는 startHour 도 지금보다 뒤여야 한다. 이미 지난 시각은 도구가 거부한다.

${serviceSection()}

말투
- 사용자에게 하는 말은 반드시 해요체로 쓴다. "~했어요", "~할게요", "~해 주세요".
- 반말과 평서형을 쓰지 않는다. "~했다", "~한다", "~해라" 는 사용자에게 쓰지 않는다.
- 도구가 돌려주는 문장은 너에게 주는 내부 메모라 평서형으로 적혀 있다. 그 말투를 따라하지 말고
  해요체로 바꿔서 전달한다.
- 사과하거나 굽신거리지 않는다. 이모지를 쓰지 않는다.

가장 중요한 규칙
- 계획을 말로 설명하고 끝내지 마라. 다음에 할 일이 있으면 그 도구를 지금 불러라.
  "이제 ~하겠습니다", "~를 사용하겠습니다" 라고 쓰고 턴을 끝내는 것은 실패다.
- 한 턴에 여러 도구를 이어서 불러도 된다. 사용자가 시킨 일이 끝날 때까지 계속 부른다.
- 도구가 실패하거나 서비스가 꺼져 있으면, 대체 도구를 바로 부른다. 사용자에게 되묻지 않는다.
  예: generate_manuscript_dabut 이 실패하면 곧바로 generate_manuscript 를 부른다.
  단 delete_blog_posts 는 예외다. 실패하든 "확인 못 함" 으로 나오든 절대 다시 부르지 않는다.
  삭제는 실패처럼 보여도 이미 지워졌을 수 있다. 그 자리에서 멈추고 사용자에게 블로그에서 직접 확인해 달라고 말한다.
  cancel_schedule 도 같다. 실패해 보여도 큐에서는 이미 빠졌을 수 있다. 다시 부르지 말고 get_schedule 로 상태를 읽어 알린다.
  ask_user 와 ask_user_form 도 예외다. 사용자가 답하지 않거나 폼을 취소한 것은 실패가 아니라 대답이 없는 것이다.
  같은 질문을 다시 던지거나 추측해서 다음 단계로 넘어가지 않는다. 무엇이 필요한지 한 줄로 알리고 멈춘다.
- 텍스트만 내보내는 것은 (1) 일이 전부 끝났을 때 (2) ask_user 나 ask_user_form 으로 답을 기다릴 때 두 경우뿐이다.

원칙
- 값이 하나라도 불확실하면 실행하지 말고 먼저 물어본다.
  특히 원고 스타일, 발행 날짜, 계정, 하루 몇 건인지, 그리고 어느 블로그의 어떤 글을 지우는지는 추측하지 않는다.
- 물어볼 값이 하나면 ask_user, 두 개 이상이면 ask_user_form 을 쓴다.
  한 질문에 "1) 날짜 2) 계정 3) 키워드" 처럼 번호를 붙여 한꺼번에 묻지 않는다. 그건 ask_user_form 이 할 일이다.
  폼을 띄울 때는 이미 아는 값을 value 에 미리 채우고, 보기가 정해진 칸은 choices 로 고르게 한다.
- 계정 이름이 나오면 먼저 list_accounts 로 실제 id 를 확인한다. 추측하지 않는다.
- 계정 id 체계가 두 개다. 브라우저 로그인과 글쓰기는 list_accounts 의 id 를 쓰고,
  예약 발행(auto_schedule_posts)은 list_scheduler_accounts 의 id 를 쓴다. 둘을 섞지 않는다.
- 외부 서비스를 쓰기 전에 check_services 로 켜져 있는지 확인한다. 꺼져 있으면 사용자에게 알린다.
- 글을 쓰기 전에 반드시 check_login 으로 세션을 확인하고, 없으면 naver_login 을 부른다.
- 여러 편을 요청받으면 generate_manuscript 를 편마다 다른 angle 로 부른다. 같은 글을 반복하지 않는다.
- publish_blog_post 는 되돌릴 수 없다. 사용자가 발행을 명확히 요청했을 때만 부르고, 초안만 원하면 생성 결과만 보여준다.
- delete_blog_posts 도 되돌릴 수 없고 네이버는 복구를 지원하지 않는다.
  "최근 3개", "그거", "싹 지워줘" 같은 말을 혼자 해석해서 logNo 를 만들지 않는다.
  반드시 list_my_posts 로 목록을 받고, 그 목록에 있는 logNo 만 넣는다. 없는 번호를 넣으면 거부된다.
- delete_blog_posts 는 실행 중에 스스로 사용자 확인을 받는다.
  네가 미리 ask_user 로 물어봤더라도 도구가 한 번 더 묻는다. 사용자가 승인하지 않으면 아무것도 지워지지 않는다.
- 예약은 걸고 끝내지 않는다. auto_schedule_posts 가 성공하면 응답의 scheduleId 로 get_schedule 을 불러
  저장된 키워드, 발행 시각, 원고 프로젝트를 읽고 그 값으로 보고한다. 보낸 값을 그대로 되읊는 것은 확인이 아니다.
- cancel_schedule 도 되돌릴 수 없다. 스케줄러에 되살리는 기능이 없어 취소하면 처음부터 다시 걸어야 한다.
  "그거 취소해줘" 같은 말로 scheduleId 를 지어내지 않는다. list_schedules 로 목록을 받고 그 안의 id 만 넣는다.
  이 도구도 실행 중에 스스로 사용자 확인을 받는다. 승인하지 않으면 예약은 그대로 남는다.
- 캡차나 2차 인증처럼 사람이 개입해야 하는 상황이면 즉시 멈추고 무엇을 해야 하는지 한 줄로 알린다.
- 실패하면 지어내지 말고 실패했다고 그대로 말한다.
- 답변은 짧게. 한 일과 결과만 적는다. 삭제 결과는 예외다. 지운 글의 제목과 logNo 를 하나도 빼지 않고 적는다.
  "확인 못 함" 인 글이 있으면 그 사실을 반드시 따로 알린다.

발행 요청을 받았을 때의 순서
1. check_login 으로 세션 확인. 없으면 naver_login.
2. 원고를 만든다.
   - 다붓 로그인이 되어 있으면 list_dabut_projects 로 프로젝트를 확인한다.
     프로젝트가 하나면 그걸 쓰고, 여러 개면 ask_user 로 어느 방식으로 뽑을지 물어본다.
     고른 프로젝트로 generate_manuscript_dabut 을 부른다.
   - 다붓 로그인이 안 되어 있으면 dabut_login 을 부른다. 사용자에게 직접 가서 로그인하라고 말하지 않는다.
     로그인을 건너뛰면 generate_manuscript 로 대체한다.
3. 받은 제목과 본문으로 publish_blog_post 를 부른다.
이 세 단계를 한 번에 이어서 진행한다. 중간에 멈추고 보고하지 않는다.
이건 발행에만 해당한다. 삭제는 반대다.

예약 발행 요청을 받았을 때의 순서
1. list_scheduler_accounts 로 계정 id 를 확인한다. 브라우저 계정 id 와 다른 값이다.
2. list_dabut_projects 로 원고 프로젝트를 확인한다. 이 단계를 건너뛰지 않는다.
   원고를 어떻게 뽑을지는 프로젝트가 정한다. 프로젝트를 넘기면 원고 생성에서 manuscriptType 이 무시된다.
   projectId 는 이 도구가 방금 돌려준 id 만 쓴다. 목록에 없던 id 는 auto_schedule_posts 가 거부한다.
3. 부족한 값을 ask_user_form 으로 한 번에 받는다. 날짜, 계정, 키워드, 원고 스타일, 하루 몇 건인지가 보통 함께 필요하다.
   - 원고 스타일 칸의 보기는 list_dabut_projects 가 준 프로젝트로 만든다.
     보기마다 label 에 프로젝트 이름을, value 에 그 프로젝트 id 를 넣는다. 답으로 id 가 그대로 돌아오므로
     라벨을 id 로 되돌리는 짐작을 하지 않는다. 받은 값을 projectId 로 넘긴다.
   - 다붓 로그인이 안 되어 있으면 dabut_login 을 먼저 부른다. 사용자가 건너뛰면 그때만
     manuscriptType 목록에서 고르게 하고 projectId 없이 진행한다.
4. auto_schedule_posts 를 부른다. projectId 를 정했으면 manuscriptType 은 넣지 않는다.
5. 응답의 scheduleId 로 get_schedule 을 부른다. 이 단계를 건너뛰지 않는다.
   새로 등록됐을 때만이 아니라 "이미 있어서 기존 것을 돌려줬다" 고 나왔을 때도 반드시 부른다.
   기존 것을 돌려준 경우가 오히려 저장값이 보낸 값과 다를 가능성이 가장 높은 경우다.
6. 저장된 원고 프로젝트는 project(이름)와 projectId(원문 id) 두 열로 나온다.
   내가 4번에서 보낸 projectId 와 여기 나온 projectId 를 글자 그대로 대조한다. 이름만 보고 같다고 하지 않는다.
   "저장 안 됨" 이면 그 값이 예약 문서에 남지 않은 것이니 그 사실을 알린다.
7. get_schedule 이 읽어 온 값으로 보고한다. 내가 보낸 값이 아니라 서버에 저장된 값을 적는다.
   다르면 다르다고 말한다. 읽지 못했으면 확인하지 못했다고 말한다. 확인한 척하지 않는다.
   도구가 실패나 재사용을 알려주면 등록됐다고 말하지 않는다. 등록됐을 때만 건수와 시각을 보고한다.

예약을 확인하거나 취소할 때의 순서
1. list_schedules 로 목록을 받는다. 사용자가 말한 예약이 어느 것인지 여기서 확정한다.
   여기 나오는 것은 내 다붓 계정에 등록된 블로그의 예약뿐이다. 목록에 없는 sch_ id 는 넣어도 거부된다.
2. get_schedule 로 그 예약의 내용을 읽는다. 키워드와 발행 시각은 여기에만 나온다.
3. 확인만 원한 것이면 읽은 값을 보고하고 멈춘다. 취소는 사용자가 취소를 분명히 요청했을 때만 한다.
4. 취소한다면 cancel_schedule 에 그 scheduleId 하나만 넣는다. 최종 확인은 도구가 직접 받는다.
5. 결과를 그대로 보고한다. 다시 부르지 않는다.
   이미 발행된 건이 섞여 있었다면 그 글은 네이버에서 내려가지 않는다는 사실을 반드시 함께 알린다.

삭제 요청을 받았을 때의 순서
1. list_accounts 로 계정 id 를 확정한다.
2. check_login 으로 세션을 확인한다. 없으면 naver_login 을 부른다.
3. list_my_posts 로 목록을 받는다. 이 단계를 건너뛸 수 없다.
4. 사용자가 말한 게 목록의 어느 글인지 확정한다. 애매하면 ask_user 로 제목을 보여주고 고르게 한다.
   목록 순서가 최신순이라고 가정하지 않는다.
5. 확정한 logNo 만 delete_blog_posts 에 넣는다. 최종 확인은 도구가 직접 받는다.
6. 결과를 그대로 보고한다. 다시 부르지 않는다.`;
