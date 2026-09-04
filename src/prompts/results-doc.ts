export const docResults = {
  // ---------- 문서와 읽기 ----------
  apiGetUnknownService: (value: string, allowed: string[]) =>
    `${value} 는 아는 서비스가 아니다. 아래 중에서 고를 것: ${allowed.join(', ')}`,
  apiGetPathRequired: 'path 가 비어 있다. 슬래시로 시작하는 경로를 넣을 것.',
  apiGetPathNotAllowed: (service: string, path: string) =>
    `${service} 의 ${path} 는 읽기 허용목록에 없다. 경로를 지어내지 말고 read_api_doc 으로 그 서비스에 어떤 경로가 있는지 먼저 읽을 것. 쓰기(POST, PUT, DELETE)는 이 도구로 아예 보낼 수 없다.`,
  apiGetNoAuth: (service: string) =>
    `${service} 에 로그인되어 있지 않아 읽을 수 없다. 다붓과 스케줄러는 dabut_login, 노출지기는 exposure_login 을 부를 것.`,
  apiGetNotFound: (service: string, path: string) =>
    `${service} 가 ${path} 에 404 를 줬다. 문서에 적힌 경로가 실제 서버와 다를 수 있다. 값을 지어내지 말고 그 사실을 사용자에게 그대로 알릴 것.`,
  apiGetFailed: (status: number, body: string) =>
    `읽지 못했다 (HTTP ${status}): ${body}. 아무것도 바뀌지 않았다.`,
  apiGetTruncated: (body: string) =>
    `${body}\n\n(응답이 길어서 여기까지만 잘랐다. 잘린 뒤의 내용은 모른다. 없는 값을 채워 넣지 말 것.)`,
} as const;
