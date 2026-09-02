import type { AxiosInstance } from 'axios';
import type { AccountStore } from './accounts';
import type { QuestionChoice, QuestionField, QuestionFieldType } from './bridge';
import { QUESTION_FIELD_TYPES, QUESTION_FORM_CANCEL } from './constants';
import { generateText, type ToolSpec } from './openrouter';
import { CONFIRM, ERRORS, PROGRESS } from './messages';
import {
  IMAGE_SOURCES,
  isImageSource,
  isManuscriptType,
  MANUSCRIPT_TYPES,
  SCHEDULE_LIMITS,
  SCHEDULE_STATUSES,
  type ImageSource,
  type ManuscriptType,
  type ScheduleJobStatus,
} from './scheduler-enums';
import {
  buildAgentSystemPrompt,
  buildManuscriptPrompt,
  MANUSCRIPT_SYSTEM,
  PARAM_DESCRIPTIONS as PARAM,
  TOOL_DESCRIPTIONS as DESC,
  TOOL_RESULTS as RESULT,
} from './prompts';
import {
  connectBrowser,
  deleteSinglePost,
  detectLoginBlock,
  fetchRecentPosts,
  fillLoginForm,
  isSessionExpired,
  LOGIN_URL,
  MY_BLOG_URL,
  parseLogNo,
  resolveBlogId,
  sleep,
  waitForPageByTabId,
  writeBlogPost,
  type DeleteOutcome,
  type RecentPost,
} from './naver';
import {
  autoSchedulePosts,
  cancelSchedule,
  checkServices,
  describeSchedulerError,
  findExposureJob,
  getSchedule,
  isScheduleNotFound,
  listExposureJobs,
  generateManuscriptViaProject,
  listDabutProjects,
  listSchedulerAccounts,
  listSchedules,
  maskAccountId,
  readAutoScheduleResult,
  runPackageScript,
  type AutoScheduleInput,
  type ScheduleJobDetail,
  type SchedulerAccount,
  type ScheduleSummary,
  type ServiceEndpoints,
} from './hub';
import { configuredServices, findService, isServiceConfigured } from './services';
import type { TabManager } from './tabs';

export type ToolContext = {
  accountStore: AccountStore;
  tabManager: TabManager;
  cdpPort: number;
  client: AxiosInstance;
  writerModel: string;
  /** 실행 중에 바뀔 수 있으므로 값이 아니라 게터로 받는다. */
  getEndpoints: () => ServiceEndpoints;
  getSchedulerToken: () => string | undefined;
  getCookieNames: (profileId: string) => Promise<string[]>;
  onProgress: (message: string) => void;
  askUser: (question: string, choices?: string[]) => Promise<string>;
  /** 값이 여러 개일 때. 답은 { key: value } 를 JSON 으로 직렬화한 문자열이다. */
  askUserForm: (question: string, fields: QuestionField[]) => Promise<string>;
  requestDabutLogin: (reason: string) => Promise<string>;
};

const isQuestionFieldType = (value: unknown): value is QuestionFieldType =>
  typeof value === 'string' && (QUESTION_FIELD_TYPES as readonly string[]).includes(value);

/**
 * 보기 하나를 { label, value } 로 좁힌다.
 * 모델이 문자열만 줄 수도 있어서 그때는 label 과 value 를 같은 값으로 둔다.
 */
const toQuestionChoice = (raw: unknown): QuestionChoice | null => {
  if (typeof raw === 'string') {
    const label = raw.trim();

    return label ? { label, value: label } : null;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const { label, value } = raw as Record<string, unknown>;
  const text = typeof label === 'string' ? label.trim() : '';
  if (!text) return null;

  const picked = value === undefined || value === null ? text : String(value).trim();

  return picked ? { label: text, value: picked } : null;
};

export type QuestionFieldsCheck =
  | { ok: true; fields: QuestionField[] }
  | { ok: false; reason: 'shape' | 'prefill'; key: string };

/**
 * 모델이 준 fields 를 패널이 그릴 수 있는 모양으로 좁힌다.
 * 하나라도 어긋나면 폼을 띄우지 않고 이유를 돌려준다. 반쪽짜리 폼은 사용자가 뭘 넣어야 할지 모른다.
 *
 * 미리 채운 value 가 choices 에 없으면 거부한다. 그대로 그리면 아무것도 안 골라진 빈 칸이 되는데,
 * 모델은 자기가 채운 값이 사라진 줄 모르고 그 값으로 진행했다고 믿는다.
 */
export const normalizeQuestionFields = (raw: unknown): QuestionFieldsCheck => {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'shape', key: '' };

  const fields: QuestionField[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, reason: 'shape', key: '' };

    const { key, label, placeholder, type, choices, value, optional } = item as Record<string, unknown>;

    if (typeof key !== 'string' || !key.trim()) return { ok: false, reason: 'shape', key: '' };
    if (typeof label !== 'string' || !label.trim()) return { ok: false, reason: 'shape', key };
    if (type !== undefined && !isQuestionFieldType(type)) return { ok: false, reason: 'shape', key };
    if (fields.some((field) => field.key === key)) return { ok: false, reason: 'shape', key };

    const options = Array.isArray(choices)
      ? choices
          .map(toQuestionChoice)
          .filter((choice): choice is QuestionChoice => choice !== null)
      : [];
    const prefill = value === undefined || value === null ? undefined : String(value);

    if (prefill && options.length > 0 && !options.some((choice) => choice.value === prefill)) {
      return { ok: false, reason: 'prefill', key };
    }

    fields.push({
      key,
      label,
      placeholder: typeof placeholder === 'string' && placeholder ? placeholder : undefined,
      type: isQuestionFieldType(type) ? type : undefined,
      choices: options.length > 0 ? options : undefined,
      value: prefill,
      optional: optional === true,
    });
  }

  return { ok: true, fields };
};

export type FormAnswer =
  | { cancelled: true }
  | { cancelled: false; values: Record<string, string> };

/** 패널이 JSON 문자열로 답한다. 못 읽으면 취소로 본다. 값을 지어내는 것보다 멈추는 게 낫다. */
export const parseFormAnswer = (raw: string): FormAnswer => {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { cancelled: true };
    if ((parsed as Record<string, unknown>)[QUESTION_FORM_CANCEL] === true) return { cancelled: true };

    const values: Record<string, string> = {};

    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      values[key] = String(value);
    });

    return { cancelled: false, values };
  } catch {
    return { cancelled: true };
  }
};

/** 모델에게는 원시 JSON 대신 키: 값 줄로 준다. JSON 을 보여주면 그대로 따라 쓰다가 따옴표를 섞는다. */
export const formatFormAnswer = (fields: QuestionField[], values: Record<string, string>): string[] =>
  fields.flatMap(({ key }) => {
    const value = values[key] ?? '';

    return value.trim() === '' ? [] : [`${key}: ${value}`];
  });

export type AutoScheduleBuild =
  | { ok: false; result: string }
  | { ok: true; input: AutoScheduleInput };

const outOfRange = (value: number | undefined, min: number, max: number) =>
  value !== undefined && (!Number.isFinite(value) || value < min || value > max);

const optionalNumber = (raw: unknown) => (raw === undefined || raw === null ? undefined : Number(raw));

const SCHEDULE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 스케줄러의 schedule_date 에는 형식 검증이 없다. 어긋난 값이 두 갈래로 샌다.
 * 2026-9-2 나 2026-13-01 은 Invalid Date 가 되어 서버가 포맷 단계에서 500 으로 죽고,
 * 모델에게는 "status code 500" 만 남는다.
 * 2026-02-31 은 죽지도 않고 3월로 굴러가 사용자가 말한 적 없는 날에 예약이 걸린다.
 * 둘 다 여기서 막는다.
 */
const isCalendarDate = (value: string) => {
  if (!SCHEDULE_DATE_PATTERN.test(value)) return false;

  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time)) return false;

  // 2026-02-31 은 던지지 않고 3월로 굴러간다. 되찍어 같은 날인지 봐야 다른 날에 조용히 걸리지 않는다.
  return new Date(time).toISOString().slice(0, 10) === value;
};

/**
 * 도구 인자를 스케줄러 호출 입력으로 옮긴다. 네트워크를 타지 않는 판정은 전부 여기서 끝낸다.
 *
 * 계정은 dabutAccountId 로 보낸다. list_scheduler_accounts 가 주는 값은 다붓의 Mongo _id 인데
 * 스케줄러의 account.id 는 네이버 로그인 id 라서, id 로 보내면 계정 해석 단계에서 죽는다.
 *
 * knownProjectIds 는 이번 실행에서 list_dabut_projects 가 돌려준 id 다. 폼이 라벨을 보여주고
 * id 를 돌려주더라도 모델이 다른 값을 실어 보낼 수 있고, 스케줄러는 min(1) 문자열이면 뭐든 받는다.
 * 틀린 프로젝트로 나간 건 몇 시간 뒤 생성 시점에나 드러나므로 여기서 대조한다.
 */
export const buildAutoScheduleInput = (
  raw: Record<string, unknown>,
  knownProjectIds: ReadonlySet<string>,
): AutoScheduleBuild => {
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.map(String).filter((keyword) => keyword.trim() !== '')
    : [];

  if (keywords.length === 0) return { ok: false, result: RESULT.emptyKeywords };

  const accountId = raw.accountId === undefined ? '' : String(raw.accountId).trim();
  if (!accountId) return { ok: false, result: RESULT.schedulerAccountRequired };

  const scheduleDate = raw.scheduleDate === undefined ? '' : String(raw.scheduleDate).trim();
  if (!scheduleDate) return { ok: false, result: RESULT.scheduleDateRequired };
  if (!isCalendarDate(scheduleDate)) {
    return { ok: false, result: RESULT.scheduleDateFormat(scheduleDate) };
  }

  const projectId = raw.projectId === undefined || raw.projectId === null ? '' : String(raw.projectId).trim();
  if (projectId && knownProjectIds.size === 0) {
    return { ok: false, result: RESULT.projectNotListed };
  }
  if (projectId && !knownProjectIds.has(projectId)) {
    return { ok: false, result: RESULT.projectNotFound(projectId) };
  }

  if (raw.manuscriptType !== undefined && !isManuscriptType(raw.manuscriptType)) {
    return { ok: false, result: RESULT.unknownManuscriptType(String(raw.manuscriptType)) };
  }
  if (raw.imageSource !== undefined && !isImageSource(raw.imageSource)) {
    return { ok: false, result: RESULT.unknownImageSource(String(raw.imageSource)) };
  }

  const postsPerDay = optionalNumber(raw.postsPerDay);
  const startHour = optionalNumber(raw.startHour);
  const intervalMinutes = optionalNumber(raw.intervalMinutes);
  const {
    startHourMin,
    startHourMax,
    intervalMinutesMin,
    intervalMinutesMax,
    postsPerDayMin,
    postsPerDayMax,
  } = SCHEDULE_LIMITS;

  if (outOfRange(postsPerDay, postsPerDayMin, postsPerDayMax)) {
    return { ok: false, result: RESULT.scheduleOutOfRange('postsPerDay', postsPerDayMin, postsPerDayMax) };
  }
  if (outOfRange(startHour, startHourMin, startHourMax)) {
    return { ok: false, result: RESULT.scheduleOutOfRange('startHour', startHourMin, startHourMax) };
  }
  if (outOfRange(intervalMinutes, intervalMinutesMin, intervalMinutesMax)) {
    return {
      ok: false,
      result: RESULT.scheduleOutOfRange('intervalMinutes', intervalMinutesMin, intervalMinutesMax),
    };
  }

  return {
    ok: true,
    input: {
      scheduleDate,
      queues: [
        {
          account: { dabutAccountId: accountId },
          keywords,
          blog_name: raw.blogName ? String(raw.blogName) : undefined,
          // 최상위 project_id 는 최초 enqueue 때만 쓰이고 ScheduleJob 문서에는 남지 않는다.
          // 항목별로도 실어야 buildScheduleJobDocuments 가 저장하고, /schedules/:id/execute 로
          // 재실행해도 프로젝트가 유지된다. 길이는 keywords 와 반드시 같아야 한다.
          item_options: projectId ? keywords.map(() => ({ projectId })) : undefined,
        },
      ],
      postsPerDay,
      startHour,
      intervalMinutes,
      manuscriptType: raw.manuscriptType as ManuscriptType | undefined,
      imageSource: raw.imageSource as ImageSource | undefined,
      keywordCategory: raw.keywordCategory ? String(raw.keywordCategory) : undefined,
      projectId: projectId || undefined,
    },
  };
};

export const splitManuscript = (raw: string) => {
  const lines = raw.trim().split('\n');
  const title = (lines[0] ?? '').trim().replace(/^제목\s*[:：]\s*/, '');
  const body = lines.slice(1).join('\n').trim();

  return { title, body: body || raw.trim() };
};

export const hasNaverSession = (cookieNames: string[]) =>
  cookieNames.includes('NID_AUT') && cookieNames.includes('NID_SES');

export const MAX_DELETE_PER_CALL = 10;
export const MAX_DELETE_PER_RUN = 10;
export const MAX_LIST_POSTS = 30;
const DEFAULT_LIST_POSTS = 10;

export type KnownPost = {
  logNo: string;
  title: string;
  addDate: string;
  blogId: string;
  accountId: string;
};

export const clampListLimit = (raw: unknown): number => {
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIST_POSTS;

  return Math.min(value, MAX_LIST_POSTS);
};

export const isDeleteApproved = (answer: string) => answer.trim() === CONFIRM.deleteYes;

export type DeleteTargetCheck =
  | { ok: true; logNos: string[] }
  | { ok: false; reason: 'empty' | 'invalid' | 'tooMany' | 'unknown' | 'accountMismatch'; detail: string[] };

/** 모델이 준 배열을 이번 실행의 목록 결과와 대조한다. 판정 순서를 바꾸지 않는다. */
export const resolveDeleteTargets = (
  raw: unknown,
  known: Map<string, KnownPost>,
  accountId: string,
): DeleteTargetCheck => {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'empty', detail: [] };

  const invalid: string[] = [];
  const logNos: string[] = [];

  for (const item of raw) {
    const logNo = parseLogNo(item);
    if (!logNo) invalid.push(String(item).slice(0, 40));
    else if (!logNos.includes(logNo)) logNos.push(logNo);
  }

  if (invalid.length > 0) return { ok: false, reason: 'invalid', detail: invalid };
  if (logNos.length > MAX_DELETE_PER_CALL) return { ok: false, reason: 'tooMany', detail: logNos };

  const missing = logNos.filter((logNo) => !known.has(logNo));
  if (missing.length > 0) return { ok: false, reason: 'unknown', detail: missing };

  const mismatched = logNos.filter((logNo) => known.get(logNo)?.accountId !== accountId);
  if (mismatched.length > 0) return { ok: false, reason: 'accountMismatch', detail: mismatched };

  return { ok: true, logNos };
};

export const toKnownPosts = (posts: RecentPost[], blogId: string, accountId: string): KnownPost[] =>
  posts.map(({ logNo, title, addDate }) => ({ logNo, title, addDate, blogId, accountId }));

export type DeletionPlan =
  | { ok: false; result: string }
  | { ok: true; blogId: string; targets: KnownPost[] };

/** 브라우저를 열기 전에 끝나는 판정 전부. 승인 게이트 앞의 관문들이라 순수 함수로 둔다. */
export const planDeletion = ({
  raw,
  known,
  attempted,
  refused,
  accountId,
}: {
  raw: unknown;
  known: Map<string, KnownPost>;
  attempted: Set<string>;
  refused: Set<string>;
  accountId: string;
}): DeletionPlan => {
  const check = resolveDeleteTargets(raw, known, accountId);

  if (!check.ok) {
    if (check.reason === 'empty') return { ok: false, result: RESULT.deleteNoTargets };
    if (check.reason === 'invalid') return { ok: false, result: RESULT.deleteInvalidLogNo(check.detail) };
    if (check.reason === 'tooMany') return { ok: false, result: RESULT.deleteTooMany(MAX_DELETE_PER_CALL) };
    if (check.reason === 'accountMismatch') return { ok: false, result: RESULT.deleteAccountMismatch };

    return { ok: false, result: RESULT.deleteUnknownLogNo(check.detail) };
  }

  // 거절을 기록하지 않으면 모델이 같은 목록으로 즉시 다시 물어 확인 피로를 만든다.
  const refusedAgain = check.logNos.filter((logNo) => refused.has(logNo));
  if (refusedAgain.length > 0) return { ok: false, result: RESULT.deleteRefusedEarlier(refusedAgain) };

  // 목록이 한 칸 밀린 채로 두 번째 글을 지우는 시나리오를 원천 차단한다.
  const retried = check.logNos.filter((logNo) => attempted.has(logNo));
  if (retried.length > 0) return { ok: false, result: RESULT.deleteRetryBlocked(retried) };

  // 성공 건수가 아니라 시도 건수로 센다. 검증이 unknown 으로 떨어져도 상한이 열리지 않아야 한다.
  if (attempted.size + check.logNos.length > MAX_DELETE_PER_RUN) {
    return { ok: false, result: RESULT.deleteRunLimit(MAX_DELETE_PER_RUN) };
  }

  const targets = check.logNos.map((logNo) => known.get(logNo) as KnownPost);
  const blogIds = [...new Set(targets.map(({ blogId }) => blogId))];
  if (blogIds.length !== 1) return { ok: false, result: RESULT.deleteBlogMismatch };

  const [blogId] = blogIds as [string];

  return { ok: true, blogId, targets };
};

/** 질문 문안은 코드가 knownPosts 값으로 만든다. 모델은 질문 텍스트를 만들 수 없다.
 *  답이 없어 askUser 가 던지는 경우도 승인이 아니라 취소다. */
export const requestDeleteApproval = async ({
  askUser,
  blogId,
  targets,
}: {
  askUser: ToolContext['askUser'];
  blogId: string;
  targets: KnownPost[];
}): Promise<{ approved: boolean; answer: string }> => {
  const lines = targets.map(({ title, addDate, logNo }, index) =>
    CONFIRM.deleteLine(index + 1, title, addDate, logNo),
  );

  try {
    const answer = await askUser(CONFIRM.deleteQuestion(blogId, lines), [
      CONFIRM.deleteYes,
      CONFIRM.deleteNo,
    ]);

    return { approved: isDeleteApproved(answer), answer };
  } catch {
    return { approved: false, answer: CONFIRM.deleteNo };
  }
};

/** 예약 취소는 한 번에 하나라 개수 상한 대신 실행 상한만 둔다. */
export const MAX_CANCEL_PER_RUN = 3;

/** 계정별 목록을 합친 뒤 모델에게 보낼 최대 건수. 스케줄러의 계정당 상한과 같은 수로 맞춘다. */
export const MAX_LIST_SCHEDULES = 50;

/**
 * 계정별로 나눠 부를 때의 상한. 스케줄러의 GET /schedules 는 한 번에 최근 50건이라
 * 계정 수만큼 요청이 늘어난다. 이 수를 넘으면 조용히 자르지 않고 계정을 좁히라고 알린다.
 */
export const MAX_SCHEDULE_ACCOUNTS = 12;

/**
 * 예약이 내 것인지 판별하는 근거. Schedule 문서의 accountId 는 네이버 로그인 id 이고,
 * /api/blog-accounts 가 다붓 JWT 소유자로 스코프해서 주는 loginId 와 같은 값이다.
 *
 * 스케줄러의 GET/DELETE /schedules 에는 소유자 스코프가 없어서(POST /schedules/:id/execute 만 있다)
 * 토큰만 유효하면 남의 예약도 읽고 지운다. 그러니 소유 판정은 여기 클라이언트가 해야 한다.
 */
export type OwnedAccount = {
  id: string;
  name: string;
  blogId: string;
  loginId: string;
};

/** 네이버 로그인 id 는 대소문자를 가리지 않는다. 비교 전에 반드시 통과시킨다. */
export const normalizeAccountKey = (raw: unknown): string =>
  raw === undefined || raw === null ? '' : String(raw).trim().toLowerCase();

/** loginId 가 없는 행은 예약의 accountId 와 맞춰 볼 수가 없어 소유 판정에서 뺀다. */
export const indexOwnedAccounts = (accounts: SchedulerAccount[]): Map<string, OwnedAccount> => {
  const owned = new Map<string, OwnedAccount>();

  accounts.forEach(({ id, name, blogId, loginId }) => {
    const key = normalizeAccountKey(loginId);
    if (!key) return;

    owned.set(key, { id, name: name ?? '', blogId: blogId ?? '', loginId: loginId ?? '' });
  });

  return owned;
};

export const isOwnedSchedule = (accountId: string, owned: ReadonlyMap<string, OwnedAccount>): boolean =>
  owned.has(normalizeAccountKey(accountId));

/**
 * 화면과 모델에 보여줄 계정 이름.
 *
 * 내 계정이면 사용자가 붙여 둔 이름(없으면 블로그 id)을 쓴다. 마스킹한 로그인 id 는
 * 확인 카드에서 "내 계정 중 하나" 로 읽혀 버려서, 되돌릴 수 없는 작업의 판단 근거로는 못 쓴다.
 * 내 계정이 아니면 그 사실 자체를 적는다. 원문 로그인 id 는 어느 쪽에서도 내보내지 않는다.
 */
export const describeScheduleAccount = (
  accountId: string,
  owned: ReadonlyMap<string, OwnedAccount>,
): string => {
  const account = owned.get(normalizeAccountKey(accountId));
  if (!account) return CONFIRM.cancelScheduleForeignAccount;

  return account.name || account.blogId || maskAccountId(account.loginId);
};

export type AccountFilterResolution =
  | { ok: true; accounts: OwnedAccount[] }
  | { ok: false; result: string };

/**
 * 모델이 준 accountId 필터를 내 계정으로 좁힌다.
 *
 * 예전에는 목록이 마스킹한 계정만 보여줘서 모델이 넣을 수 있는 유효한 값이 존재하지 않았고,
 * 무엇을 넣든 조용히 빈 결과가 됐다. 이제 list_scheduler_accounts 의 id·이름·로그인 id 를 전부 받고,
 * 못 맞추면 조용히 비우는 대신 거부한다.
 */
export const resolveScheduleAccountFilter = (
  raw: unknown,
  owned: ReadonlyMap<string, OwnedAccount>,
): AccountFilterResolution => {
  const accounts = [...owned.values()];
  const wanted = normalizeAccountKey(raw);

  if (!wanted) {
    if (accounts.length > MAX_SCHEDULE_ACCOUNTS) {
      return { ok: false, result: RESULT.scheduleTooManyAccounts(accounts.length, MAX_SCHEDULE_ACCOUNTS) };
    }

    return { ok: true, accounts };
  }

  const matched = accounts.find(
    ({ id, name, blogId, loginId }) =>
      normalizeAccountKey(id) === wanted ||
      normalizeAccountKey(name) === wanted ||
      normalizeAccountKey(blogId) === wanted ||
      normalizeAccountKey(loginId) === wanted,
  );

  if (!matched) return { ok: false, result: RESULT.scheduleAccountFilterUnknown(String(raw)) };

  return { ok: true, accounts: [matched] };
};

/**
 * 여러 계정에서 받은 목록을 하나로 합친다. 계정마다 최근 50건이 따로 오므로
 * 등록 시각으로 다시 최신순을 만들어야 한 계정이 목록을 독차지하지 않는다.
 */
export const mergeScheduleLists = (lists: ScheduleSummary[][], limit: number): ScheduleSummary[] => {
  const merged = new Map<string, ScheduleSummary>();

  lists.flat().forEach((schedule) => merged.set(schedule.id, schedule));

  return [...merged.values()]
    .sort((left, right) => {
      const byCreated = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      if (Number.isFinite(byCreated) && byCreated !== 0) return byCreated;

      return right.scheduleDate.localeCompare(left.scheduleDate);
    })
    .slice(0, limit);
};

/**
 * 취소로 실제 발행을 막을 수 있는 상태.
 * published 는 이미 네이버에 올라갔고, failed·cancelled 는 더 올라갈 것이 없다.
 * DELETE 는 이 셋까지 전부 cancelled 로 덮으므로 전체 건수를 "안 올라간다" 로 세면 부풀린 숫자가 된다.
 */
export const STOPPABLE_JOB_STATUSES: readonly ScheduleJobStatus[] = [
  'pending',
  'generating',
  'generated',
  'publishing',
];

const stoppable = new Set<string>(STOPPABLE_JOB_STATUSES);

export const countStoppableJobs = (jobs: ScheduleJobDetail[]): number =>
  jobs.filter(({ status }) => stoppable.has(status)).length;

export const countPublishedJobs = (jobs: ScheduleJobDetail[]): number =>
  jobs.filter(({ status }) => status === 'published').length;

export type KnownSchedule = {
  id: string;
  accountId: string;
  scheduleDate: string;
  status: string;
  totalJobs: number;
};

export const toKnownSchedules = (rows: ScheduleSummary[]): KnownSchedule[] =>
  rows.map(({ id, accountId, scheduleDate, status, totalJobs }) => ({
    id,
    accountId,
    scheduleDate,
    status,
    totalJobs,
  }));

export const isCancelApproved = (answer: string) => answer.trim() === CONFIRM.cancelScheduleYes;

const scheduleStatusLabel = (status: string) =>
  RESULT.scheduleStatus[status as keyof typeof RESULT.scheduleStatus] ?? status;

const jobStatusLabel = (status: string) =>
  RESULT.scheduleJobStatus[status as keyof typeof RESULT.scheduleJobStatus] ?? status;

/**
 * job 목록을 표 행으로 옮긴다. project 열이 이 도구의 존재 이유다.
 *
 * 라벨과 원문 id 를 둘 다 낸다. 사용자가 묻는 것은 "내가 보낸 그 id 가 저장됐나" 인데,
 * 라벨만 내면 이름이 같은 프로젝트 둘을 구분할 수 없고 모델이 대조할 원문이 사라진다.
 * 저장되지 않은 값은 열을 지우지 않고 "저장 안 됨" 으로 남긴다. 열이 없으면
 * 모델이 확인했다고 착각한다 — 그게 이 도구를 만든 이유였던 그 사각지대다.
 *
 * 키 순서가 곧 열 순서이고, 비어 있어도 되는 열만 값이 없을 때 뺀다.
 * 글 주소 열 이름은 반드시 postUrl 이다. url 이면 tool-output 의 NOISY_KEYS 가 표에서 지운다.
 */
export const formatScheduleJobRows = (
  jobs: ScheduleJobDetail[],
  projectLabels: ReadonlyMap<string, string>,
): Record<string, string>[] =>
  jobs.map(({ keyword, scheduledAt, status, projectId, manuscriptType, businessName, postUrl, error }) => {
    const row: Record<string, string> = {
      keyword,
      scheduledAt,
      status: jobStatusLabel(status),
      project: projectId ? (projectLabels.get(projectId) ?? projectId) : RESULT.scheduleProjectMissing,
      projectId: projectId || RESULT.scheduleProjectMissing,
      manuscriptType: manuscriptType || RESULT.scheduleManuscriptTypeMissing,
    };

    if (businessName) row.businessName = businessName;
    if (postUrl) row.postUrl = postUrl;
    if (error) row.error = error;

    return row;
  });

export type ScheduleCancelPlan =
  | { ok: false; result: string }
  | { ok: true; scheduleId: string };

/**
 * 네트워크를 타기 전에 끝나는 판정 전부. 판정 순서를 바꾸지 않는다.
 *
 * known 은 이번 실행에서 list_schedules 나 get_schedule 이 서버에서 실제로 읽어 왔고
 * 소유 확인까지 통과한 예약이다. 모델이 이전 대화의 기억으로 sch_ 문자열을 들고 오는 것이
 * 실제 위험이라, 읽은 적 없는 id 는 여기서 끊는다.
 *
 * attempted 를 known 보다 먼저 본다. 취소에 성공하면 그 예약의 상태를 갱신하지만,
 * 만약 known 에서 사라진 상태로 다시 불리면 "읽은 적 없다" 는 사실이 아닌 이유를 돌려주게 된다.
 * 이미 시도했다는 사실이 언제나 더 구체적이고 참인 이유다.
 */
export const planScheduleCancel = ({
  raw,
  known,
  attempted,
  refused,
}: {
  raw: unknown;
  known: Map<string, KnownSchedule>;
  attempted: Set<string>;
  refused: Set<string>;
}): ScheduleCancelPlan => {
  const scheduleId = raw === undefined || raw === null ? '' : String(raw).trim();

  if (!scheduleId) return { ok: false, result: RESULT.scheduleIdRequired };

  // 취소는 실패처럼 보여도 큐에서는 이미 빠졌을 수 있다. 삭제와 같은 이유로 재시도를 막는다.
  if (attempted.has(scheduleId)) return { ok: false, result: RESULT.scheduleCancelRetryBlocked(scheduleId) };

  // 거절을 기록하지 않으면 모델이 같은 예약으로 즉시 다시 물어 확인 피로를 만든다.
  if (refused.has(scheduleId)) return { ok: false, result: RESULT.scheduleCancelRefusedEarlier(scheduleId) };

  if (!known.has(scheduleId)) return { ok: false, result: RESULT.scheduleNotRead(scheduleId) };

  if (attempted.size + 1 > MAX_CANCEL_PER_RUN) {
    return { ok: false, result: RESULT.scheduleCancelRunLimit(MAX_CANCEL_PER_RUN) };
  }

  return { ok: true, scheduleId };
};

export type ScheduleCancelApproval = {
  approved: boolean;
  answer: string;
  /**
   * 사용자가 실제로 답했는지. 10분 타임아웃도 승인이 아니지만 거절도 아니다.
   * 둘을 뭉뚱그리면 사용자가 하지 않은 답변("그대로 둘게요")을 지어내 보고하게 된다.
   */
  answered: boolean;
};

/**
 * 확인 문안은 코드가 서버에서 방금 읽은 값으로 만든다. 모델은 질문 텍스트를 만들 수 없다.
 * 목록에는 키워드도 시각도 없으므로 이 문안은 반드시 get_schedule 결과로 조립한다.
 * 답이 없어 askUser 가 던지는 경우도 승인이 아니다.
 *
 * 계정은 마스킹한 로그인 id 가 아니라 사용자가 붙여 둔 이름으로 적는다. 마스킹은 프라이버시용인데,
 * 확인 카드에서는 그게 "누구 예약인지" 를 판단할 마지막 단서를 지워 버린다.
 */
export const requestScheduleCancelApproval = async ({
  askUser,
  schedule,
  jobs,
  owned,
}: {
  askUser: ToolContext['askUser'];
  schedule: ScheduleSummary;
  jobs: ScheduleJobDetail[];
  owned: ReadonlyMap<string, OwnedAccount>;
}): Promise<ScheduleCancelApproval> => {
  const lines = jobs.map(({ keyword, scheduledAt, status }, index) =>
    CONFIRM.cancelScheduleLine(index + 1, keyword, scheduledAt, jobStatusLabel(status)),
  );

  // 이미 발행된 건은 취소해도 네이버에서 내려가지 않는다. DB 기록만 취소로 덮인다.
  const published = countPublishedJobs(jobs);

  try {
    const answer = await askUser(
      CONFIRM.cancelScheduleQuestion({
        scheduleId: schedule.id,
        scheduleDate: schedule.scheduleDate,
        account: describeScheduleAccount(schedule.accountId, owned),
        lines,
        stoppable: countStoppableJobs(jobs),
        published,
      }),
      [CONFIRM.cancelScheduleYes, CONFIRM.cancelScheduleNo],
    );

    return { approved: isCancelApproved(answer), answer, answered: true };
  } catch {
    return { approved: false, answer: '', answered: false };
  }
};

const KNOWN_ERROR_MESSAGES = new Set<string>(
  (Object.values(ERRORS) as unknown[]).filter((value): value is string => typeof value === 'string'),
);

/** playwright 원문 에러는 영어 다중행이라 사용자 표에 그대로 넣지 않는다. */
export const describeToolError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  return KNOWN_ERROR_MESSAGES.has(message) ? message : ERRORS.deleteFailed;
};

export const createNaverTools = (context: ToolContext): ToolSpec[] => {
  const {
    accountStore,
    tabManager,
    cdpPort,
    client,
    writerModel,
    getEndpoints,
    getSchedulerToken,
    getCookieNames,
    onProgress,
    askUser,
    askUserForm,
    requestDabutLogin,
  } = context;

  // createNaverTools 는 실행마다 새로 불린다. 따라서 아래 값들은 자연히 실행 단위다.
  const knownPosts = new Map<string, KnownPost>();
  const attemptedLogNos = new Set<string>();
  const refusedLogNos = new Set<string>();
  const knownProjectIds = new Set<string>();
  /** id 를 사람이 읽는 이름으로 되돌리는 표. get_schedule 이 projectId 를 라벨로 풀 때 쓴다. */
  const projectLabels = new Map<string, string>();
  const knownSchedules = new Map<string, KnownSchedule>();
  const attemptedScheduleIds = new Set<string>();
  const refusedScheduleIds = new Set<string>();

  /**
   * 내 네이버 계정(= Schedule.accountId) 표. 예약 도구 세 개가 전부 이걸 통과해야 한다.
   *
   * 스케줄러의 GET/DELETE /schedules 에는 소유자 스코프가 없어서 토큰만 유효하면 남의 예약이
   * 그대로 나오고 지워진다. "이번 실행에서 읽은 id 만" 이라는 게이트는 그 상태에서
   * "존재하는 아무 id 나" 와 같은 뜻이라 소유 판정을 여기서 따로 한다.
   *
   * 실패를 캐시하지 않는다. 로그인이 늦게 끝나면 다음 호출에서 다시 받아야 한다.
   */
  let ownedAccountsCache: Map<string, OwnedAccount> | null = null;

  const loadOwnedAccounts = async (): Promise<
    { ok: true; owned: Map<string, OwnedAccount> } | { ok: false; result: string }
  > => {
    if (ownedAccountsCache) return { ok: true, owned: ownedAccountsCache };

    try {
      const accounts = await listSchedulerAccounts(getEndpoints().schedulerBaseUrl, getSchedulerToken());
      const owned = indexOwnedAccounts(accounts);

      if (owned.size === 0) return { ok: false, result: RESULT.noSchedulerAccounts };

      ownedAccountsCache = owned;

      return { ok: true, owned };
    } catch (error) {
      return { ok: false, result: RESULT.scheduleAccountsUnknown(describeSchedulerError(error)) };
    }
  };

  const listAccounts: ToolSpec = {
    name: 'list_accounts',
    description: DESC.listAccounts,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const accounts = accountStore.list();
      if (accounts.length === 0) return RESULT.noAccounts;

      return JSON.stringify(accounts);
    },
  };

  const checkLogin: ToolSpec = {
    name: 'check_login',
    description: DESC.checkLogin,
    parameters: {
      type: 'object',
      properties: { accountId: { type: 'string', description: PARAM.accountId } },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId }) => {
      const id = String(accountId);
      if (!accountStore.find(id)) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      return hasNaverSession(names) ? RESULT.sessionAlive : RESULT.sessionMissing;
    },
  };

  const naverLogin: ToolSpec = {
    name: 'naver_login',
    description:
      DESC.naverLogin,
    parameters: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      onProgress(PROGRESS.loginTabOpening(account.label));
      const loginTabId = tabManager.createTab({ url: LOGIN_URL, profileId: id, openedByAgent: true });

      const browser = await connectBrowser(cdpPort);

      try {
        const page = await waitForPageByTabId(browser, loginTabId);

        if (!account.hasPassword) {
          return RESULT.noStoredPassword;
        }

        const password = accountStore.readPassword(id);
        if (!password) return RESULT.decryptFailed;

        onProgress(PROGRESS.loginFilling);
        await fillLoginForm(page, account.naverId, password);
        await sleep(4000);

        const block = await detectLoginBlock(page);
        if (block === 'captcha') return RESULT.blockedByCaptcha;
        if (block === 'two_factor') return RESULT.blockedByTwoFactor;
        if (block === 'error') return RESULT.wrongCredentials;

        if (isSessionExpired(page.url())) return RESULT.stillOnLoginPage;

        return RESULT.loginSucceeded;
      } finally {
        await browser.close();
      }
    },
  };

  const generateManuscript: ToolSpec = {
    name: 'generate_manuscript',
    description: DESC.generateManuscript,
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: PARAM.keyword },
        tone: { type: 'string', description: PARAM.tone },
        angle: { type: 'string', description: PARAM.angle },
      },
      required: ['keyword'],
      additionalProperties: false,
    },
    run: async ({ keyword, tone, angle }) => {
      onProgress(PROGRESS.manuscriptGenerating(String(keyword)));

      const prompt = buildManuscriptPrompt({
        keyword: String(keyword),
        tone: tone ? String(tone) : undefined,
        angle: angle ? String(angle) : undefined,
      });

      const raw = await generateText({ client, model: writerModel, system: MANUSCRIPT_SYSTEM, prompt });
      const { title, body } = splitManuscript(raw);

      return JSON.stringify({ title, body });
    },
  };

  const publishBlogPost: ToolSpec = {
    name: 'publish_blog_post',
    description:
      DESC.publishBlogPost,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['accountId', 'title', 'body'],
      additionalProperties: false,
    },
    run: async ({ accountId, title, body }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      onProgress(PROGRESS.publishStarting(account.label, String(title)));
      const tabId = tabManager.createTab({
        url: 'https://blog.naver.com/GoBlogWrite.naver',
        profileId: id,
        openedByAgent: true,
      });
      const browser = await connectBrowser(cdpPort);

      try {
        const page = await waitForPageByTabId(browser, tabId);
        const url = await writeBlogPost(page, { title: String(title), body: String(body), onProgress });

        return RESULT.published(url);
      } finally {
        await browser.close();
      }
    },
  };

  const listMyPosts: ToolSpec = {
    name: 'list_my_posts',
    description: DESC.listMyPosts,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.accountId },
        limit: { type: 'number', description: PARAM.postLimit },
      },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId, limit }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      const count = clampListLimit(limit);
      onProgress(PROGRESS.postListLoading(account.label));

      const tabId = tabManager.createTab({ url: MY_BLOG_URL, profileId: id, openedByAgent: true });
      const browser = await connectBrowser(cdpPort);

      try {
        const page = await waitForPageByTabId(browser, tabId);
        const blogId = await resolveBlogId(page);
        const posts = await fetchRecentPosts(page, { blogId, limit: count });

        if (posts.length === 0) return RESULT.noPosts(blogId);

        toKnownPosts(posts, blogId, id).forEach((post) => knownPosts.set(post.logNo, post));

        // 키가 url 이면 tool-output 의 NOISY_KEYS 가 표에서 지운다. postUrl 이어야 사용자가 본다.
        return JSON.stringify(
          posts.map(({ logNo, title, addDate, postUrl }) => ({ blogId, logNo, title, addDate, postUrl })),
        );
      } finally {
        await browser.close();
      }
    },
  };

  const deleteBlogPosts: ToolSpec = {
    name: 'delete_blog_posts',
    description: DESC.deleteBlogPosts,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.accountId },
        logNos: { type: 'array', items: { type: 'string' }, description: PARAM.logNos },
      },
      required: ['accountId', 'logNos'],
      additionalProperties: false,
    },
    run: async (input) => {
      const id = String(input.accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      const plan = planDeletion({
        raw: input.logNos,
        known: knownPosts,
        attempted: attemptedLogNos,
        refused: refusedLogNos,
        accountId: id,
      });

      if (!plan.ok) return plan.result;

      const { blogId, targets } = plan;

      onProgress(PROGRESS.deleteConfirmWaiting(targets.length));

      const { approved, answer } = await requestDeleteApproval({ askUser, blogId, targets });

      if (!approved) {
        targets.forEach(({ logNo }) => refusedLogNos.add(logNo));

        return RESULT.deleteCancelled(answer);
      }

      const tabId = tabManager.createTab({
        url: `https://blog.naver.com/${blogId}`,
        profileId: id,
        openedByAgent: true,
      });
      const browser = await connectBrowser(cdpPort);
      const rows: { logNo: string; title: string; status: string; note: string }[] = [];

      try {
        const page = await waitForPageByTabId(browser, tabId);

        // 목록을 읽은 뒤 사용자가 이 프로필에서 다른 계정으로 갈아탔을 수 있다.
        const activeBlogId = await resolveBlogId(page);
        if (activeBlogId !== blogId) return RESULT.deleteBlogChanged(blogId, activeBlogId);

        for (const { logNo, title } of targets) {
          attemptedLogNos.add(logNo);
          onProgress(PROGRESS.deleting(title));

          let outcome: DeleteOutcome;

          try {
            outcome = await deleteSinglePost(page, { blogId, logNo, expectedTitle: title, onProgress });
          } catch (error) {
            console.error(error);
            outcome = { logNo, status: 'unknown', message: describeToolError(error) };
          }

          if (outcome.status === 'deleted') knownPosts.delete(logNo);

          rows.push({
            logNo,
            title,
            status: RESULT.deleteStatus[outcome.status],
            note: outcome.message ?? outcome.actualTitle ?? '',
          });
        }
      } finally {
        await browser.close();
      }

      return JSON.stringify(rows);
    },
  };

  const listServices: ToolSpec = {
    name: 'list_services',
    description: DESC.listServices,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const services = configuredServices();
      if (services.length === 0) return RESULT.noServicesConfigured;

      return JSON.stringify(
        services.map(({ key, name, url, kind, description }) => ({ key, name, url, kind, description })),
      );
    },
  };

  const openService: ToolSpec = {
    name: 'open_service',
    description: DESC.openService,
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: PARAM.serviceName },
        accountId: { type: 'string', description: PARAM.profileId },
      },
      required: ['service'],
      additionalProperties: false,
    },
    run: async ({ service, accountId }) => {
      const found = findService(String(service));
      if (!found) return RESULT.serviceNotFound(String(service));
      if (!isServiceConfigured(found.key)) return RESULT.serviceNotConfigured(found.name);

      tabManager.createTab({
        url: found.url,
        profileId: accountId ? String(accountId) : 'default',
        openedByAgent: true,
      });

      return RESULT.serviceOpened(found.name, found.url);
    },
  };

  const openTab: ToolSpec = {
    name: 'open_tab',
    description: DESC.openTab,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        accountId: { type: 'string', description: PARAM.profileId },
      },
      required: ['url'],
      additionalProperties: false,
    },
    run: async ({ url, accountId }) => {
      tabManager.createTab({
        url: String(url),
        profileId: accountId ? String(accountId) : 'default',
        openedByAgent: true,
      });
      return RESULT.tabOpened(String(url));
    },
  };

  const askUserTool: ToolSpec = {
    name: 'ask_user',
    description:
      DESC.askUser,
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: PARAM.question },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: PARAM.choices,
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
    run: async ({ question, choices }) => {
      const options = Array.isArray(choices) ? choices.map(String) : undefined;

      try {
        return RESULT.userAnswered(await askUser(String(question), options));
      } catch {
        return RESULT.userDidNotAnswer;
      }
    },
  };

  const askUserFormTool: ToolSpec = {
    name: 'ask_user_form',
    description: DESC.askUserForm,
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: PARAM.question },
        fields: {
          type: 'array',
          description: PARAM.formFields,
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              placeholder: { type: 'string' },
              type: { type: 'string', enum: [...QUESTION_FIELD_TYPES] },
              choices: {
                type: 'array',
                description: PARAM.formChoiceItems,
                items: {
                  type: 'object',
                  properties: { label: { type: 'string' }, value: { type: 'string' } },
                  required: ['label', 'value'],
                  additionalProperties: false,
                },
              },
              value: { type: 'string' },
              optional: { type: 'boolean' },
            },
            required: ['key', 'label'],
            additionalProperties: false,
          },
        },
      },
      required: ['question', 'fields'],
      additionalProperties: false,
    },
    run: async ({ question, fields }) => {
      if (!Array.isArray(fields) || fields.length === 0) return RESULT.formNoFields;

      const checked = normalizeQuestionFields(fields);
      if (!checked.ok) {
        return checked.reason === 'prefill'
          ? RESULT.formPrefillNotInChoices(checked.key)
          : RESULT.formBadFields;
      }

      try {
        const answer = parseFormAnswer(await askUserForm(String(question), checked.fields));
        if (answer.cancelled) return RESULT.formCancelled;

        const lines = formatFormAnswer(checked.fields, answer.values);
        // 전부 비운 채 확인을 누른 것은 답이 아니다. 빈 줄을 답변으로 넘기면 모델이 추측으로 잇는다.
        if (lines.length === 0) return RESULT.formEmptyAnswer;

        return RESULT.userAnsweredForm(lines);
      } catch {
        return RESULT.userDidNotAnswer;
      }
    },
  };

  const checkServicesTool: ToolSpec = {
    name: 'check_services',
    description:
      DESC.checkServices,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const health = await checkServices(getEndpoints(), getSchedulerToken());
      return JSON.stringify(health);
    },
  };

  const dabutLogin: ToolSpec = {
    name: 'dabut_login',
    description: DESC.dabutLogin,
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', description: PARAM.loginReason } },
      additionalProperties: false,
    },
    run: async ({ reason }) => requestDabutLogin(String(reason ?? '')),
  };

  const listProjects: ToolSpec = {
    name: 'list_dabut_projects',
    description: DESC.listDabutProjects,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      try {
        const projects = await listDabutProjects(getEndpoints().dabutBaseUrl, getSchedulerToken());
        if (projects.length === 0) return RESULT.noDabutProjects;

        // 예약이 받을 수 있는 projectId 를 여기서 확정한다. 목록에 없던 id 는 이후에 거부된다.
        // 라벨도 같이 담아 둔다. get_schedule 이 저장된 id 를 사람이 읽을 이름으로 되돌린다.
        projects.forEach(({ id, label }) => {
          knownProjectIds.add(String(id));
          if (label) projectLabels.set(String(id), label);
        });

        return JSON.stringify(
          projects.map(({ id, label, description, model }) => ({ id, label, description, model })),
        );
      } catch (error) {
        return `프로젝트 목록을 못 가져왔다: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  const generateViaDabut: ToolSpec = {
    name: 'generate_manuscript_dabut',
    description: DESC.generateManuscriptDabut,
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: PARAM.projectId },
        keyword: { type: 'string', description: PARAM.keyword },
        ref: { type: 'string', description: PARAM.ref },
        businessName: { type: 'string', description: PARAM.businessName },
        withImages: { type: 'boolean', description: PARAM.withImages },
      },
      required: ['projectId', 'keyword'],
      additionalProperties: false,
    },
    run: async ({ projectId, keyword, ref, businessName, withImages }) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      onProgress(PROGRESS.dabutGenerating(String(keyword)));

      const result = await generateManuscriptViaProject({
        baseUrl: getEndpoints().dabutBaseUrl,
        token: getSchedulerToken() ?? '',
        projectId: String(projectId),
        keyword: String(keyword),
        ref: ref ? String(ref) : undefined,
        businessName: businessName ? String(businessName) : undefined,
        withImages: withImages === true,
      });

      if (!result.content) return RESULT.dabutEmpty;

      const { title, body } = splitManuscript(result.content);
      return JSON.stringify({
        title,
        body,
        project: result.projectLabel,
        images: result.imageCount,
      });
    },
  };

  const listSchedulerAccountsTool: ToolSpec = {
    name: 'list_scheduler_accounts',
    description:
      DESC.listSchedulerAccounts,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      try {
        const accounts = await listSchedulerAccounts(getEndpoints().schedulerBaseUrl, getSchedulerToken());
        if (accounts.length === 0) return RESULT.noSchedulerAccounts;

        // 예약 도구들이 소유 판정에 쓰는 표를 여기서 미리 채운다. 같은 응답을 두 번 받지 않는다.
        const owned = indexOwnedAccounts(accounts);
        if (owned.size > 0) ownedAccountsCache = owned;

        // loginId 는 네이버 로그인 id 원문이라 소유 판정에만 쓰고 모델에게는 내보내지 않는다.
        return JSON.stringify(
          accounts.map(({ id, name, blogId }) => ({ id, name, blogId })),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return RESULT.schedulerUnreachable(message);
      }
    },
  };

  const autoSchedule: ToolSpec = {
    name: 'auto_schedule_posts',
    description:
      DESC.autoSchedulePosts,
    parameters: {
      type: 'object',
      properties: {
        scheduleDate: { type: 'string', description: PARAM.scheduleDate },
        accountId: {
          type: 'string',
          description:
            PARAM.schedulerAccountId,
        },
        keywords: { type: 'array', items: { type: 'string' } },
        blogName: { type: 'string', description: PARAM.blogName },
        postsPerDay: {
          type: 'number',
          description: PARAM.postsPerDay,
          minimum: SCHEDULE_LIMITS.postsPerDayMin,
          maximum: SCHEDULE_LIMITS.postsPerDayMax,
        },
        startHour: {
          type: 'number',
          description: PARAM.startHour,
          minimum: SCHEDULE_LIMITS.startHourMin,
          maximum: SCHEDULE_LIMITS.startHourMax,
        },
        intervalMinutes: {
          type: 'number',
          description: PARAM.intervalMinutes,
          minimum: SCHEDULE_LIMITS.intervalMinutesMin,
          maximum: SCHEDULE_LIMITS.intervalMinutesMax,
        },
        manuscriptType: {
          type: 'string',
          enum: [...MANUSCRIPT_TYPES],
          description: PARAM.manuscriptType,
        },
        imageSource: { type: 'string', enum: [...IMAGE_SOURCES], description: PARAM.imageSource },
        projectId: { type: 'string', description: PARAM.scheduleProjectId },
        keywordCategory: { type: 'string', description: PARAM.keywordCategory },
      },
      required: ['scheduleDate', 'accountId', 'keywords'],
      additionalProperties: false,
    },
    run: async (input) => {
      // accountId 는 다붓이 준 계정 id 라서 스케줄러가 토큰 없이는 크리덴셜을 풀지 못한다.
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const built = buildAutoScheduleInput(input, knownProjectIds);
      if (!built.ok) return built.result;

      const { scheduleDate, queues } = built.input;
      const keywordCount = queues.reduce((sum, { keywords }) => sum + keywords.length, 0);

      onProgress(PROGRESS.scheduleRegistering(scheduleDate, keywordCount));

      let data: unknown;

      try {
        data = await autoSchedulePosts({
          baseUrl: getEndpoints().schedulerBaseUrl,
          token: getSchedulerToken(),
          ...built.input,
        });
      } catch (error) {
        // 400 본문에는 어떤 필드가 틀렸는지가 들어 있다. axios 메시지만 올리면 그게 사라진다.
        return RESULT.scheduleFailed(describeSchedulerError(error));
      }

      const { ok, message, totalJobs, reused, scheduleIds } = readAutoScheduleResult(data);

      // 응답 원문을 잘라 넣으면 키워드가 많을 때 JSON 이 중간에서 끊겨 모델이 파싱할 수 없는
      // 텍스트가 컨텍스트에 남는다. 필요한 것은 잡 목록이 아니라 되읽을 scheduleId 뿐이다.
      // 나머지는 어차피 get_schedule 로 서버에서 다시 읽어야 한다.
      const payload = JSON.stringify({ scheduleIds, totalJobs, reused });

      // 계정 해석 실패는 HTTP 200 + success:false 로 온다. 그대로 완료로 보고하면
      // 아무것도 큐에 안 들어간 채 "예약 등록 완료" 로 끝난다.
      if (!ok) return RESULT.scheduleFailed(message || JSON.stringify(data).slice(0, 600));
      if (reused) return RESULT.scheduleReused(totalJobs, payload);

      return RESULT.scheduled(payload);
    },
  };

  const listSchedulesTool: ToolSpec = {
    name: 'list_schedules',
    description: DESC.listSchedules,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.scheduleAccountFilter },
        status: {
          type: 'string',
          enum: [...SCHEDULE_STATUSES],
          description: PARAM.scheduleStatusFilter,
        },
      },
      additionalProperties: false,
    },
    run: async ({ accountId, status }) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const ownedResult = await loadOwnedAccounts();
      if (!ownedResult.ok) return ownedResult.result;

      const { owned } = ownedResult;
      const filter = resolveScheduleAccountFilter(accountId, owned);
      if (!filter.ok) return filter.result;

      onProgress(PROGRESS.scheduleListLoading);

      try {
        // 필터 없이 부르면 스케줄러가 테넌트 구분 없이 최근 50건을 준다. 남의 예약이 섞이는 것도
        // 문제지만, 다른 사용자가 바쁘면 내 예약이 그 50건 밖으로 밀려 아예 안 보이기도 한다.
        // 그래서 내 계정마다 따로 물어보고 여기서 다시 최신순으로 합친다.
        const lists = await Promise.all(
          filter.accounts.map(({ loginId }) =>
            listSchedules({
              baseUrl: getEndpoints().schedulerBaseUrl,
              token: getSchedulerToken(),
              accountId: loginId,
              status: status ? String(status) : undefined,
            }),
          ),
        );

        // 계정을 지정해 물었어도 서버가 걸러 준다고 믿지 않는다. 소유 판정은 우리가 한다.
        const schedules = mergeScheduleLists(lists, MAX_LIST_SCHEDULES).filter(({ accountId: owner }) =>
          isOwnedSchedule(owner, owned),
        );

        if (schedules.length === 0) return RESULT.noSchedules;

        // 취소가 받을 수 있는 scheduleId 를 여기서 확정한다. 읽은 적 없는 id 는 이후에 거부된다.
        toKnownSchedules(schedules).forEach((schedule) => knownSchedules.set(schedule.id, schedule));

        // 계정은 네이버 로그인 id 원문 대신 사용자가 붙여 둔 이름으로 낸다.
        return JSON.stringify(
          schedules.map((schedule) => ({
            scheduleId: schedule.id,
            scheduleDate: schedule.scheduleDate,
            account: describeScheduleAccount(schedule.accountId, owned),
            status: scheduleStatusLabel(schedule.status),
            totalJobs: schedule.totalJobs,
            completedJobs: schedule.completedJobs,
            failedJobs: schedule.failedJobs,
          })),
        );
      } catch (error) {
        return RESULT.scheduleReadFailed(describeSchedulerError(error));
      }
    },
  };

  const getScheduleTool: ToolSpec = {
    name: 'get_schedule',
    description: DESC.getSchedule,
    parameters: {
      type: 'object',
      properties: { scheduleId: { type: 'string', description: PARAM.scheduleId } },
      required: ['scheduleId'],
      additionalProperties: false,
    },
    run: async ({ scheduleId }) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const id = scheduleId === undefined || scheduleId === null ? '' : String(scheduleId).trim();
      if (!id) return RESULT.scheduleIdRequired;

      const ownedResult = await loadOwnedAccounts();
      if (!ownedResult.ok) return ownedResult.result;

      const { owned } = ownedResult;

      onProgress(PROGRESS.scheduleDetailLoading(id));

      try {
        const { schedule, jobs } = await getSchedule({
          baseUrl: getEndpoints().schedulerBaseUrl,
          token: getSchedulerToken(),
          scheduleId: id,
        });

        if (!schedule) return RESULT.scheduleNotFound(id);

        // 이 라우트에는 소유자 스코프가 없다. 남의 예약을 읽어 knownSchedules 에 넣으면
        // 취소 게이트가 그 id 를 "내가 읽은 것" 으로 인정해 버린다.
        if (!isOwnedSchedule(schedule.accountId, owned)) return RESULT.scheduleNotOwned(id);

        toKnownSchedules([schedule]).forEach((row) => knownSchedules.set(row.id, row));

        if (jobs.length === 0) return RESULT.scheduleNoJobs(id, scheduleStatusLabel(schedule.status));

        return JSON.stringify(formatScheduleJobRows(jobs, projectLabels));
      } catch (error) {
        // axios 는 404 를 던지므로 "없는 예약" 은 schedule === null 이 아니라 여기로 온다.
        if (isScheduleNotFound(error)) return RESULT.scheduleNotFound(id);

        return RESULT.scheduleReadFailed(describeSchedulerError(error));
      }
    },
  };

  const cancelScheduleTool: ToolSpec = {
    name: 'cancel_schedule',
    description: DESC.cancelSchedule,
    parameters: {
      type: 'object',
      properties: { scheduleId: { type: 'string', description: PARAM.scheduleId } },
      required: ['scheduleId'],
      additionalProperties: false,
    },
    run: async (input) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const plan = planScheduleCancel({
        raw: input.scheduleId,
        known: knownSchedules,
        attempted: attemptedScheduleIds,
        refused: refusedScheduleIds,
      });

      if (!plan.ok) return plan.result;

      const ownedResult = await loadOwnedAccounts();
      if (!ownedResult.ok) return ownedResult.result;

      const { owned } = ownedResult;
      const { scheduleId } = plan;
      const endpoint = { baseUrl: getEndpoints().schedulerBaseUrl, token: getSchedulerToken(), scheduleId };

      // 목록에는 키워드도 시각도 없다. 확인 문안을 만들려면 상세를 직접 한 번 읽어야 한다.
      // 서버의 지금 상태로 묻게 되므로 "목록이 낡아서 엉뚱한 걸 취소" 하는 구간이 없다.
      onProgress(PROGRESS.scheduleDetailLoading(scheduleId));

      let schedule: ScheduleSummary | null;
      let jobs: ScheduleJobDetail[];

      try {
        ({ schedule, jobs } = await getSchedule(endpoint));
      } catch (error) {
        if (isScheduleNotFound(error)) return RESULT.scheduleNotFound(scheduleId);

        return RESULT.scheduleReadFailed(describeSchedulerError(error));
      }

      if (!schedule) return RESULT.scheduleNotFound(scheduleId);

      // DELETE /schedules/:id 에도 소유자 확인이 없다. 방금 서버에서 읽은 계정으로 여기서 막는다.
      // 확인 카드를 띄우기 전에 끊어야 사용자가 남의 예약 취소를 승인할 기회조차 생기지 않는다.
      if (!isOwnedSchedule(schedule.accountId, owned)) {
        knownSchedules.delete(scheduleId);

        return RESULT.scheduleNotOwned(scheduleId);
      }

      if (schedule.status === 'cancelled') return RESULT.scheduleAlreadyCancelled(scheduleId);

      onProgress(PROGRESS.scheduleCancelConfirmWaiting(scheduleId));

      const { approved, answer, answered } = await requestScheduleCancelApproval({
        askUser,
        schedule,
        jobs,
        owned,
      });

      if (!approved) {
        refusedScheduleIds.add(scheduleId);

        // 답이 없어 시간이 지난 것을 거절로 적으면 사용자가 하지 않은 답변을 지어내게 된다.
        return answered ? RESULT.scheduleCancelNotApproved(answer) : RESULT.scheduleCancelNoAnswer(scheduleId);
      }

      // 확인 카드에 적은 숫자와 결과에 적을 숫자는 같은 스냅샷에서 나와야 한다.
      const stoppable = countStoppableJobs(jobs);
      const published = countPublishedJobs(jobs);

      // 기록은 보내기 직전에 남긴다. 응답이 끊겨도 서버에서는 이미 처리됐을 수 있다.
      attemptedScheduleIds.add(scheduleId);
      onProgress(PROGRESS.scheduleCancelling(scheduleId));

      try {
        const { ok } = await cancelSchedule(endpoint);
        if (!ok) return RESULT.scheduleCancelNotConfirmed(scheduleId);
      } catch (error) {
        return RESULT.scheduleCancelFailed(describeSchedulerError(error));
      }

      // known 에서 지우면 같은 id 로 다시 불렸을 때 "읽은 적 없다" 는 사실이 아닌 이유가 나간다.
      // 상태만 갱신해서 남겨 두면 attempted 가드가 먼저 걸려 참인 이유를 돌려준다.
      toKnownSchedules([{ ...schedule, status: 'cancelled' }]).forEach((row) =>
        knownSchedules.set(row.id, row),
      );

      return RESULT.scheduleCancelled(scheduleId, stoppable, jobs.length, published);
    },
  };

  const listExposureJobsTool: ToolSpec = {
    name: 'list_exposure_jobs',
    description: DESC.listExposureJobs,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const { exposureBotDir } = getEndpoints();
      if (!exposureBotDir) return RESULT.exposureDirUnset;

      const jobs = listExposureJobs(exposureBotDir);
      if (!jobs.length) return RESULT.exposureNoJobs(exposureBotDir);

      return JSON.stringify(jobs.map(({ key, label, description }) => ({ key, label, description })));
    },
  };

  const runExposureCheck: ToolSpec = {
    name: 'run_exposure_check',
    description:
      DESC.runExposureCheck,
    parameters: {
      type: 'object',
      properties: { job: { type: 'string', description: PARAM.exposureJob } },
      required: ['job'],
      additionalProperties: false,
    },
    run: async ({ job }) => {
      const { exposureBotDir } = getEndpoints();
      if (!exposureBotDir) return RESULT.exposureDirUnset;

      const target = findExposureJob(exposureBotDir, String(job));
      if (!target) return RESULT.unknownExposureJob;

      onProgress(PROGRESS.exposureStarting(target.label));

      const { code, output } = await runPackageScript({
        cwd: exposureBotDir,
        script: target.script,
        onLine: (line) => onProgress(line.slice(0, 160)),
      });

      return code === 0
        ? RESULT.exposureDone(target.label, output.slice(-1500))
        : RESULT.exposureFailed(code, output.slice(-1500));
    },
  };

  return [
    askUserTool,
    askUserFormTool,
    listAccounts,
    checkLogin,
    naverLogin,
    checkServicesTool,
    dabutLogin,
    listProjects,
    generateViaDabut,
    generateManuscript,
    publishBlogPost,
    listMyPosts,
    deleteBlogPosts,
    listSchedulerAccountsTool,
    autoSchedule,
    listSchedulesTool,
    getScheduleTool,
    cancelScheduleTool,
    listExposureJobsTool,
    runExposureCheck,
    listServices,
    openService,
    openTab,
  ];
};

export { buildAgentSystemPrompt };
