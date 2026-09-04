export const RESULT_PRESET = {
  presetUnreadable:
    '노출지기가 준 프리셋을 읽지 못했다. targets 가 배열이 아니다. 아무것도 저장하지 않았다. 빈 값으로 덮어쓰면 사용자가 켜 둔 대상이 전부 날아간다. 사용자에게 노출지기 화면에서 설정을 확인해 달라고 알릴 것.',
  unknownPresetAction: (value: string) => `${value} 는 이 도구가 아는 동작이 아니다.`,

  cafeCheckLabelRequired: 'label 이 비어 있다. 사람이 부를 이름을 넣을 것.',
  cafeCheckSheetUrlInvalid:
    'sheetUrl 이 구글시트 주소가 아니다. /spreadsheets/d/ 가 들어간 전체 주소를 그대로 넣을 것. 주소를 지어내지 말고 모르면 사용자에게 물어볼 것.',
  cafeCheckTabRequired: 'tabTitle 이 비어 있다. 시트 안의 탭 이름을 넣을 것.',
  cafeCheckTargetsRequired:
    'targets 가 비어 있다. 노출을 확인할 카페나 블로그 주소를 하나 이상 넣을 것.',
  cafeCheckTooManyTargets: (max: number) => `주소는 ${max}개까지만 넣을 수 있다.`,
  cafeCheckCommaTarget:
    '주소에 쉼표가 들어 있다. 노출지기가 쉼표로 이어 붙여 봇에 넘기기 때문에 값 안의 쉼표는 두 개로 쪼개진다. 쉼표 없이 넣을 것.',
  cafeCheckLimit: (max: number) =>
    `카페 노출체크는 ${max}개까지만 만들 수 있다. 안 쓰는 것을 remove_cafe_check 로 먼저 지울 것.`,
  cafeCheckIdRequired: 'checkId 가 비어 있다. 프리셋의 cafeChecks[].id 를 넣을 것.',
  cafeCheckNotFound: (id: string) =>
    `${id} 라는 카페 노출체크가 프리셋에 없다. id 를 지어내지 말고 지금 있는 목록을 먼저 확인할 것.`,

  targetIdRequired: 'targetId 가 비어 있다. 프리셋의 targets[].id 를 넣을 것.',
  targetNotFound: (id: string, known: string[]) =>
    `${id} 는 이 계정의 프리셋에 없는 대상이다. 있는 것은 ${known.join(', ') || '없다'}. 대상 id 는 코드에 박혀 있어서 새로 만들 수 없다. 새 대상이 필요하다면 read_api_doc 의 limits 를 읽고 사용자에게 설명할 것.`,
  targetAlreadyInState: (label: string, enabled: boolean) =>
    `${label} 은 이미 ${enabled ? '켜져' : '꺼져'} 있다. 아무것도 하지 않았다. 다시 부르지 말고 사용자에게 그대로 알릴 것.`,

  blogGroupLabelRequired: 'label 이 비어 있다. 그룹 이름을 넣을 것.',
  blogGroupIdsRequired: 'blogIds 가 비어 있다. 블로그 아이디를 하나 이상 넣을 것.',
  blogGroupTooMany: (max: number) => `한 그룹에 블로그는 ${max}개까지만 넣을 수 있다.`,
  blogGroupAllDropped: (dropped: string[]) =>
    `준 blogIds 가 전부 블로그 아이디 모양이 아니라 노출지기가 하나도 저장하지 않는다: ${dropped.slice(0, 5).join(', ')}${dropped.length > 5 ? ' 외' : ''}. 아무것도 저장하지 않았다. 아이디는 영문 소문자·숫자·_·- 로 2~40자이거나 blog.naver.com 주소여야 한다. 값을 고쳐 지어내지 말고 사용자에게 무엇을 넣을지 물어볼 것.`,

  doorayUrlRequired: 'url 이 비어 있다.',
  doorayUrlNotHttps: 'Dooray 웹훅은 https 주소만 받는다.',

  summaryCafeCheckAdded: (label: string, id: string) => `카페 노출체크 추가: ${label} (id: ${id})`,
  summaryCafeCheckSheet: (tabTitle: string) => `읽고 쓸 탭: ${tabTitle}`,
  summaryCafeCheckTargets: (targets: string[]) =>
    `확인할 곳 ${targets.length}개: ${targets.slice(0, 5).join(', ')}${targets.length > 5 ? ' 외' : ''}`,
  summaryCafeCheckRemoved: (label: string, id: string) => `카페 노출체크 삭제: ${label} (id: ${id})`,
  summaryTargetToggled: (label: string, id: string, enabled: boolean) =>
    `${label} (${id}) 대상을 ${enabled ? '켠다' : '끈다'}`,
  summaryBlogGroupAdded: (label: string, id: string, count: number) =>
    `계정 그룹 추가: ${label} (id: ${id}, 블로그 ${count}개)`,
  summaryBlogIdsDropped: (dropped: string[]) =>
    `아이디 모양이 아니라 뺀 값 ${dropped.length}개: ${dropped.slice(0, 5).join(', ')}${dropped.length > 5 ? ' 외' : ''}`,
  summaryDoorayChanged: (had: boolean) =>
    had ? 'Dooray 웹훅 주소를 바꾼다 (기존 주소는 사라진다)' : 'Dooray 웹훅 주소를 새로 넣는다',

  // ---------- 저장 뒤 되읽기. 여기 문장만 "저장된 값" 으로 보고한다 ----------
  savedUnverified:
    '저장은 했는데 노출지기가 되돌려준 프리셋을 읽지 못해 무엇이 저장됐는지 확인하지 못했다. 저장됐다고 단정하지 말고 노출지기 화면에서 확인해 달라고 알릴 것.',
  savedMissing: (id: string) =>
    `저장 요청은 200 을 받았는데 되돌아온 프리셋에 ${id} 가 없다. 노출지기가 값을 버렸다는 뜻이다. 만들어졌다고 말하지 말고 이 사실을 그대로 알릴 것.`,
  savedCafeCheck: (label: string, id: string, tabTitle: string) =>
    `저장됨 — 카페 노출체크 ${label} (id: ${id}), 탭 ${tabTitle}`,
  savedCafeCheckTargets: (count: number) => `저장된 확인 대상: ${count}개`,
  savedRemoved: (id: string) => `저장됨 — ${id} 가 프리셋에서 사라진 것을 확인했다.`,
  savedStillPresent: (id: string) =>
    `저장 요청은 200 을 받았는데 ${id} 가 아직 프리셋에 남아 있다. 지워졌다고 말하지 말 것.`,
  savedBlogGroup: (label: string, id: string, count: number, blogIds: string[]) =>
    `저장됨 — 계정 그룹 ${label} (id: ${id}), 노출지기가 실제로 저장한 블로그 ${count}개: ${blogIds.slice(0, 5).join(', ')}${count > 5 ? ' 외' : ''}. 사용자에게는 이 숫자를 말할 것.`,
  savedBlogGroupEmpty: (label: string, id: string) =>
    `저장됨 — 그런데 계정 그룹 ${label} (id: ${id}) 에 블로그가 0개로 저장됐다. 노출지기가 아이디를 전부 버렸다는 뜻이고, 이 그룹을 쓰는 대상은 계정 0개로 조용히 돌아간다. 성공했다고 말하지 말고 이 사실을 먼저 알릴 것.`,
  savedTarget: (label: string, id: string, enabled: boolean) =>
    `저장됨 — ${label} (${id}) 이 ${enabled ? '켜짐' : '꺼짐'} 으로 저장된 것을 확인했다.`,
  savedTargetMismatch: (label: string, id: string, enabled: boolean) =>
    `저장 요청은 200 을 받았는데 ${label} (${id}) 이 ${enabled ? '켜짐' : '꺼짐'} 으로 남아 있다. 바꾸려던 것과 반대다. 바뀌었다고 말하지 말 것.`,
  savedDooray: (has: boolean) =>
    has
      ? '저장됨 — Dooray 웹훅 주소가 들어가 있는 것을 확인했다. 주소 자체는 읽지 않는다.'
      : '저장 요청은 200 을 받았는데 되돌아온 프리셋에 Dooray 웹훅이 없다. 저장됐다고 말하지 말 것.',
} as const;
