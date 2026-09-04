export const coreResults = {
  cafeJoined: (name: string) => `${name} 카페에 가입했습니다.`,
  cafeJoinPending: (name: string) => `${name} 카페에 가입 신청했습니다. 운영자 승인을 기다려야 합니다.`,
  cafeAlreadyMember: (name: string) => `${name} 카페에는 이미 가입돼 있습니다.`,
  cafeJoinFailed: (name: string, detail: string) => `${name} 카페 가입에 실패했습니다: ${detail}`,
  cafeCommentPosted: (url: string) => `댓글을 등록했습니다. ${url}`,
  cafeCommentFailed: (detail: string) => `댓글을 등록하지 못했습니다: ${detail}`,
  cafeTargetMissing: '카페를 특정할 수 없습니다. cafeUrl 이나 cafeId 중 하나는 있어야 합니다.',
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
} as const;
