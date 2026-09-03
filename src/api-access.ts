/**
 * api_get 이 부를 수 있는 경로 허용목록.
 *
 * 읽기만 연다. 쓰기(POST/PUT/DELETE)를 범용 도구로 열지 않는 이유는 이 저장소의 코드에 있다.
 * 도구는 HTTP 래퍼가 아니라 서버에 없는 안전장치를 들고 있다 — cancel_schedule 의 소유자 확인,
 * delete_blog_posts 의 knownPosts 허용목록과 실행당 상한, auto_schedule_posts 의 knownProjectIds.
 * 범용 쓰기 도구를 주는 순간 그 검사들이 전부 우회된다.
 *
 * GET 은 다르다. 되돌릴 것이 없고, 인증은 코드가 붙이고, 경로는 여기서 가둘 수 있다.
 * 이 목록이 곧 권한이다. 여기 없는 경로는 서버에 존재해도 거부한다.
 */

export const API_SERVICES = ['dabut', 'scheduler', 'exposure'] as const;

export type ApiService = (typeof API_SERVICES)[number];

export const isApiService = (value: unknown): value is ApiService =>
  typeof value === 'string' && (API_SERVICES as readonly string[]).includes(value);

/** 경로 한 칸. id 나 키워드가 들어가는 자리다. 슬래시와 쿼리 기호는 못 들어온다. */
const SEG = '[^/?#]+';

/**
 * 읽어도 되는 경로. 정규식은 전체 일치다(^...$).
 *
 * 일부러 뺀 GET 이 셋 있다.
 * - 노출지기 /api/outputs/download: 파일 바이트를 대화에 부을 이유가 없다. open_service 로 화면을 연다.
 * - 노출지기 /api/runs/{id}/stream: SSE 라 응답이 끝나지 않는다.
 * - 다붓 /generate/image-batch/{id}/download: 같은 이유로 뺀다.
 */
export const API_READ_ALLOWLIST: Readonly<Record<ApiService, readonly RegExp[]>> = {
  dabut: [
    /^\/naver-accounts$/,
    /^\/naver-accounts\/categories$/,
    new RegExp(`^/naver-accounts/${SEG}$`),
    /^\/projects$/,
    /^\/projects\/categories$/,
    /^\/projects\/models$/,
    /^\/projects\/presets$/,
    /^\/projects\/steps$/,
    new RegExp(`^/projects/${SEG}$`),
    /^\/bot\/queue$/,
    /^\/bot\/queues$/,
    new RegExp(`^/bot/queue/${SEG}$`),
    /^\/bot\/pending$/,
    new RegExp(`^/bot/manuscript/${SEG}$`),
    /^\/bot\/batch-id$/,
    /^\/bot\/health$/,
    /^\/blog\/health$/,
    /^\/auth\/app\/me$/,
    /^\/auth\/app\/api-keys$/,
    /^\/auth\/naver\/status$/,
    /^\/auth\/naver\/health$/,
    /^\/generate\/image-models$/,
    /^\/generate\/gemini-cafe-daily\/personas$/,
    /^\/search\/manuscripts\/visible$/,
    /^\/search\/history$/,
    /^\/search\/popular$/,
    /^\/search\/stats$/,
    /^\/search\/autocomplete$/,
    /^\/search\/bookmarks$/,
    /^\/search\/bookmarks\/check$/,
    new RegExp(`^/search/manuscript/${SEG}$`),
    new RegExp(`^/manuscript/visibility/${SEG}/${SEG}$`),
    /^\/ref$/,
    new RegExp(`^/ref/${SEG}$`),
    new RegExp(`^/category/${SEG}$`),
  ],
  scheduler: [
    /^\/health$/,
    /^\/api\/auth\/me$/,
    /^\/api\/blog-accounts$/,
    new RegExp(`^/api/blog-accounts/${SEG}/credential-check$`),
    /^\/api\/content-pipelines$/,
    /^\/api\/content-pipelines\/blocks$/,
    /^\/api\/queues\/dashboard$/,
    /^\/queues\/stats$/,
    new RegExp(`^/api/queues/${SEG}/jobs$`),
    /^\/schedules$/,
    new RegExp(`^/schedules/${SEG}$`),
  ],
  exposure: [
    /^\/api\/health$/,
    /^\/api\/preset$/,
    /^\/api\/jobs$/,
    /^\/api\/runs$/,
    /^\/api\/outputs$/,
    /^\/api\/pm2$/,
    /^\/api\/accounts$/,
  ],
};

export const API_PATH_MAX_LENGTH = 200;

const hasBadShape = (value: string): boolean =>
  /[?#\s]/.test(value) || value.split('/').includes('..');

/**
 * 경로 모양 검사. 쿼리는 여기 못 붙인다. 모델이 문자열로 이어 붙이면 인코딩이 갈리고,
 * 그 자리에 개인정보가 실려 로그에 남는다. 쿼리는 별도 인자로 받아 코드가 인코딩한다.
 */
export const isWellFormedApiPath = (path: string): boolean => {
  if (!path.startsWith('/')) return false;
  if (path.length > API_PATH_MAX_LENGTH) return false;
  if (hasBadShape(path)) return false;

  // 인코딩을 풀어서 한 번 더 본다. 안 풀면 /ref/%2e%2e%2f%2e%2e%2fadmin 이 한 칸으로 보여
  // `[^/?#]+` 를 통과한다. 지금 서버들은 %2f 를 라우팅 전에 풀지 않지만, 허용목록이
  // "인코딩 안 한 모양" 만 검사한다는 사실에 기대는 것은 서버가 바뀌는 날 깨진다.
  let decoded: string;

  try {
    decoded = decodeURIComponent(path);
  } catch {
    // 잘못된 % 시퀀스. 우리가 못 읽는 경로는 서버에도 보내지 않는다.
    return false;
  }

  if (decoded !== path && (hasBadShape(decoded) || decoded.split('/').length !== path.split('/').length)) {
    return false;
  }

  return true;
};

export const isAllowedApiPath = (service: ApiService, path: string): boolean => {
  if (!isWellFormedApiPath(path)) return false;

  return API_READ_ALLOWLIST[service].some((pattern) => pattern.test(path));
};

/**
 * 응답에서 지우고 내보낼 키.
 *
 * 쓰기 도구는 이 값을 정확히 조심한다 — update_exposure_preset 은 두레이 웹훅을 바꿔도
 * 요약에 불리언만 적는다. 읽기에서 그 규율이 사라지면 `GET /api/preset` 한 번으로
 * 웹훅 주소(그 자체가 인증 토큰이다)가 모델 컨텍스트에 그대로 들어온다.
 *
 * 필드 화이트리스트가 아니라 블랙리스트인 이유: 허용목록의 경로들은 우리가 스키마를 고정하지
 * 않은 남의 서버가 준다. 서버가 필드를 늘리는 날 기본값이 "샌다" 가 되면 안 된다.
 */
const SECRET_KEY_PATTERN =
  /(password|passwd|secret|token|webhook|cookie|api[-_]?key|authorization|credential|private[-_]?key|refresh)/i;

/** 지운 자리에 남기는 표시. 값이 있었다는 사실만 알리고 값은 주지 않는다. */
export const REDACTED = '[가려짐]';

const REDACT_MAX_DEPTH = 12;

/**
 * 응답 본문에서 비밀 키를 재귀로 가린다. 키 이름만 보고 판단하므로 구조를 몰라도 돈다.
 * 배열 안의 객체도 본다. 깊이가 넘으면 더 내려가지 않고 통째로 가린다 — 못 본 곳을
 * 통과시키지 않는다.
 */
export const redactSecrets = (value: unknown, depth = 0): unknown => {
  if (depth > REDACT_MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      // 불리언은 비밀을 담을 수 없다. 다붓의 has_password 처럼 "값이 있느냐" 만 말하는
      // 깃발이고, accounts 문서가 그걸 읽으라고 시킨다. 가리면 문서가 시킨 일이 안 된다.
      SECRET_KEY_PATTERN.test(key) && typeof item !== 'boolean'
        ? REDACTED
        : redactSecrets(item, depth + 1),
    ]),
  );
};

/** 응답을 대화에 실을 때의 상한. 넘으면 잘라내고 잘렸다는 사실을 문장으로 붙인다. */
export const API_GET_MAX_CHARS = 4000;

export const clampApiBody = (raw: string): { text: string; truncated: boolean } =>
  raw.length <= API_GET_MAX_CHARS
    ? { text: raw, truncated: false }
    : { text: raw.slice(0, API_GET_MAX_CHARS), truncated: true };

/** 모델이 준 query 를 문자열 맵으로 좁힌다. 객체와 배열은 통과시키지 않는다. */
export const normalizeApiQuery = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) => {
      if (value === undefined || value === null) return [];
      if (typeof value === 'object') return [];

      return [[key, String(value)] as const];
    }),
  );
};
