export const accountResults = {
  // ---------- 계정 관리 ----------
  accountActionUnknown: (value: string) =>
    `${value} 는 모르는 동작이다. add, change_password, remove 중에서 고를 것.`,
  accountIdRequired:
    'accountId 가 비어 있다. list_accounts 로 목록을 먼저 받고 그 안의 id 를 넣을 것.',
  accountNotListed: (id: string) =>
    `${id} 는 이번 실행에서 list_accounts 로 읽은 적 없는 계정이다. id 를 기억이나 짐작으로 만들지 말고 list_accounts 를 먼저 부를 것.`,
  accountCardNoAnswer:
    '사용자가 계정 카드에 답하지 않아 시간이 지났다. 아무것도 바뀌지 않았다. 다시 부르지 말고, 입력을 받지 못해 멈췄다고 한 줄로 알릴 것.',
  accountCardCancelled:
    '사용자가 계정 카드를 닫았다. 아무것도 바뀌지 않았다. 다시 부르지 말고 무엇을 할지 물어볼 것.',
  accountAdded: (label: string, id: string) =>
    `계정을 등록했다: ${label} (id: ${id}). 이 id 로 check_login 과 naver_login 을 부를 수 있다.`,
  /**
   * 두 곳을 반드시 따로 적는다. 한 줄로 뭉치면 모델이 "다 바꿨어요" 라고 보고하고,
   * 다붓에 반영되지 않은 채 예약 발행이 옛 비밀번호로 계속 죽는다.
   */
  accountPasswordChanged: (lines: string[]) =>
    [
      '비밀번호를 바꿨다. 저장한 곳은 아래와 같다. 사용자에게 두 곳을 각각 나눠서 알릴 것.',
      ...lines,
      '네이버 사이트의 실제 비밀번호를 바꾼 것이 아니라 우리 쪽 저장값을 갱신한 것이다. 사용자가 네이버에서 아직 안 바꿨다면 그 사실을 알릴 것.',
    ].join('\n'),
  accountLocalChanged: '로컬 저장소: 변경됨',
  accountDabutChanged: (name: string) => `다붓: 변경됨 (${name})`,
  accountDabutNoMatch: '다붓: 같은 아이디의 계정이 없어 로컬만 바뀜',
  accountDabutNoLogin: '다붓: 로그인이 안 되어 있어 손대지 못함. dabut_login 을 부르고 다시 시도할 것',
  accountDabutFailed: (detail: string) => `다붓: 실패함 (${detail}). 다붓 쪽은 옛 비밀번호 그대로다`,
  accountRemoveNotApproved: (answer: string) =>
    `사용자가 계정 삭제를 승인하지 않았다(답변: ${answer}). 계정은 그대로 있다. 다시 부르지 말고 무엇을 할지 물어볼 것.`,
  accountRemoveNoAnswer: (id: string) =>
    `${id} 계정 삭제 확인에 사용자가 답하지 않아 시간이 지났다. 거절한 것이 아니라 답이 없었던 것이다. 지우지 않았다. 다시 부르지 말고 확인을 받지 못해 멈췄다고 알릴 것.`,
  accountRemoved: (label: string, id: string) =>
    `${label} (${id}) 계정을 지웠다. 저장된 비밀번호도 함께 사라졌다. 브라우저 프로필과 로그인 쿠키는 그대로 남아 있으므로 그 프로필의 탭은 여전히 네이버에 로그인된 상태다. 이 사실을 사용자에게 함께 알릴 것.`,
  accountAlreadyAttempted: (id: string) =>
    `이번 실행에서 이미 ${id} 계정에 같은 작업을 했다. 다시 하지 말고 결과를 사용자에게 알릴 것.`,
  accountCardAlreadyDeclined:
    '이번 실행에서 사용자가 이미 계정 추가 카드를 되돌려보냈다. 비밀번호 칸을 다시 띄우지 말 것. 사용자가 새 계정 등록을 다시 말하기 전에는 이 도구를 add 로 부르지 않는다.',
} as const;
