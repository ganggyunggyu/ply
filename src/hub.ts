import axios from 'axios';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ERRORS, PROGRESS, SERVICE_LABELS } from './messages';
import type { ImageSource, ManuscriptType } from './scheduler-enums';

export type ServiceEndpoints = {
  dabutBaseUrl: string;
  schedulerBaseUrl: string;
  exposureBotDir: string;
};

/**
 * 배포된 서비스가 기본값이다. 설치만 하면 어느 컴퓨터에서든 바로 돌아야 하므로
 * 로컬 주소를 기본으로 두지 않는다. 자기 서버를 쓰려면 패널 설정에서 바꾸고,
 * 바꾼 값은 settings.json 에만 저장된다.
 *
 * exposureBotDir 만 비워 둔다. 저장소 경로는 컴퓨터마다 다르다.
 */
export const DEFAULT_ENDPOINTS: ServiceEndpoints = {
  dabutBaseUrl: 'https://blog-analyzer.fly.dev',
  schedulerBaseUrl: 'https://21lab-scheduler.fly.dev',
  exposureBotDir: '',
};

const bearer = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : undefined);

const SCRIPT_NAME_PATTERN = /^[a-z0-9][a-z0-9:_-]*$/i;

/**
 * GUI(Dock/Spotlight)로 띄운 macOS 앱은 PATH 가 /usr/bin:/bin:/usr/sbin:/sbin 뿐이라
 * 사용자가 설치한 pnpm 을 찾지 못한다. 흔한 설치 위치를 먼저 뒤지고, 없으면 셸에 맡긴다.
 *
 * 셸 폴백은 zsh 기준 -ilc 를 쓴다. pnpm setup 은 PNPM_HOME 을 .zshrc 에 쓰는데
 * -lc(비대화형 로그인 셸)는 .zshrc 를 읽지 않아 그 설치를 놓친다.
 */
export const pnpmCandidatePaths = (home = homedir()): string[] => {
  const fromEnv = process.env.PNPM_HOME ? [join(process.env.PNPM_HOME, 'pnpm')] : [];

  if (process.platform === 'win32') {
    return [...fromEnv, join(home, 'AppData', 'Local', 'pnpm', 'pnpm.exe')];
  }

  return [
    ...fromEnv,
    join(home, 'Library', 'pnpm', 'pnpm'),
    join(home, '.local', 'share', 'pnpm', 'pnpm'),
    '/opt/homebrew/bin/pnpm',
    '/usr/local/bin/pnpm',
  ];
};

export const findPnpm = (exists: (path: string) => boolean = existsSync): string | null =>
  pnpmCandidatePaths().find(exists) ?? null;

export const buildShellInvocation = (script: string, pnpmPath: string | null = findPnpm()) => {
  if (!SCRIPT_NAME_PATTERN.test(script)) {
    throw new Error(ERRORS.scriptNameRejected(script));
  }

  if (pnpmPath) {
    return { command: pnpmPath, args: ['run', script], viaShell: false };
  }

  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/c', `pnpm run ${script}`], viaShell: true };
  }

  const shell = process.env.SHELL || '/bin/zsh';
  const loginInteractive = shell.endsWith('zsh') ? '-ilc' : '-lc';

  return { command: shell, args: [loginInteractive, `pnpm run ${script}`], viaShell: true };
};

export type ExposureJob = {
  key: string;
  label: string;
  script: string;
  description: string;
};

export const EXPOSURE_SCRIPT_PREFIX = 'exposure:';

/**
 * 라벨만 알고 있는 것에 붙인다. 목록 자체가 아니다.
 * 노출체크 저장소는 이 저장소에 들어 있지 않고 사람마다 스크립트가 다르므로,
 * 실행 가능한 작업을 여기에 박아 두면 그쪽에서 이름을 바꾼 순간 조용히 실패한다.
 */
const EXPOSURE_JOB_LABELS: Record<string, { label: string; description: string }> = {
  package: { label: '패키지 시트', description: '패키지 상품 키워드 노출체크' },
  general: { label: '일반 시트', description: '일반 업체 키워드 노출체크' },
  pet: { label: '반려동물', description: '반려동물 시트 노출체크' },
  cafe: { label: '카페', description: '카페 노출체크' },
  root: { label: '루트', description: '루트 시트 빠른 노출체크' },
  suite: { label: '전체', description: '전체 시트 노출체크 스위트' },
};

export const toExposureJob = (script: string): ExposureJob => {
  const key = script.slice(EXPOSURE_SCRIPT_PREFIX.length);
  const known = EXPOSURE_JOB_LABELS[key];

  return {
    key,
    label: known?.label ?? key,
    script,
    description: known?.description ?? `${key} 노출체크`,
  };
};

/** 실행 가능한 목록은 저장소의 package.json 에서 읽는다. 경로가 없거나 못 읽으면 빈 배열. */
export const listExposureJobs = (exposureBotDir: string): ExposureJob[] => {
  if (!exposureBotDir) return [];

  const manifest = join(exposureBotDir, 'package.json');
  if (!existsSync(manifest)) return [];

  try {
    const { scripts } = JSON.parse(readFileSync(manifest, 'utf8')) as { scripts?: Record<string, string> };

    return Object.keys(scripts ?? {})
      .filter((name) => name.startsWith(EXPOSURE_SCRIPT_PREFIX) && SCRIPT_NAME_PATTERN.test(name))
      .sort()
      .map(toExposureJob);
  } catch {
    return [];
  }
};

export const findExposureJob = (exposureBotDir: string, key: string): ExposureJob | null => {
  const needle = key.trim().toLowerCase();
  if (!needle) return null;

  const jobs = listExposureJobs(exposureBotDir);

  return (
    jobs.find((job) => job.key.toLowerCase() === needle) ??
    jobs.find((job) => job.script.toLowerCase() === needle) ??
    null
  );
};

export type ServiceHealth = {
  name: string;
  url: string;
  ok: boolean;
  detail: string;
};

const probe = async (name: string, url: string): Promise<ServiceHealth> => {
  try {
    const { status } = await axios.get(url, { timeout: 3000, validateStatus: () => true });
    return { name, url, ok: status < 500, detail: `HTTP ${status}` };
  } catch (error) {
    return { name, url, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
};

export const checkServices = async (
  { dabutBaseUrl, schedulerBaseUrl, exposureBotDir }: ServiceEndpoints,
  schedulerToken?: string,
): Promise<ServiceHealth[]> => {
  const http = await Promise.all([
    probe(SERVICE_LABELS.dabut, `${dabutBaseUrl}/docs`),
    probe(SERVICE_LABELS.scheduler, `${schedulerBaseUrl}/health`),
  ]);

  const auth: ServiceHealth = {
    name: SERVICE_LABELS.schedulerAuth,
    url: schedulerBaseUrl,
    ok: Boolean(schedulerToken),
    detail: schedulerToken ? SERVICE_LABELS.schedulerAuthOk : SERVICE_LABELS.schedulerAuthMissing,
  };

  const exposure: ServiceHealth = exposureBotDir
    ? {
        name: SERVICE_LABELS.exposure,
        url: exposureBotDir,
        ok: existsSync(`${exposureBotDir}/package.json`),
        detail: existsSync(`${exposureBotDir}/package.json`)
          ? SERVICE_LABELS.exposureOk
          : SERVICE_LABELS.exposureNoPackageJson,
      }
    : {
        name: SERVICE_LABELS.exposure,
        url: SERVICE_LABELS.exposureUnset,
        ok: false,
        detail: SERVICE_LABELS.exposureNotConfigured,
      };

  return [...http, auth, exposure];
};

export type SchedulerAccount = {
  id: string;
  name?: string;
  blogId?: string;
  /**
   * 네이버 로그인 id. 이 값이 곧 Schedule 문서의 accountId 다.
   * (createSchedule 은 resolveQueueAccount 가 푼 credential.loginId 를 accountId 로 쓴다.)
   *
   * /api/blog-accounts 는 다붓 JWT 의 소유자로 스코프된 유일한 읽기라서, 여기서 나온 loginId 집합이
   * "내 예약" 을 판별할 수 있는 단 하나의 근거다. GET/DELETE /schedules 에는 소유자 스코프가 없다.
   */
  loginId?: string;
};

/** 스케줄러 로그인. 비밀번호는 여기서만 쓰고 저장하지 않는다. 토큰만 돌려준다. */
export const loginDabut = async ({
  baseUrl,
  username,
  password,
}: {
  baseUrl: string;
  username: string;
  password: string;
}): Promise<{ token: string; label: string }> => {
  const { data } = await axios.post(
    `${baseUrl}/api/auth/login`,
    { username, password },
    { timeout: 20_000 },
  );

  const token = String(data?.accessToken ?? '');
  if (!token) throw new Error('스케줄러가 토큰을 돌려주지 않았습니다');

  return { token, label: String(data?.user?.label || data?.user?.username || username) };
};

export const listSchedulerAccounts = async (
  baseUrl: string,
  token?: string,
): Promise<SchedulerAccount[]> => {
  const { data } = await axios.get(`${baseUrl}/api/blog-accounts`, {
    timeout: 10_000,
    headers: bearer(token),
  });
  const rows = Array.isArray(data) ? data : (data?.accounts ?? data?.data ?? []);

  return (Array.isArray(rows) ? rows : []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? row._id ?? ''),
    name: row.name ? String(row.name) : undefined,
    blogId: row.blogId ? String(row.blogId) : undefined,
    loginId: row.loginId ? String(row.loginId) : row.login_id ? String(row.login_id) : undefined,
  }));
};

export type DabutProject = {
  id: string;
  label: string;
  description: string;
  model: string;
  isActive: boolean;
};

/** 로그인한 계정이 만들어 둔 원고 프로젝트 목록. 프로젝트 = 원고 뽑는 방식. */
export const listDabutProjects = async (baseUrl: string, token?: string): Promise<DabutProject[]> => {
  const { data } = await axios.get(`${baseUrl}/projects`, { timeout: 15_000, headers: bearer(token) });
  const rows = Array.isArray(data) ? data : (data?.projects ?? data?.items ?? []);

  return (Array.isArray(rows) ? rows : [])
    .map((row: Record<string, unknown>) => ({
      id: String(row.id ?? row._id ?? ''),
      label: String(row.label ?? row.key ?? ''),
      description: String(row.description ?? ''),
      model: String(row.model ?? ''),
      isActive: row.is_active !== false,
    }))
    .filter((p) => p.id && p.isActive);
};

export type ProjectManuscript = {
  content: string;
  projectLabel: string;
  articleHtml?: string;
  imageCount: number;
};

/** 프로젝트의 모델·지침·전후 단계를 그대로 태워 원고를 뽑는다. */
export const generateManuscriptViaProject = async ({
  baseUrl,
  token,
  projectId,
  keyword,
  ref,
  businessName,
  withImages,
}: {
  baseUrl: string;
  token: string;
  projectId: string;
  keyword: string;
  ref?: string;
  businessName?: string;
  withImages?: boolean;
}): Promise<ProjectManuscript> => {
  const { data } = await axios.post(
    `${baseUrl}/generate/project`,
    {
      project_id: projectId,
      keyword,
      ref: ref ?? '',
      business_name: businessName ?? '',
      with_images: withImages ?? false,
    },
    { timeout: 600_000, headers: bearer(token) },
  );

  return {
    content: String(data?.content ?? ''),
    projectLabel: String(data?.project?.label ?? ''),
    articleHtml: data?.article_html ? String(data.article_html) : undefined,
    imageCount: Number(data?.total ?? 0),
  };
};

/**
 * 항목별 override. keywords 와 길이가 같아야 하고, 다르면 스케줄러가
 * HTTP 200 + { success: false } 로 조용히 실패한다.
 * projectId 는 최상위 project_id 를 이긴다 (schedule.route.ts 의 applyItemOptions).
 */
export type AutoScheduleItemOption = {
  businessName?: string;
  manuscriptType?: ManuscriptType;
  projectId?: string;
};

/**
 * 스케줄러는 account.id 를 네이버 로그인 id 로만 취급한다 (findAccountById).
 * /api/blog-accounts 가 준 값은 Mongo ObjectId 라서 id 로 보내면
 * "Account credentials not provided" 로 떨어진다. dabutAccountId 로 보내야
 * 다붓 크리덴셜 복호화 경로를 탄다 (resolveQueueAccount).
 */
export type AutoScheduleQueue = {
  account: { dabutAccountId?: string; id?: string; blogId?: string };
  keywords: string[];
  blog_name?: string;
  item_options?: AutoScheduleItemOption[];
};

export type AutoScheduleInput = {
  scheduleDate: string;
  queues: AutoScheduleQueue[];
  postsPerDay?: number;
  startHour?: number;
  intervalMinutes?: number;
  manuscriptType?: ManuscriptType;
  imageSource?: ImageSource;
  keywordCategory?: string;
  projectId?: string;
};

/**
 * /bot/auto-schedule 의 pythonCompatSchema 는 최상위가 전부 snake_case 다.
 * zod 가 non-strict 라 이름이 어긋난 키는 400 없이 조용히 버려진다.
 * 그래서 이 변환을 한 곳에 모아두고 테스트로 이름을 고정한다.
 */
export const buildAutoScheduleBody = ({
  scheduleDate,
  queues,
  postsPerDay,
  startHour,
  intervalMinutes,
  manuscriptType,
  imageSource,
  keywordCategory,
  projectId,
}: AutoScheduleInput): Record<string, unknown> => {
  const body: Record<string, unknown> = { schedule_date: scheduleDate, queues };

  if (postsPerDay !== undefined) body.posts_per_day = postsPerDay;
  if (startHour !== undefined) body.start_hour = startHour;
  if (intervalMinutes !== undefined) body.interval_minutes = intervalMinutes;
  if (manuscriptType) body.manuscript_type = manuscriptType;
  if (imageSource) body.image_source = imageSource;
  if (keywordCategory) body.keyword_category = keywordCategory;
  if (projectId) body.project_id = projectId;

  return body;
};

export const autoSchedulePosts = async ({
  baseUrl,
  token,
  ...input
}: AutoScheduleInput & { baseUrl: string; token?: string }) => {
  const { data } = await axios.post(`${baseUrl}/bot/auto-schedule`, buildAutoScheduleBody(input), {
    timeout: 120_000,
    headers: bearer(token),
  });

  return data as unknown;
};

export type AutoScheduleOutcome = {
  ok: boolean;
  message: string;
  totalJobs: number;
  reused: boolean;
  /** 등록된 예약의 id. get_schedule 로 저장값을 되읽는 유일한 실마리라 따로 뽑아 둔다. */
  scheduleIds: string[];
};

/**
 * /bot/auto-schedule 은 실패해도 HTTP 200 을 준다. 계정 크리덴셜 복호화 실패나
 * item_options 길이 불일치는 axios 가 던지지 않고 { success: false, message } 로 돌아온다.
 * 그래서 status 가 아니라 본문을 봐야 실패를 안다.
 *
 * reused 는 같은 지문의 기존 예약을 그대로 돌려줬다는 뜻이다. 새 잡이 생기지 않았으므로
 * 완료로 보고하면 안 된다. 스케줄러의 지문에는 project_id 가 빠져 있어서, 프로젝트만 바꿔
 * 다시 걸면 여기로 떨어지고 변경이 반영되지 않는다.
 */
export const readAutoScheduleResult = (data: unknown): AutoScheduleOutcome => {
  const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const schedules = Array.isArray(body.schedules) ? body.schedules : [];
  const totalJobs = Number(body.totalJobs);

  return {
    ok: body.success === true,
    message: typeof body.message === 'string' ? body.message : '',
    totalJobs: Number.isFinite(totalJobs) ? totalJobs : 0,
    reused: schedules.some((row) => (row as Record<string, unknown> | null)?.reused === true),
    scheduleIds: schedules
      .map((row) => {
        const { scheduleId, id, _id } = (row ?? {}) as Record<string, unknown>;

        return scheduleId === undefined || scheduleId === null
          ? String(id ?? _id ?? '')
          : String(scheduleId);
      })
      .filter((id) => id !== ''),
  };
};

export type ScheduleSummary = {
  id: string;
  accountId: string;
  scheduleDate: string;
  status: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  /** 계정별로 나눠 받은 목록을 다시 최신순으로 합칠 때만 쓴다. 모델에게는 내보내지 않는다. */
  createdAt: string;
};

export type ScheduleJobDetail = {
  id: string;
  keyword: string;
  scheduledAt: string;
  status: string;
  projectId: string;
  manuscriptType: string;
  businessName: string;
  postUrl: string;
  error: string;
};

export type ScheduleDetail = {
  schedule: ScheduleSummary | null;
  jobs: ScheduleJobDetail[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const asCount = (value: unknown) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

/** 스케줄러는 mongoose 문서를 그대로 직렬화한다. 키가 id 가 아니라 _id 이고, set 안 된 필드는 아예 없다. */
export const toScheduleSummary = (raw: unknown): ScheduleSummary => {
  const { id, _id, accountId, scheduleDate, status, totalJobs, completedJobs, failedJobs, createdAt } =
    asRecord(raw);

  return {
    id: asText(id ?? _id),
    accountId: asText(accountId),
    scheduleDate: asText(scheduleDate),
    status: asText(status),
    totalJobs: asCount(totalJobs),
    completedJobs: asCount(completedJobs),
    failedJobs: asCount(failedJobs),
    createdAt: asText(createdAt),
  };
};

/**
 * job 하나를 읽는다. projectId 를 살려 내는 것이 이 함수의 존재 이유다.
 * 예약에 원고 프로젝트가 저장되지 않으면 그 필드가 JSON 에 아예 없어서 빈 문자열이 되고,
 * 빈 문자열 자체가 "저장 안 됨" 이라는 확인 결과다. 여기서 임의로 채우지 않는다.
 */
export const toScheduleJobDetail = (raw: unknown): ScheduleJobDetail => {
  const { id, _id, keyword, scheduledAt, status, projectId, manuscriptType, businessName, postUrl, error } =
    asRecord(raw);

  return {
    id: asText(id ?? _id),
    keyword: asText(keyword),
    scheduledAt: asText(scheduledAt),
    status: asText(status),
    projectId: asText(projectId),
    manuscriptType: asText(manuscriptType),
    businessName: asText(businessName),
    postUrl: asText(postUrl),
    error: asText(error),
  };
};

export const readScheduleList = (data: unknown): ScheduleSummary[] => {
  const { schedules } = asRecord(data);
  const rows = Array.isArray(data) ? data : Array.isArray(schedules) ? schedules : [];

  return rows.map(toScheduleSummary).filter(({ id }) => id !== '');
};

export const readScheduleDetail = (data: unknown): ScheduleDetail => {
  const { schedule, jobs } = asRecord(data);
  const summary = schedule ? toScheduleSummary(schedule) : null;

  return {
    schedule: summary && summary.id ? summary : null,
    jobs: Array.isArray(jobs) ? jobs.map(toScheduleJobDetail) : [],
  };
};

/**
 * GET /schedules 의 accountId 는 마스킹 없이 네이버 로그인 id 원문이다.
 * (등록 응답만 스케줄러가 가려서 준다.) 화면과 모델에 그대로 흘리지 않는다.
 */
export const maskAccountId = (raw: string): string => {
  const value = raw.trim();
  if (!value) return '';
  if (value.length <= 3) return `${value.slice(0, 1)}***`;

  return `${value.slice(0, 3)}***`;
};

/**
 * 예약 목록. 최근 50건 고정이고 페이지네이션이 없다.
 * 필터는 accountId 와 status 둘뿐이며, 다른 키를 넣어도 zod 가 non-strict 라 조용히 버려진다.
 */
export const listSchedules = async ({
  baseUrl,
  token,
  accountId,
  status,
}: {
  baseUrl: string;
  token?: string;
  accountId?: string;
  status?: string;
}): Promise<ScheduleSummary[]> => {
  const params: Record<string, string> = {};
  if (accountId) params.accountId = accountId;
  if (status) params.status = status;

  const { data } = await axios.get(`${baseUrl}/schedules`, {
    timeout: 15_000,
    headers: bearer(token),
    params,
  });

  return readScheduleList(data);
};

/**
 * 예약 하나의 상세. jobs 에만 keyword·scheduledAt·projectId 가 있고 목록에는 없다.
 * _id 가 String 으로 재정의돼 있어서 sch_ 접두사를 붙인 값을 그대로 경로에 넣는다.
 */
export const getSchedule = async ({
  baseUrl,
  token,
  scheduleId,
}: {
  baseUrl: string;
  token?: string;
  scheduleId: string;
}): Promise<ScheduleDetail> => {
  const { data } = await axios.get(`${baseUrl}/schedules/${encodeURIComponent(scheduleId)}`, {
    timeout: 15_000,
    headers: bearer(token),
  });

  return readScheduleDetail(data);
};

export const readCancelScheduleResult = (data: unknown): { ok: boolean; id: string } => {
  const { success, id } = asRecord(data);

  return { ok: success === true, id: asText(id) };
};

/**
 * 삭제가 아니라 소프트 취소다. 큐에서 잡을 빼고 job/schedule 의 status 를 cancelled 로 바꾼다.
 * 문서는 남아 get_schedule 로 계속 읽히지만, 되살리는 엔드포인트는 없다.
 * (POST /schedules/:id/execute 는 pending·generating 만 다시 큐에 넣는다.)
 * 큐 잡 제거를 job 마다 도는 라우트라 읽기보다 넉넉히 기다린다.
 */
export const cancelSchedule = async ({
  baseUrl,
  token,
  scheduleId,
}: {
  baseUrl: string;
  token?: string;
  scheduleId: string;
}): Promise<{ ok: boolean; id: string }> => {
  const { data } = await axios.delete(`${baseUrl}/schedules/${encodeURIComponent(scheduleId)}`, {
    timeout: 60_000,
    headers: bearer(token),
  });

  return readCancelScheduleResult(data);
};

const errorFieldLine = (row: unknown): string => {
  const { field, message } = (row ?? {}) as Record<string, unknown>;

  return [field, message].filter((part): part is string => typeof part === 'string' && part !== '').join(': ');
};

/**
 * 스케줄러의 400 본문은 { message, fields: [{ field, message }] } 라 무엇이 틀렸는지 알려준다.
 * axios 예외 메시지만 올리면 "Request failed with status code 400" 만 남아 모델이 고칠 수 없다.
 */
/**
 * axios 는 404 를 던진다. 그래서 "없는 예약" 은 `schedule === null` 이 아니라 예외로 온다.
 * 이걸 구분하지 않으면 id 가 틀렸을 때 "id 를 다시 확인하라" 가 아니라 "읽지 못했다" 만 남아
 * 모델이 복구 방법을 모른다.
 */
export const isScheduleNotFound = (error: unknown): boolean =>
  (error as { response?: { status?: number } } | null)?.response?.status === 404;

export const describeSchedulerError = (error: unknown): string => {
  const base = error instanceof Error ? error.message : String(error);
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;

  if (!data || typeof data !== 'object') return base;

  const { message, fields } = data as Record<string, unknown>;
  const detail = typeof message === 'string' ? message : '';
  const lines = Array.isArray(fields) ? fields.map(errorFieldLine).filter(Boolean) : [];

  return [base, detail, ...lines].filter(Boolean).join(' | ');
};

export type CommandResult = {
  code: number | null;
  output: string;
};

export const runPackageScript = ({
  cwd,
  script,
  onLine,
  timeoutMs = 30 * 60 * 1000,
}: {
  cwd: string;
  script: string;
  onLine?: (line: string) => void;
  timeoutMs?: number;
}): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    if (!cwd) {
      reject(new Error(ERRORS.exposureDirMissing));
      return;
    }
    if (!existsSync(`${cwd}/package.json`)) {
      reject(new Error(ERRORS.exposureDirInvalid(cwd)));
      return;
    }

    const { command, args, viaShell } = buildShellInvocation(script);
    onLine?.(viaShell ? PROGRESS.pnpmViaShell : PROGRESS.pnpmFound(command));
    const child = spawn(command, args, { cwd, env: process.env });
    const chunks: string[] = [];

    const collect = (data: Buffer) => {
      const text = data.toString();
      chunks.push(text);
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => onLine?.(line));
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(ERRORS.commandTimeout(script)));
    }, timeoutMs);

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output: chunks.join('').slice(-4000) });
    });
  });
