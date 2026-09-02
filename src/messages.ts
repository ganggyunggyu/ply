/**
 * 사용자에게 보이는 문장을 전부 여기 모은다.
 * 말투를 고치고 싶으면 이 파일만 고치면 된다. 다른 파일에 문장을 직접 쓰지 않는다.
 * 모델이 읽는 도구 설명과 시스템 프롬프트는 prompts.ts 에 있다.
 */

export const ONBOARDING = {
  askApiKeyFirst: '시작하려면 OpenRouter 키가 하나 필요해요.',
  askApiKeyMidTask: '먼저 OpenRouter 키를 넣어주세요. 넣으면 하던 일을 이어서 할게요.',
  apiKeyHint: '입력한 키는 이 컴퓨터에만 저장돼요.',
  apiKeyPlaceholder: 'sk-or-v1-...',
  apiKeySaveLabel: '저장',
  apiKeyIssueLabel: '키 만들러 가기',
  apiKeySaved: '저장했어요.',

  askAccountAfterKey: '이제 네이버 계정을 등록해 주세요.',
  askAccountOnStart: '네이버 계정만 등록하면 바로 시작할 수 있어요.',

  askServiceLogin: '다붓 계정으로 로그인하면 원고 생성과 예약 발행까지 쓸 수 있어요.',
  serviceLoginSaved: (label: string) => `${label} 으로 로그인했어요.`,
  askCookieLogin: '자주 쓰는 화면도 미리 로그인해둘까요? 누르면 탭으로 열어드려요.',
  cookieLoginDone: '로그인은 열린 탭에서 하시면 돼요. 한 번만 하면 계속 기억해요.',
  readyWithoutServices: '준비됐어요. 설정에서 서비스 주소를 넣으면 화면도 대신 열어드려요.',
  accountIdPlaceholder: '네이버 아이디',
  accountPwPlaceholder: '비밀번호 (선택)',
  accountHint: '비밀번호까지 넣으면 로그인도 대신 해드려요.',
  accountSaveLabel: '등록',
  accountSkipLabel: '나중에',
  accountSkipped: '네, 나중에 하셔도 돼요.',
  accountSaved: (naverId: string) => `${naverId} 등록했어요. 무엇을 도와드릴까요?`,

  ready: '준비됐어요. 무엇을 도와드릴까요?',
  readyShort: '무엇을 도와드릴까요?',
} as const;

export const EMPTY_STATE = {
  title: '이런 걸 시킬 수 있어요',
  samples: [
    'myblog01 계정 로그인해줘',
    '강아지유치원 키워드로 글 2개 초안 만들어줘',
    '서비스 상태 확인해줘',
  ],
} as const;

export const CHAT = {
  roleAgent: '에이전트',
  roleUser: '나',
  roleProgress: '진행',
  roleSystem: '시스템',
  running: '실행 중',
  thinking: '생각하는 중',
  toolRunning: '실행 중',
  answerPlaceholder: '답변',
  answerSubmitLabel: '보내기',
  composerPlaceholder: '무엇을 도와드릴까요?',
  composerHint: '⌘↵ 실행',
  servicesUp: (n: number, total: number) => `연동 ${n}/${total}`,
  modelChipTitle: '설정에서 모델을 바꿀 수 있어요',
  sendLabel: '↑',
  sendRunningLabel: '·',
  toolDone: (name: string) => `${name} 완료`,
  toolFailed: (name: string) => `${name} 실패`,
  stoppedTooLong: '여기까지 하고 멈췄어요. 다시 시켜주시겠어요?',
  answerExpired: '답변을 기다리는 시간이 지나서 이 질문은 이미 닫혔어요. 다시 시켜주세요.',
} as const;

export const PANEL = {
  title: '에이전트',
  settingsToggle: '설정',
  apiKeyField: 'OpenRouter 키',
  agentModelField: '에이전트 모델',
  writerModelField: '원고 모델',
  endpointsField: '연동 서비스',
  dabutPlaceholder: '다붓 백엔드 주소',
  schedulerPlaceholder: '블로그 스케줄러 주소',
  exposurePlaceholder: '노출지기 저장소 경로',
  endpointsSaveLabel: '저장',
  serviceUrlsField: '서비스 주소',
  serviceUrlsSaveLabel: '주소 저장',
  accountsField: '네이버 계정',
  accountLabelPlaceholder: '부를 이름 (예: 메인 계정)',
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
  panelToggleLabel: '에이전트 패널',
  cdpOn: (port: number) => `CDP ${port}`,
  cdpOff: 'CDP 꺼짐',
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
  keyStatusSaved: '키 저장됨',
  keyStatusMissing: '키를 먼저 저장하세요',
  accountsEmpty: '등록된 계정 없음',
  accountRemoveLabel: '삭제',
  accountPasswordSaved: '비번 저장됨',
  accountManualLogin: '수동 로그인',
  profilePrompt: '프로필 이름 (계정별로 세션이 분리됩니다)',
  endpointsSaved: '연동 주소 저장됨',
  serviceUrlsSaved: '서비스 주소 저장됨',
  serviceUrlsHint: '비워두면 기본값을 써요. 주소는 이 컴퓨터에만 저장돼요.',
  serviceUrlsEmpty: '서비스 목록 없음',
  serviceUrlInvalid: (name: string) => `${name} 주소는 http:// 또는 https:// 로 시작해야 해요.`,
  serviceLoginField: '다붓 계정',
  serviceUserPlaceholder: '다붓 아이디',
  servicePassPlaceholder: '비밀번호',
  serviceLoginLabel: '로그인',
  serviceLoggedIn: (label: string) => `${label} 으로 로그인됨`,
  serviceLoginHint: '비밀번호는 저장하지 않아요. 받은 토큰만 이 컴퓨터에 암호화해서 둡니다.',
  exposurePathMissing: '노출체크를 쓰려면 저장소 경로가 필요해요.',
} as const;

export const ERRORS = {
  safeStorageUnavailable: '이 기기에서 안전 저장소를 쓸 수 없어요. 비밀번호는 저장하지 않았어요.',
  naverIdRequired: '네이버 아이디를 넣어주세요.',
  apiKeyRequired: 'OpenRouter 키를 먼저 저장해 주세요.',
  apiKeyRejected: '키가 맞지 않아요. 오픈라우터에서 다시 확인해 주세요.',
  apiKeyNoCredit: '오픈라우터 잔액이 부족해요. 충전하고 다시 시도해 주세요.',
  apiKeyRateLimited: '요청이 너무 잦아요. 잠시 뒤에 다시 시켜주세요.',
  modelUnavailable: (model: string) => `${model} 모델을 지금 쓸 수 없어요. 설정에서 다른 모델을 골라보세요.`,
  openRouterDown: '오픈라우터가 응답하지 않아요. 잠시 뒤에 다시 시켜주세요.',
  networkUnreachable: '네트워크에 연결하지 못했어요.',
  windowNotReady: '브라우저 창이 아직 준비되지 않았어요.',
  agentBusy: '지금 다른 작업이 돌고 있어요. 끝나면 이어서 할게요.',

  accountsFileUnreadable: '계정 파일을 읽지 못했습니다',
  settingsFileUnreadable: '설정 파일을 읽지 못했습니다',
  profilesFileUnreadable: '프로필 파일을 읽지 못했습니다',

  toolArgsUnparsable: (raw: string) => `도구 인자를 JSON으로 읽지 못했습니다: ${raw}`,
  openRouterNoChoices: 'OpenRouter 응답에 choices가 없습니다',
  unknownTool: (name: string) => `알 수 없는 도구: ${name}`,

  tabNotFound: '해당 탭을 찾지 못했습니다. 탭이 닫혔을 수 있습니다.',
  pageNotFound: '브라우저에서 해당 탭을 찾지 못했습니다',
  mainFrameNotFound: '스마트에디터 화면을 찾지 못했습니다',
  sessionExpired: '로그인 세션이 만료되었습니다',
  loginButtonNotFound: '로그인 버튼을 찾지 못했습니다. 네이버 로그인 화면이 바뀌었을 수 있습니다.',
  publishButtonNotFound: '발행 버튼을 찾지 못했습니다',
  publishConfirmNotFound: '발행 확인 버튼을 찾지 못했습니다',
  questionTimeout: '답을 기다리다 시간이 지나 중단했습니다',
  blogIdNotResolved: '내 블로그 주소를 확인하지 못했습니다',
  postListUnreadable: '블로그 글 목록을 읽지 못했습니다',
  postListRateLimited: '네이버가 목록 요청을 막았습니다. 잠시 뒤에 다시 시도해야 합니다',
  postTitleUnreadable: '글 제목을 읽지 못했습니다',
  deleteButtonNotFound: '글 삭제 버튼을 찾지 못했습니다',
  deleteAmbiguousTarget: '한 화면에 글이 여러 개라 삭제 대상을 하나로 좁히지 못했습니다',
  deleteAmbiguousDetail: (exact: number, links: number, rendered: number) =>
    `삭제 대상을 하나로 좁히지 못했습니다 (번호 일치 링크 ${exact}, 전체 삭제 링크 ${links}, 본문 블록 ${rendered})`,
  deleteStillThere: '삭제한 뒤에도 글이 목록에 그대로 남아 있습니다',
  deleteFailed: '글을 지우는 중에 문제가 생겼습니다',

  scriptNameRejected: (script: string) => `실행할 수 없는 스크립트 이름입니다: ${script}`,
  exposureDirMissing: '노출지기 저장소 경로가 설정되지 않았습니다. 설정에서 지정하세요.',
  exposureDirInvalid: (dir: string) => `노출지기 저장소를 찾지 못했습니다: ${dir}`,
  commandTimeout: (script: string) => `시간 초과로 중단했습니다: ${script}`,
} as const;

/** 승인 토큰은 자기참조가 안 되니 모듈 상수로 뺀다. */
const DELETE_YES = '네, 삭제할게요';

export const CONFIRM = {
  deleteYes: DELETE_YES,
  deleteNo: '취소',
  deleteLine: (index: number, title: string, addDate: string, logNo: string) =>
    `${index}. ${title} — ${addDate} (${logNo})`,
  deleteQuestion: (blogId: string, lines: string[]) =>
    [
      `${blogId} 블로그에서 아래 글을 영구 삭제해요. 네이버는 복구를 지원하지 않아요.`,
      ...lines,
      `지우려면 "${DELETE_YES}" 를 눌러주세요. 다른 답은 전부 취소로 처리해요.`,
    ].join('\n'),
} as const;

export const PROGRESS = {
  loginTabOpening: (label: string) => `${label} 로그인 탭 여는 중`,
  loginFilling: '로그인 정보 입력 중',
  manuscriptGenerating: (keyword: string) => `원고 생성 중: ${keyword}`,
  dabutGenerating: (keyword: string) => `다붓 원고 생성: ${keyword}`,
  publishStarting: (label: string, title: string) => `${label} 글 발행 시작: ${title}`,
  scheduleRegistering: (date: string, count: number) => `예약 발행 등록: ${date} / ${count}건`,
  exposureStarting: (label: string) => `노출체크 시작: ${label}`,
  editorOpening: '에디터 여는 중',
  titleTyping: '제목 입력',
  bodyTyping: '본문 입력',
  publishDialogOpening: '발행 레이어 여는 중',
  publishConfirming: '발행 확정',
  postListLoading: (label: string) => `${label} 글 목록 읽는 중`,
  deleteConfirmWaiting: (count: number) => `삭제 확인 대기 중: ${count}건`,
  deleting: (title: string) => `삭제 중: ${title}`,
  deleteVerifying: (title: string) => `삭제 확인 중: ${title}`,
  pnpmViaShell: '셸을 거쳐 pnpm 을 찾는 중',
  pnpmFound: (path: string) => `pnpm: ${path}`,
} as const;

export const SERVICE_LABELS = {
  dabut: '다붓 백엔드(원고 생성)',
  scheduler: '블로그 스케줄러(예약 발행)',
  exposure: '노출지기(노출체크)',
  exposureUnset: '(미설정)',
  exposureOk: '저장소 확인됨',
  exposureNoPackageJson: '경로에 package.json 이 없습니다',
  exposureNotConfigured: '설정에서 노출지기 저장소 경로를 지정하세요',
  schedulerAuth: '다붓 계정',
  schedulerAuthOk: '로그인됨',
  schedulerAuthMissing: '다붓 계정으로 로그인하면 원고 생성과 예약 발행이 열립니다',
} as const;
