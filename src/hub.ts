import axios from 'axios';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ERRORS, PROGRESS, SERVICE_LABELS } from './messages';

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

export type AutoScheduleQueue = {
  account: { id: string };
  keywords: string[];
  blog_name?: string;
};

export const autoSchedulePosts = async ({
  baseUrl,
  scheduleDate,
  queues,
  postsPerDay,
  startHour,
  intervalMinutes,
  manuscriptType,
  keywordCategory,
  token,
}: {
  baseUrl: string;
  token?: string;
  scheduleDate: string;
  queues: AutoScheduleQueue[];
  postsPerDay?: number;
  startHour?: number;
  intervalMinutes?: number;
  manuscriptType?: string;
  keywordCategory?: string;
}) => {
  const body: Record<string, unknown> = { schedule_date: scheduleDate, queues };

  if (postsPerDay !== undefined) body.posts_per_day = postsPerDay;
  if (startHour !== undefined) body.start_hour = startHour;
  if (intervalMinutes !== undefined) body.interval_minutes = intervalMinutes;
  if (manuscriptType) body.manuscript_type = manuscriptType;
  if (keywordCategory) body.keyword_category = keywordCategory;

  const { data } = await axios.post(`${baseUrl}/bot/auto-schedule`, body, {
    timeout: 120_000,
    headers: bearer(token),
  });

  return data as unknown;
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
