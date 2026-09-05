/**
 * 사용자에게 보이는 문장을 전부 여기 모은다.
 * 말투를 고치고 싶으면 이 파일만 고치면 된다. 다른 파일에 문장을 직접 쓰지 않는다.
 * 모델이 읽는 도구 설명과 시스템 프롬프트는 prompts.ts 에 있다.
 */

export const ONBOARDING = {
  askApiKeyFirst: 'OpenRouter 키가 필요해요. 키 발급받기를 누르면 자동으로 만들어 저장해요. 이미 있으면 아래에 붙여 넣어 주세요.',
  askApiKeyMidTask: 'OpenRouter 키가 필요해요. 키 발급받기를 누르면 만들어 저장하고 작업을 이어갈게요. 이미 있으면 붙여 넣어 주세요.',
  apiKeyHint: '키는 이 컴퓨터에만 저장돼요.',
  apiKeyPlaceholder: 'sk-or-v1-...',
  apiKeySaveLabel: '저장',
  apiKeyIssueLabel: '키 발급받기',
  apiKeySaved: '저장했어요.',
  apiKeyIssuing: 'OpenRouter 에서 키를 발급받는 중…',
  apiKeyIssueLogin: '먼저 열린 탭에서 OpenRouter 에 로그인해 주세요. 로그인 뒤 다시 눌러요.',
  apiKeyIssued: '키를 발급받아 저장했어요.',
  apiKeyIssueFailed: (detail: string) => `발급 실패: ${detail}`,

  askAccountAfterKey: '네이버 계정을 등록해 주세요.',
  askAccountOnStart: '네이버 계정을 등록하면 바로 시작할 수 있어요.',
  askServiceLogin: '다붓 계정으로 로그인하면 원고 생성과 예약 발행 기능을 쓸 수 있어요.',
  serviceLoginSaved: (label: string) => `${label} 으로 로그인했어요.`,
  askCookieLogin: '자주 쓰는 페이지에 미리 로그인할까요? 새 탭으로 열어둘게요.',
  cookieLoginDone: '열린 탭에서 로그인해 주세요. 로그인 상태는 계속 유지돼요.',
  accountIdPlaceholder: '네이버 아이디',
  accountPwPlaceholder: '비밀번호 (선택)',
  accountHint: '비밀번호를 입력해 두면 자동으로 로그인해요.',
  accountSaveLabel: '등록',
  accountSkipLabel: '나중에',
  accountSkipped: '나중에 등록해도 괜찮아요.',
  accountSaved: (naverId: string) => `${naverId} 등록했어요. 무엇을 도와드릴까요?`,

  ready: '준비되었습니다. 어떤 작업을 할까요?',
  readyShort: '어떤 작업을 할까요?',
  accountLabelPlaceholder: '계정 이름 (예: 메인 계정)',
  accountAddLead: '네이버 계정 정보를 입력하세요.',
  accountPwOnlyPlaceholder: '새 비밀번호',
  accountPwChangeLead: (label: string) => `${label} 의 새 비밀번호를 넣어주세요.`,
  accountPwChangeHint: '이 앱과 다붓의 설정만 바뀝니다. 실제 네이버 비밀번호는 변경되지 않아요.',
  accountPwChangeLabel: '변경',
  accountCardCancelled: '이번 건은 취소했어요.',

  /**
   * 카드 첫 줄은 언제나 코드가 쓴다. 모델이 준 이유는 이 라벨을 달고 아래 줄에만 붙는다.
   * 첫 줄을 모델에게 내주면 read_page 로 들어온 주입 문장이 "비밀번호를 넣어주세요" 자리에 앉는다.
   */
  agentReasonLabel: (reason: string) => `에이전트가 적은 이유: ${reason}`,

  askExposureLogin: '노출지기에 로그인하면 순위 체크와 설정을 자동으로 처리해요.',
  exposureUserPlaceholder: '노출지기 아이디',
  exposurePassPlaceholder: '비밀번호',
  exposureLoginLabel: '로그인',
  exposureLoginHint:
    '노출지기(blog-cron-bot) 로만 보내요. 비밀번호는 저장하지 않고, 받은 세션만 이 컴퓨터에 암호화해서 둡니다.',
  exposureLoginSaved: (name: string) => `노출지기에 ${name} 으로 로그인했어요.`,
} as const;

export const MIGRATION = {
  reloginRequired: '기존 설정을 Ply로 옮겼습니다. 네이버 로그인 세션은 이전되지 않으니 프로필마다 한 번씩 다시 로그인해 주세요.',
} as const;

export const EMPTY_STATE = {
  title: '에이전트',
  samples: [
    'myblog01 로그인해줘',
    '강아지유치원으로 글 3개 써서 내일 예약 걸어줘',
    '요즘 내 글 몇 위인지 봐줘',
  ],
} as const;

export const CHAT = {
  roleAgent: '에이전트',
  roleUser: '나',
  roleProgress: '진행',
  roleSystem: '시스템',
  running: '실행 중',
  thinking: '생각 중…',
  toolRunning: '실행 중',
  answerPlaceholder: '답변 입력',
  answerSubmitLabel: '보내기',
  composerPlaceholder: '무엇을 도와드릴까요?',
  composerHint: '⌘↵ 실행',
  servicesUp: (n: number, total: number) => `연동 ${n}/${total}`,
  modelChipTitle: '설정에서 모델을 바꿀 수 있어요',
  servicesChipTitle: '설정에서 연동 상태를 볼 수 있어요',
  sendLabel: '↑',
  sendRunningLabel: '·',
  stopLabel: '■',
  stopTitle: '실행 중단',
  /** 진행 중이던 도구 하나는 끝까지 돈다. 그 사실을 숨기지 않는다. */
  cancelled: '여기서 멈췄어요. 하던 작업 하나는 끝까지 돌고 다음 단계로 넘어가지 않아요.',
  /** 버튼만 잠그면 씹혔다고 보고 앱을 강제 종료한다. 그게 발행·삭제를 진짜로 중간에 끊는 길이다. */
  cancelRequested: '정지를 눌렀어요. 하던 작업 하나가 끝나면 멈출게요.',
  toolDone: (name: string) => `${name} 완료`,
  toolFailed: (name: string) => `${name} 실패`,
  stoppedTooLong: '여기까지 하고 멈췄어요. 다시 시켜주시겠어요?',
  noOutput: '이번에는 아무 답도 오지 않았어요. 한 번 더 시켜주시겠어요?',
  // 칩 세 개가 좁은 패널을 나눠 쓴다. 비용까지 붙을 때는 앞말을 뺀다.
  usageChip: (tokens: string) => `토큰 ${tokens}`,
  usageChipWithCost: (tokens: string, cost: string) => `${tokens} · $${cost}`,
  usageChipTitle: '이 대화에서 쓴 토큰과 대략적인 비용이에요',
  answerExpired: '응답 대기 시간이 지나 종료되었습니다. 다시 시도해 주세요.',
  formSubmitLabel: '확인',
  formCancelLabel: '취소',
  formHint: '고른 값으로 바로 이어서 할게요.',
  formChoiceNone: '선택 안 함',
  formChoicePick: '선택하기',
  formCancelled: '이번 건은 취소했어요.',
  formFieldRequired: (label: string) => `${label} 칸을 채워주세요.`,
  formBadInput: (label: string) => `${label} 칸의 값을 다시 확인해 주세요.`,
} as const;

export const PANEL = {
  title: '에이전트',
  settingsToggle: '설정',
  apiKeyField: 'OpenRouter 키',
  agentModelField: '에이전트 모델',
  writerModelField: '원고 모델',
  endpointsField: '연동 서버 (도구 호출 주소)',
  dabutPlaceholder: '다붓 백엔드 주소',
  schedulerPlaceholder: '블로그 스케줄러 주소',
  exposurePlaceholder: '노출지기 저장소 경로',
  endpointsSaveLabel: '저장',
  accountsField: '네이버 계정',
  accountLabelPlaceholder: '계정 이름 (예: 메인 계정)',
  accountAddLabel: '추가',
} as const;

export const SIDEBAR = {
  tabLoading: '불러오는 중…',
  tabCloseLabel: '탭 닫기',
  addProfileLabel: '＋ 프로필 추가',
  groupTabs: '탭',
  groupAgentTabs: '에이전트 탭',
  newTabLabel: '새 탭',
  newTabTitle: '새 탭 (⌘T)',
  profileLabel: '프로필',
  libBookmarks: '북마크',
  libHistory: '방문기록',
  libSearchPlaceholder: '북마크·방문기록 검색',
  libEmpty: '없음. 설정에서 크롬 데이터를 가져와 보세요.',
  generalSession: '일반 브라우징',
} as const;

export const TOOLBAR = {
  backLabel: '뒤로',
  forwardLabel: '앞으로',
  reloadLabel: '새로고침',
  addressPlaceholder: '주소 또는 검색어',
  panelToggleLabel: '에이전트 패널',
  panelToggleTitle: '에이전트 패널 (⌘J)',
} as const;

export const SETTINGS = {
  modelSearchPlaceholder: '모델 검색',
  modelPickerSettings: '설정에서 더 보기',
  modelPickerEmpty: '맞는 모델이 없습니다',
  keyStatusSaved: '키 등록됨',
  keyStatusMissing: '키를 먼저 저장하세요',
  accountsEmpty: '등록된 계정 없음',
  accountRemoveLabel: '삭제',
  accountPasswordSaved: '비밀번호 저장됨',
  accountManualLogin: '수동 로그인',
  profilePrompt: '프로필 이름 (계정마다 브라우저 세션이 분리됩니다)',
  endpointsSaved: '연동 주소 저장됨',
  endpointsHint: '원고 생성·예약 발행·노출체크가 직접 부르는 곳이에요.',
  serviceLoginField: '다붓 계정',
  serviceUserPlaceholder: '다붓 아이디',
  servicePassPlaceholder: '비밀번호',
  serviceLoginLabel: '로그인',
  serviceLoggedIn: (label: string) => `${label} 으로 로그인됨`,
  serviceLoginHint: '비밀번호는 저장 안 해요. 받은 토큰만 이 컴퓨터에 암호화해 둬요.',
  viroTokenSaved: '바이로 토큰 저장됨',
  viroTokenHint: '바이로에서 발급한 에이전트 토큰. 다붓 로그인과 별개예요.',
  viroTokenField: '바이로 토큰',
  viroTokenPlaceholder: '바이로 에이전트 토큰',
  viroTokenSaveLabel: '저장',
  exposurePathMissing: '노출체크 저장소 경로를 입력해 주세요.',
  chromeImportField: '크롬에서 가져오기',
  chromeImportHint: '크롬 로그인 세션·북마크·방문기록을 가져와요. 저장된 비밀번호는 가져오지 않아요.',
  chromeImportButton: '가져오기',
  chromeImportProfilePrompt: '가져올 크롬 프로필',
  chromeImportTargetPrompt: '어느 Ply 프로필로 로그인 세션을 넣을지',
  chromeImportCookies: '로그인 세션(쿠키)',
  chromeImportBookmarks: '북마크',
  chromeImportHistory: '방문기록',
  chromeImportUnsupported: '크롬 가져오기는 지금 macOS 에서만 됩니다.',
  chromeImportNoProfiles: '설치된 크롬 프로필을 찾지 못했어요.',
  chromeImportKeychainNotice: 'macOS 가 키체인 접근을 물으면 허용을 눌러 주세요.',
  chromeImportRunning: '가져오는 중…',
  chromeImportDone: (cookies: number, bookmarks: number, history: number) =>
    `완료: 쿠키 ${cookies}건, 북마크 ${bookmarks}건, 방문기록 ${history}건`,
  shopField: 'Cafe24 쇼핑몰 계정',
  shopHint: '비밀번호는 암호화해 이 컴퓨터에만 둬요. 로그인은 저장한 계정으로만 해요.',
  shopAddLabel: '추가',
  shopEmpty: '등록된 쇼핑몰 계정 없음',
  shopRemoveLabel: '삭제',
  shopLoginLabel: '로그인',
  shopLabelPlaceholder: '계정 이름 (예: 한려담원)',
  shopUrlPlaceholder: '쇼핑몰 주소 (예: https://myshop.com)',
  shopIdPlaceholder: '쇼핑몰 아이디',
  shopPwPlaceholder: '비밀번호',
} as const;

export const ERRORS = {
  safeStorageUnavailable: '이 기기에서 안전 저장소를 쓸 수 없어요. 비밀번호는 저장하지 않았어요.',
  naverIdRequired: '네이버 아이디를 입력해 주세요.',
  shopBaseUrlRequired: '쇼핑몰 주소를 입력해 주세요.',
  shopMemberIdRequired: '쇼핑몰 아이디를 입력해 주세요.',
  passwordRequired: '비밀번호를 입력해 주세요.',
  apiKeyRequired: 'OpenRouter 키를 먼저 등록해 주세요.',
  apiKeyRejected: '키가 맞지 않아요. 오픈라우터에서 다시 확인해 주세요.',
  apiKeyNoCredit: '오픈라우터 잔액이 부족해요. 충전하고 다시 시도해 주세요.',
  apiKeyRateLimited: '요청이 너무 잦아요. 잠시 뒤에 다시 시켜주세요.',
  modelUnavailable: (model: string) => `${model} 모델을 지금 쓸 수 없어요. 설정에서 다른 모델을 골라보세요.`,
  openRouterDown: '오픈라우터가 응답하지 않아요. 잠시 뒤에 다시 시켜주세요.',
  /** 400 은 서버가 살아 있는데 우리 요청이 거절된 것이다. "응답하지 않아요" 로 덮으면 원인이 사라진다. */
  requestRejected: '요청이 거절됐어요. 대화가 너무 길거나 모델이 못 받는 형식일 수 있어요.',
  networkUnreachable: '네트워크에 연결하지 못했어요.',
  windowNotReady: '브라우저 창이 아직 준비되지 않았어요.',
  /**
   * 대기 큐가 없다. main 이 그냥 던지고 패널은 에러 카드를 찍은 뒤 메시지를 버린다.
   * "이어서 할게요" 는 지키지 못하는 약속이라, 사용자가 실제로 할 수 있는 것만 적는다.
   */
  agentBusy: '다른 작업을 진행 중입니다. 끝날 때까지 기다리거나 중단한 뒤 다시 요청해 주세요.',
  runCancelled: '작업을 취소했습니다',
  accountsFileUnreadable: '계정 파일을 읽을 수 없습니다',
  settingsFileUnreadable: '설정 파일을 읽을 수 없습니다',
  profilesFileUnreadable: '프로필 파일을 읽을 수 없습니다',
  toolArgsUnparsable: (raw: string) => `도구 인자를 JSON으로 읽지 못했습니다: ${raw}`,
  openRouterNoChoices: 'OpenRouter 응답에 choices 항목이 없습니다',
  unknownTool: (name: string) => `알 수 없는 도구: ${name}`,

  tabNotFound: '탭을 찾을 수 없습니다. 이미 닫혔을 수 있습니다.',
  pageNotFound: '브라우저 탭을 찾을 수 없습니다',
  mainFrameNotFound: '스마트에디터 화면을 찾을 수 없습니다',
  sessionExpired: '로그인 세션이 만료되었습니다',
  loginButtonNotFound: '로그인 버튼을 찾을 수 없습니다. 로그인 페이지 구조가 바뀌었을 수 있습니다.',
  publishButtonNotFound: '발행 버튼을 찾을 수 없습니다',
  publishConfirmNotFound: '발행 확인 버튼을 찾을 수 없습니다',
  questionTimeout: '응답 시간이 초과되어 중단했습니다',
  dabutLoginTimeout: '다붓 로그인 대기 시간이 초과되었습니다',
  accountCardTimeout: '계정 입력 대기 시간이 초과되었습니다',
  exposureLoginTimeout: '노출지기 로그인 대기 시간이 초과되었습니다',
  exposureNoCookie: '노출지기 세션 쿠키를 받지 못했습니다',
  blogIdNotResolved: '블로그 주소를 확인하지 못했습니다',
  postListUnreadable: '블로그 글 목록을 읽지 못했습니다',
  postListRateLimited: '네이버가 목록 요청을 막았습니다. 잠시 뒤에 다시 시도해야 합니다',
  postTitleUnreadable: '글 제목을 읽을 수 없습니다',
  deleteButtonNotFound: '글 삭제 버튼을 찾을 수 없습니다',
  deleteAmbiguousTarget: '삭제 대상 글을 특정할 수 없습니다',
  deleteAmbiguousDetail: (exact: number, links: number, rendered: number) =>
    `삭제 대상을 하나로 좁히지 못했습니다 (번호 일치 링크 ${exact}, 전체 삭제 링크 ${links}, 본문 블록 ${rendered})`,
  deleteStillThere: '삭제 후에도 글이 목록에 남아 있습니다',
  deleteFailed: '글을 삭제하지 못했습니다',
  scriptNameRejected: (script: string) => `실행할 수 없는 스크립트 이름입니다: ${script}`,
  exposureDirMissing: '노출지기 경로가 설정되지 않았습니다. 설정에서 지정해 주세요.',
  exposureDirInvalid: (dir: string) => `노출지기 저장소를 찾지 못했습니다: ${dir}`,
  commandTimeout: (script: string) => `시간 초과로 중단했습니다: ${script}`,
} as const;

/** 승인 토큰은 자기참조가 안 되니 모듈 상수로 뺀다. */
const DELETE_YES = '네, 삭제할게요';

/**
 * 계정 삭제 승인 토큰. 글 삭제(DELETE_YES)와 반드시 달라야 한다.
 * 값이 겹치면 한쪽 승인이 다른 쪽으로 샌다.
 */
const ACCOUNT_REMOVE_YES = '계정 삭제';

/** 노출체크 실행 승인 토큰. */
const EXPOSURE_RUN_YES = '지금 돌릴게요';

/** 프리셋 저장 승인 토큰. */
const PRESET_SAVE_YES = '이대로 저장할게요';

/**
 * 예약 취소 토큰. DELETE_YES 와 반드시 달라야 한다.
 * 값이 겹치면 글 삭제 승인이 예약 취소 승인으로 새거나 그 반대가 된다.
 */
const CANCEL_YES = '네, 예약을 취소할게요';

/** 이미 발행된 건이 섞여 있을 때만 붙인다. 취소해도 올라간 글은 내려가지 않는다. */
const cancelSchedulePublishedNote = (count: number) =>
  `이 중 ${count}건은 이미 발행됐어요. 올라간 글은 내려가지 않고 예약 기록만 취소로 바뀌어요.`;

/** 목록 줄에 들어갈 수 있는 최대 길이. 한 항목이 카드를 통째로 밀어내지 못하게 한다. */
const CONFIRM_FIELD_MAX = 120;

/**
 * 확인 카드는 줄 단위로 읽힌다. 그런데 여기 들어오는 제목·키워드는 네이버와 스케줄러에서 온
 * 남의 문자열이고, 개행이 그대로 통과하면 목록에 없던 줄을 만들거나 마지막 안내 줄 뒤에
 * 안심시키는 문장을 붙일 수 있다. 패널이 textContent 로 그려서 HTML 주입은 안 되지만
 * 줄 구조 위조는 되므로, 카드에 넣기 전에 공백류를 한 칸으로 접는다.
 */
const confirmField = (raw: string): string => {
  const folded = String(raw).replace(/\s+/g, ' ').trim();

  return folded.length > CONFIRM_FIELD_MAX ? `${folded.slice(0, CONFIRM_FIELD_MAX)}…` : folded;
};

export const CONFIRM = {
  deleteYes: DELETE_YES,
  deleteNo: '취소',
  deleteLine: (index: number, title: string, addDate: string, logNo: string) =>
    `${index}. ${confirmField(title)} — ${confirmField(addDate)} (${confirmField(logNo)})`,
  deleteQuestion: (blogId: string, lines: string[]) =>
    [
      `${confirmField(blogId)} 블로그에서 아래 글을 영구 삭제해요. 네이버는 복구를 지원하지 않아요.`,
      ...lines,
      `지우려면 "${DELETE_YES}" 를 눌러주세요. 다른 답은 전부 취소로 처리해요.`,
    ].join('\n'),

  cancelScheduleYes: CANCEL_YES,
  // "취소" 는 예약 취소 화면에서 중의적이라 쓰지 않는다. 예약을 취소하는 건지 대화를 접는 건지 헷갈린다.
  cancelScheduleNo: '그대로 둘게요',
  cancelSchedulePublished: cancelSchedulePublishedNote,
  cancelScheduleLine: (index: number, keyword: string, scheduledAt: string, status: string) =>
    `${index}. ${confirmField(keyword)} — ${confirmField(scheduledAt)} (${confirmField(status)})`,
  /** 예약이 내 다붓 계정 목록에 없을 때. 마스킹한 id 는 "내 계정 중 하나" 로 읽히므로 대신 이걸 쓴다. */
  cancelScheduleForeignAccount: '내 계정 목록에 없는 계정이에요',
  cancelScheduleQuestion: ({
    scheduleId,
    scheduleDate,
    account,
    lines,
    stoppable,
    published,
  }: {
    scheduleId: string;
    scheduleDate: string;
    account: string;
    lines: string[];
    /** 실제로 발행을 막을 수 있는 건수. 이미 끝났거나 실패한 건은 취소해도 달라지지 않는다. */
    stoppable: number;
    published: number;
  }) =>
    [
      stoppable > 0
        ? `${account} 계정의 ${scheduleDate} 예약 ${stoppable}건을 취소해요. 그 시각에 글이 올라가지 않아요. (예약에 담긴 전체는 ${lines.length}건이에요.)`
        : `${account} 계정의 ${scheduleDate} 예약 ${lines.length}건을 취소로 표시해요. 남은 발행 예정이 없어서 실제로 멈추는 글은 없어요.`,
      ...lines,
      ...(published > 0 ? [cancelSchedulePublishedNote(published)] : []),
      `되돌리는 기능이 없어서 다시 걸려면 처음부터 등록해야 해요. (${confirmField(scheduleId)})`,
      `취소하려면 "${CANCEL_YES}" 를 눌러주세요. 다른 답은 전부 그대로 두기로 처리해요.`,
    ].join('\n'),

  accountRemoveYes: ACCOUNT_REMOVE_YES,
  accountRemoveNo: '그대로 둘게요',
  /**
   * 삭제해도 프로필과 쿠키는 남는다는 사실을 반드시 적는다. accounts.remove 는 json 만
   * 필터하고 profiles.ts 는 건드리지 않는다. 안 적으면 "지웠으니 로그아웃됐겠지" 라는
   * 틀린 안심을 준다.
   */
  accountRemoveQuestion: ({ label, naverId, id }: { label: string; naverId: string; id: string }) =>
    [
      `${confirmField(label)} (${confirmField(naverId)}) 계정을 이 브라우저에서 지워요.`,
      '저장된 비밀번호도 같이 사라져서 자동 로그인을 더 못 해요.',
      '브라우저 프로필과 로그인 쿠키는 남아요. 그 프로필로 열린 탭은 여전히 네이버에 로그인된 상태예요.',
      `다붓에 등록된 계정은 건드리지 않아요. (${confirmField(id)})`,
      `지우려면 "${ACCOUNT_REMOVE_YES}" 를 눌러주세요. 다른 답은 전부 취소로 처리해요.`,
    ].join('\n'),

  exposureRunYes: EXPOSURE_RUN_YES,
  exposureRunNo: '아니요',
  exposureRunQuestion: (label: string) =>
    [
      `${confirmField(label)} 노출체크를 지금 시작해요. 수 분에서 수십 분 걸리고, 도는 동안 다른 노출체크를 못 돌려요.`,
      '설정을 바꾸거나 새 체크를 만들려던 것이면 "아니요" 를 눌러주세요.',
      `시작하려면 "${EXPOSURE_RUN_YES}" 를 눌러주세요. 다른 답은 전부 실행 안 함으로 처리해요.`,
    ].join('\n'),

  presetSaveYes: PRESET_SAVE_YES,
  presetSaveNo: '그대로 둘게요',
  /**
   * 프리셋은 통째로 교체된다. 손대지 않는 항목 수를 같이 보여줘야 사용자가
   * "나머지는 그대로구나" 를 알고 승인할 수 있다.
   */
  presetSaveQuestion: ({ lines, untouched }: { lines: string[]; untouched: number }) =>
    [
      '노출지기 설정을 이렇게 바꿔요.',
      ...lines.map((line) => `- ${confirmField(line)}`),
      untouched > 0
        ? `나머지 ${untouched}개 항목은 그대로 둬요. (노출지기는 설정을 통째로 저장해서 함께 다시 씁니다)`
        : '지금 저장된 다른 항목은 없어요.',
      `저장하려면 "${PRESET_SAVE_YES}" 를 눌러주세요. 다른 답은 전부 취소로 처리해요.`,
    ].join('\n'),
} as const;

export const PROGRESS = {
  cafeJoinStarting: (name: string) => `${name} 카페 가입을 시작합니다`,
  cafeCommentStarting: (articleId: string) => `${articleId} 번 글에 댓글을 답니다`,
  cafeStep: (step: string) => step,
  loginTabOpening: (label: string) => `${label} 로그인 탭 여는 중`,
  loginFilling: '로그인 정보 입력 중',
  manuscriptGenerating: (keyword: string) => `원고 생성 중: ${keyword}`,
  dabutGenerating: (keyword: string) => `다붓 원고 생성: ${keyword}`,
  publishStarting: (label: string, title: string) => `${label} 글 발행 시작: ${title}`,
  scheduleRegistering: (date: string, count: number) => `예약 발행 등록: ${date} / ${count}건`,
  exposureStarting: (label: string) => `노출체크 시작: ${label}`,
  editorOpening: '에디터 여는 중',
  titleTyping: '제목 입력 중',
  bodyTyping: '본문 입력 중',
  publishDialogOpening: '발행 창 여는 중',
  publishConfirming: '발행 완료 대기 중',
  postListLoading: (label: string) => `${label} 글 목록 읽는 중`,
  deleteConfirmWaiting: (count: number) => `삭제 확인 대기 중: ${count}건`,
  deleting: (title: string) => `삭제 중: ${title}`,
  deleteVerifying: (title: string) => `삭제 확인 중: ${title}`,
  scheduleListLoading: '예약 목록 불러오는 중',
  scheduleDetailLoading: (scheduleId: string) => `예약 내용 읽는 중: ${scheduleId}`,
  scheduleCancelConfirmWaiting: (scheduleId: string) => `예약 취소 확인 대기 중: ${scheduleId}`,
  scheduleCancelling: (scheduleId: string) => `예약 취소 중: ${scheduleId}`,
  accountCardWaiting: '계정 입력 대기 중',
  accountRemoveConfirmWaiting: (label: string) => `계정 삭제 확인 대기 중: ${label}`,
  exposureLoginWaiting: '노출지기 로그인 대기 중',
  exposurePresetLoading: '노출지기 설정 불러오는 중',
  exposurePresetConfirmWaiting: '설정 확인 대기 중',
  exposurePresetSaving: '노출지기 설정 저장 중',
  exposureJobsLoading: '노출체크 목록 불러오는 중',
  exposureRunConfirmWaiting: (label: string) => `노출체크 실행 확인 대기 중: ${label}`,
  exposureRemoteStarting: (label: string) => `노출지기 서버에서 시작: ${label}`,
  apiGetLoading: (service: string, path: string) => `${service} 읽는 중: ${path}`,
  pnpmViaShell: '셸에서 pnpm 찾는 중',
  pnpmFound: (path: string) => `pnpm: ${path}`,
} as const;

export const SERVICE_LABELS = {
  dabut: '다붓 백엔드(원고 생성)',
  scheduler: '블로그 스케줄러(예약 발행)',
  exposure: '노출지기(노출체크)',
  exposureUnset: '(미설정)',
  exposureOk: '저장소 연결됨',
  exposureNoPackageJson: '경로에 package.json 파일이 없습니다',
  exposureNotConfigured: '설정에서 노출지기 저장소 경로를 지정해 주세요',
  schedulerAuth: '다붓 계정',
  schedulerAuthOk: '로그인됨',
  schedulerAuthMissing: '다붓 계정으로 로그인하면 원고 생성과 예약 발행을 이용할 수 있습니다',
} as const;
