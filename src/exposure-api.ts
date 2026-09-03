/**
 * 노출지기(blog-cron-bot 대시보드) 클라이언트.
 *
 * 다붓·스케줄러와 다르게 여기는 Bearer 가 아니라 httpOnly 쿠키 세션이다.
 * (dashboard/src/server/auth.ts 의 SESSION_COOKIE_NAME) 그래서 axios 기본 클라이언트를
 * 그대로 쓸 수 없고 Cookie 헤더를 손으로 싣는다.
 *
 * 쿠키 항아리 라이브러리를 붙이지 않는다. 필요한 것은 응답 헤더에서 값 하나를 뽑는 일뿐이고,
 * 그 값의 만료는 문자열만 봐도 알 수 있다(아래 isExposureCookieExpired).
 * 의존성을 늘리면 Electron 패키징까지 따라온다.
 */
import axios from 'axios';
import { ERRORS } from './messages';

export const EXPOSURE_COOKIE_NAME = 'dashboard_session';

/** dashboard/src/server/auth.ts 의 SESSION_MAX_AGE_SECONDS 와 같은 값. */
export const EXPOSURE_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Set-Cookie 헤더에서 세션 값을 뽑는다. 순수 함수다.
 *
 * 헤더는 `dashboard_session=<값>; Path=/; HttpOnly; ...` 모양이고 여러 줄이 올 수 있다.
 * 우리가 쓰는 것은 이름이 맞는 줄의 첫 세미콜론 앞부분뿐이다.
 */
export const readSessionCookie = (setCookie: readonly string[] | undefined): string | null => {
  if (!Array.isArray(setCookie)) return null;

  const prefix = `${EXPOSURE_COOKIE_NAME}=`;
  const line = setCookie.find((raw) => typeof raw === 'string' && raw.trimStart().startsWith(prefix));
  if (!line) return null;

  const value = line.trimStart().slice(prefix.length).split(';', 1)[0]?.trim() ?? '';

  return value || null;
};

/**
 * 쿠키가 이미 만료됐는가. 순수 함수다.
 *
 * 토큰이 `<발급시각>.<memberId>.<서명>` 이라(auth.ts 의 createSessionToken) 서버에 묻지 않고도
 * 만료를 안다. 서명은 여기서 검증할 수 없다(비밀키가 서버에만 있다). 그래서 이 함수는
 * "확실히 죽은 쿠키" 만 걸러내고, 나머지 판정은 서버의 401 에 맡긴다.
 */
export const isExposureCookieExpired = (cookie: string, now: number): boolean => {
  const parts = cookie.split('.');
  if (parts.length !== 3) return true;

  const [issuedAtRaw, memberId, signature] = parts;
  if (!issuedAtRaw || !memberId || !signature) return true;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return true;

  const age = now - issuedAt;

  return age < 0 || age > EXPOSURE_COOKIE_MAX_AGE_MS;
};

/** 서버가 세션을 거절했는가. 쿠키를 지우고 다시 로그인시켜야 하는 유일한 신호다. */
export const isExposureUnauthorized = (error: unknown): boolean =>
  (error as { response?: { status?: number } } | null)?.response?.status === 401;

/**
 * 대시보드의 4xx 본문은 `{ error }` 이고 그 문구는 화면에 그대로 보이라고 한국어로 쓴 것이다
 * (dashboard/src/app/api/preset/route.ts 참고). axios 메시지만 올리면 그게 사라진다.
 */
export const describeExposureError = (error: unknown): string => {
  const base = error instanceof Error ? error.message : String(error);
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;

  if (!data || typeof data !== 'object') return base;

  const { error: detail } = data as Record<string, unknown>;

  return typeof detail === 'string' && detail ? detail : base;
};

const cookieHeader = (cookie: string) => ({ Cookie: `${EXPOSURE_COOKIE_NAME}=${cookie}` });

type Session = { baseUrl: string; cookie: string };

/**
 * 로그인해서 세션 쿠키를 받는다. 비밀번호는 여기서만 쓰고 저장하지 않는다.
 * 쿠키가 7일짜리라 만료되면 사용자가 카드에 다시 입력한다.
 */
export const loginExposure = async ({
  baseUrl,
  loginId,
  password,
}: {
  baseUrl: string;
  loginId: string;
  password: string;
}): Promise<{ cookie: string; memberId: string }> => {
  const response = await axios.post(
    `${baseUrl}/api/auth/login`,
    { loginId, password },
    { timeout: 20_000 },
  );

  const raw = response.headers['set-cookie'] as string[] | undefined;
  const cookie = readSessionCookie(raw);
  if (!cookie) throw new Error(ERRORS.exposureNoCookie);

  const { memberId } = (response.data ?? {}) as Record<string, unknown>;

  return { cookie, memberId: memberId === undefined ? '' : String(memberId) };
};

export type ExposureMember = { id: string; loginId: string; displayName: string };

export type ExposurePresetPayload = { member: ExposureMember; preset: unknown };

const toMember = (raw: unknown): ExposureMember => {
  const { id, loginId, displayName } = (raw ?? {}) as Record<string, unknown>;

  return {
    id: id === undefined ? '' : String(id),
    loginId: loginId === undefined ? '' : String(loginId),
    displayName: displayName === undefined ? '' : String(displayName),
  };
};

export const readPreset = async ({ baseUrl, cookie }: Session): Promise<ExposurePresetPayload> => {
  const { data } = await axios.get(`${baseUrl}/api/preset`, {
    timeout: 15_000,
    headers: cookieHeader(cookie),
  });

  const { member, preset } = (data ?? {}) as Record<string, unknown>;

  return { member: toMember(member), preset };
};

/**
 * PUT /api/preset 은 전체 교체다. 병합은 부르는 쪽(exposure-preset.ts)이 이미 끝내고 온다.
 * 여기서 조각을 합치지 않는다. 합치는 자리가 둘이면 반드시 어긋난다.
 */
export const writePreset = async ({
  baseUrl,
  cookie,
  preset,
}: Session & { preset: unknown }): Promise<ExposurePresetPayload> => {
  const { data } = await axios.put(
    `${baseUrl}/api/preset`,
    { preset },
    { timeout: 20_000, headers: cookieHeader(cookie) },
  );

  const { member, preset: saved } = (data ?? {}) as Record<string, unknown>;

  return { member: toMember(member), preset: saved };
};

export type RemoteJob = {
  id: string;
  label: string;
  description: string;
  kind: string;
  isRunning: boolean;
  isBlocked: boolean;
  blockReason: string;
};

/**
 * 이 회원이 실제로 돌릴 수 있는 항목. 프리셋 기준으로 서버가 걸러 준다.
 * 로컬 package.json 파싱과 달리 직접 만든 카페 체크(cafe-check:*)도 여기 들어 있다.
 */
export const listRemoteJobs = async ({ baseUrl, cookie }: Session): Promise<RemoteJob[]> => {
  const { data } = await axios.get(`${baseUrl}/api/jobs`, {
    timeout: 15_000,
    headers: cookieHeader(cookie),
  });

  const { jobs } = (data ?? {}) as Record<string, unknown>;

  return (Array.isArray(jobs) ? jobs : []).map((raw) => {
    const { id, label, description, kind, isRunning, isBlocked, blockReason } = (raw ??
      {}) as Record<string, unknown>;

    return {
      id: id === undefined ? '' : String(id),
      label: label === undefined ? '' : String(label),
      description: description === undefined ? '' : String(description),
      kind: kind === undefined ? '' : String(kind),
      isRunning: isRunning === true,
      isBlocked: isBlocked === true,
      blockReason: blockReason === undefined ? '' : String(blockReason),
    };
  });
};

/**
 * 원격 실행. 돌려주는 것은 runId 하나이고 실행은 서버에서 계속 돈다.
 * 로컬 자식 프로세스와 달리 앱을 닫아도 계속 돈다.
 */
export const runRemoteJob = async ({
  baseUrl,
  cookie,
  jobId,
  body,
}: Session & { jobId: string; body?: unknown }): Promise<{ runId: string }> => {
  const { data } = await axios.post(
    `${baseUrl}/api/jobs/${encodeURIComponent(jobId)}/run`,
    body ?? {},
    { timeout: 30_000, headers: cookieHeader(cookie) },
  );

  const { runId } = (data ?? {}) as Record<string, unknown>;

  return { runId: runId === undefined ? '' : String(runId) };
};

export type ApiAuth = { kind: 'bearer'; token: string } | { kind: 'cookie'; cookie: string };

/**
 * 읽기 전용 범용 GET. 인증 헤더는 여기서 붙인다. 부르는 쪽(도구)은 토큰을 만지지 않는다.
 * 경로 허용목록 판정은 api-access.ts 가 이미 통과시키고 온다.
 */
export const apiGet = async ({
  baseUrl,
  auth,
  path,
  query,
}: {
  baseUrl: string;
  auth: ApiAuth;
  path: string;
  query?: Record<string, unknown>;
}): Promise<{ status: number; data: unknown }> => {
  const headers =
    auth.kind === 'bearer' ? { Authorization: `Bearer ${auth.token}` } : cookieHeader(auth.cookie);

  const { status, data } = await axios.get(`${baseUrl}${path}`, {
    timeout: 20_000,
    headers,
    params: query,
    validateStatus: () => true,
  });

  return { status, data };
};
