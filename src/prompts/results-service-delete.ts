export const serviceDeleteResults = {
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
