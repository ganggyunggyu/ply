export const exposureResults = {
  // ---------- 노출지기 ----------
  exposureNotLoggedIn:
    '노출지기에 로그인되어 있지 않다. exposure_login 도구로 바로 로그인을 받아라. 사용자에게 직접 로그인하라고 말하지 말 것.',
  exposureSessionExpired:
    '노출지기 세션이 만료돼 저장된 쿠키를 지웠다. exposure_login 을 한 번 부르고 하려던 일을 이어서 할 것.',
  exposureLoginDone: (name: string) => `노출지기에 ${name} 으로 로그인됐다. 이어서 진행할 것.`,
  exposureLoginSkipped:
    '사용자가 노출지기 로그인을 건너뛰었다. 노출지기가 필요한 일은 할 수 없다는 것을 한 줄로 알리고 멈출 것.',
  exposureLoginNoAnswer:
    '사용자가 노출지기 로그인 카드에 답하지 않아 시간이 지났다. 로그인되지 않았다. 다시 부르지 말고 로그인이 필요하다는 것을 한 줄로 알리고 멈출 것.',
  exposureLoginAlreadyDeclined:
    '이번 실행에서 사용자가 이미 노출지기 로그인 카드를 되돌려보냈다. 비밀번호 칸을 다시 띄우지 말 것. 노출지기가 필요한 일은 할 수 없다고 알리고 멈춘다.',
  exposureRequestFailed: (detail: string) =>
    `노출지기 요청이 실패했다: ${detail}. 아무것도 바뀌지 않았다. 이 문장을 고치지 말고 그대로 사용자에게 전할 것.`,
  presetRejected: (detail: string) =>
    `노출지기가 저장을 거부했다: ${detail}. 이 문구는 노출지기가 사용자에게 보여주려고 쓴 것이다. 고쳐 쓰지 말고 그대로 전할 것. 아무것도 저장되지 않았다.`,
  presetSaved: (summary: string[]) =>
    ['프리셋을 저장했다. 바뀐 것은 아래와 같다.', ...summary].join('\n'),
  presetNotApproved: (answer: string) =>
    `사용자가 프리셋 변경을 승인하지 않았다(답변: ${answer}). 아무것도 저장되지 않았다. 다시 부르지 말고 무엇을 할지 물어볼 것.`,
  presetNoAnswer:
    '프리셋 변경 확인에 사용자가 답하지 않아 시간이 지났다. 거절한 것이 아니라 답이 없었던 것이다. 아무것도 저장되지 않았다. 다시 부르지 말 것.',
  presetChangedWhileWaiting:
    '사용자가 확인 카드를 읽는 동안 노출지기의 프리셋이 다른 곳에서 바뀌었다. PUT 은 전체 교체라서 지금 저장하면 그 변경이 조용히 사라진다. 아무것도 저장하지 않았다. 사용자에게 이 사실을 알리고, 계속할지 확인받은 뒤에 이 도구를 다시 부를 것.',
  exposureNoRemoteJobs:
    '노출지기에 돌릴 수 있는 항목이 하나도 없다. 이 계정의 프리셋에 켜진 대상도 카페 노출체크도 없다는 뜻이다. update_exposure_preset 으로 카페 노출체크를 만들거나 대상을 켤 수 있다고 알릴 것.',
  exposureRunNotApproved: (answer: string) =>
    `사용자가 노출체크 실행을 승인하지 않았다(답변: ${answer}). 아무것도 실행되지 않았다. 이건 실패가 아니라 사용자가 다른 것을 원한 것이다. 다시 부르지 말고 무엇을 하려던 것인지 물어볼 것. 새 체크를 만들려던 것이면 update_exposure_preset 이다.`,
  exposureRunNoAnswer:
    '노출체크 실행 확인에 사용자가 답하지 않아 시간이 지났다. 실행하지 않았다. 다시 부르지 말고 확인을 받지 못해 멈췄다고 알릴 것.',
  exposureRunBlocked: (label: string, reason: string) =>
    `${label} 은 지금 돌릴 수 없다: ${reason}. 실행하지 않았다. 기다렸다 다시 하라고 알릴 것.`,
  exposureRunStarted: (label: string, runId: string) =>
    `${label} 노출체크를 노출지기 서버에서 시작했다 (runId: ${runId}). 서버에서 도는 것이라 이 앱을 닫아도 계속 간다. 수 분에서 수십 분 걸린다. 결과는 노출지기 화면에서 확인한다고 알릴 것. 여기서 완료를 기다리지 말 것.`,
  exposureLocalFallback:
    '노출지기에 로그인되어 있지 않아 이 컴퓨터의 저장소에서 직접 돌렸다.',
} as const;
