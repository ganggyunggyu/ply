import type { AxiosInstance } from 'axios';
import type { AccountStore } from './accounts';
import { generateText, type ToolSpec } from './openrouter';
import { CONFIRM, ERRORS, PROGRESS } from './messages';
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
  checkServices,
  findExposureJob,
  listExposureJobs,
  generateManuscriptViaProject,
  listDabutProjects,
  listSchedulerAccounts,
  runPackageScript,
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
  requestDabutLogin: (reason: string) => Promise<string>;
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
    requestDabutLogin,
  } = context;

  // createNaverTools 는 실행마다 새로 불린다. 따라서 이 세 값은 자연히 실행 단위다.
  const knownPosts = new Map<string, KnownPost>();
  const attemptedLogNos = new Set<string>();
  const refusedLogNos = new Set<string>();

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

        return JSON.stringify(accounts);
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
        blogName: { type: 'string' },
        postsPerDay: { type: 'number' },
        startHour: { type: 'number' },
        intervalMinutes: { type: 'number' },
        manuscriptType: { type: 'string', description: PARAM.manuscriptType },
        keywordCategory: { type: 'string' },
      },
      required: ['scheduleDate', 'accountId', 'keywords'],
      additionalProperties: false,
    },
    run: async (input) => {
      const keywords = Array.isArray(input.keywords) ? input.keywords.map(String) : [];
      if (keywords.length === 0) return RESULT.emptyKeywords;

      onProgress(PROGRESS.scheduleRegistering(String(input.scheduleDate), keywords.length));

      const data = await autoSchedulePosts({
        baseUrl: getEndpoints().schedulerBaseUrl,
        token: getSchedulerToken(),
        scheduleDate: String(input.scheduleDate),
        queues: [
          {
            account: { id: String(input.accountId) },
            keywords,
            blog_name: input.blogName ? String(input.blogName) : undefined,
          },
        ],
        postsPerDay: input.postsPerDay === undefined ? undefined : Number(input.postsPerDay),
        startHour: input.startHour === undefined ? undefined : Number(input.startHour),
        intervalMinutes:
          input.intervalMinutes === undefined ? undefined : Number(input.intervalMinutes),
        manuscriptType: input.manuscriptType ? String(input.manuscriptType) : undefined,
        keywordCategory: input.keywordCategory ? String(input.keywordCategory) : undefined,
      });

      return RESULT.scheduled(JSON.stringify(data).slice(0, 1200));
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
    listExposureJobsTool,
    runExposureCheck,
    listServices,
    openService,
    openTab,
  ];
};

export { buildAgentSystemPrompt };
