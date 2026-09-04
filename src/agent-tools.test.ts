import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { AxiosInstance } from 'axios';
import type { AccountStore } from './accounts';
import { REDACTED } from './api-access';
import type { AccountCardRequest, QuestionField } from './bridge';
import { toKstDate } from './clock';
import { QUESTION_FORM_CANCEL } from './constants';
import { CONFIRM, ERRORS } from './messages';
import {
  IMAGE_SOURCES,
  MANUSCRIPT_TYPES,
  SCHEDULE_JOB_STATUSES,
  SCHEDULE_LIMITS,
  SCHEDULE_STATUSES,
} from './scheduler-enums';
import type { ToolSpec } from './openrouter';
import { RESULT_PRESET, TOOL_RESULTS as RESULT } from './prompts';
import { applyServiceUrls } from './services';
import type { TabManager } from './tabs';
import type { ScheduleJobDetail, ScheduleSummary } from './hub';
import { formatToolOutput } from './tool-output';
import {
  buildAgentSystemPrompt,
  buildAutoScheduleInput,
  describeDabutSync,
  isAccountRemoveApproved,
  isExposureRunApproved,
  isPresetSaveApproved,
  parseCardOutcome,
  requestAccountRemoveApproval,
  requestExposureRunApproval,
  stoppedDeleteRows,
  clampListLimit,
  countPublishedJobs,
  countStoppableJobs,
  createNaverTools,
  describeScheduleAccount,
  describeToolError,
  formatFormAnswer,
  formatScheduleJobRows,
  hasNaverSession,
  indexOwnedAccounts,
  isCancelApproved,
  isDeleteApproved,
  isOwnedSchedule,
  MAX_CANCEL_PER_RUN,
  MAX_DELETE_PER_CALL,
  MAX_DELETE_PER_RUN,
  MAX_SCHEDULE_ACCOUNTS,
  mergeScheduleLists,
  normalizeQuestionFields,
  parseFormAnswer,
  planDeletion,
  planScheduleCancel,
  requestDeleteApproval,
  requestScheduleCancelApproval,
  resolveDeleteTargets,
  resolveScheduleAccountFilter,
  splitManuscript,
  STOPPABLE_JOB_STATUSES,
  toKnownPosts,
  toKnownSchedules,
  type KnownPost,
  type KnownSchedule,
  type OwnedAccount,
  type ToolContext,
} from './agent-tools';

test('첫 줄을 제목으로 뗀다', () => {
  const { title, body } = splitManuscript('강아지 유치원 고르는 법\n\n첫 문단입니다.\n둘째 문단입니다.');

  assert.equal(title, '강아지 유치원 고르는 법');
  assert.equal(body, '첫 문단입니다.\n둘째 문단입니다.');
});

test('제목: 접두사를 떼어낸다', () => {
  assert.equal(splitManuscript('제목: 하이\n본문').title, '하이');
  assert.equal(splitManuscript('제목：하이\n본문').title, '하이');
});

test('본문이 없으면 원문을 본문으로 쓴다', () => {
  const { body } = splitManuscript('한 줄짜리');

  assert.equal(body, '한 줄짜리');
});

test('네이버 세션 판정은 쿠키 두 개를 모두 본다', () => {
  assert.equal(hasNaverSession(['NID_AUT', 'NID_SES', 'NNB']), true);
  assert.equal(hasNaverSession(['NID_AUT']), false);
  assert.equal(hasNaverSession([]), false);
});

const knownFixture = () =>
  new Map<string, KnownPost>([
    [
      '223344556677',
      {
        logNo: '223344556677',
        title: '가',
        addDate: '2026.08.30',
        blogId: 'sampleblog',
        accountId: 'acc-a',
      },
    ],
  ]);

test('이번 실행에서 본 logNo 는 통과시킨다', () => {
  const check = resolveDeleteTargets(['223344556677'], knownFixture(), 'acc-a');

  assert.deepEqual(check, { ok: true, logNos: ['223344556677'] });
});

test('배열이 아니거나 비어 있으면 대상이 없다', () => {
  assert.equal(resolveDeleteTargets(undefined, knownFixture(), 'acc-a').ok, false);
  assert.equal(resolveDeleteTargets([], knownFixture(), 'acc-a').ok, false);

  const check = resolveDeleteTargets('223344556677', knownFixture(), 'acc-a');
  assert.deepEqual(check, { ok: false, reason: 'empty', detail: [] });
});

test('logNo 형식이 아니면 먼저 거른다', () => {
  const check = resolveDeleteTargets(['abc', '123'], knownFixture(), 'acc-a');

  assert.deepEqual(check, { ok: false, reason: 'invalid', detail: ['abc', '123'] });
});

test('개수 초과를 미확인 판정보다 먼저 잡는다', () => {
  const many = Array.from({ length: 11 }, (_, index) => `99999999999${index}`);
  const check = resolveDeleteTargets(many, knownFixture(), 'acc-a');

  assert.equal(check.ok, false);
  assert.equal(check.ok === false && check.reason, 'tooMany');
});

test('목록에서 본 적 없는 logNo 는 거부한다', () => {
  const check = resolveDeleteTargets(['999999999999'], knownFixture(), 'acc-a');

  assert.deepEqual(check, { ok: false, reason: 'unknown', detail: ['999999999999'] });
});

test('목록을 읽은 계정과 다르면 거부한다', () => {
  const check = resolveDeleteTargets(['223344556677'], knownFixture(), 'acc-b');

  assert.deepEqual(check, { ok: false, reason: 'accountMismatch', detail: ['223344556677'] });
});

test('같은 logNo 를 여러 번 넣어도 한 번만 지운다', () => {
  const check = resolveDeleteTargets(
    ['223344556677', '223344556677', '223344556677'],
    knownFixture(),
    'acc-a',
  );

  assert.deepEqual(check, { ok: true, logNos: ['223344556677'] });
});

test('list_my_posts 없이는 아무것도 지울 수 없다', () => {
  const check = resolveDeleteTargets(['223344556677'], new Map<string, KnownPost>(), 'acc-a');

  assert.deepEqual(check, { ok: false, reason: 'unknown', detail: ['223344556677'] });
});

test('승인 토큰이 정확히 맞아야 삭제를 승인한다', () => {
  assert.equal(isDeleteApproved(CONFIRM.deleteYes), true);
  assert.equal(isDeleteApproved(`  ${CONFIRM.deleteYes}  `), true);
});

test('정확일치가 아닌 답은 전부 취소로 본다', () => {
  ['네', '예', 'ㅇㅇ', '취소', '아니요', '', '   ', '네, 삭제할게요!'].forEach((answer) => {
    assert.equal(isDeleteApproved(answer), false, answer);
  });
});

test('목록 개수가 이상하면 기본값 10을 쓴다', () => {
  [undefined, 0, -3, 'abc'].forEach((raw) => assert.equal(clampListLimit(raw), 10));
});

test('목록 개수는 30을 넘지 않는다', () => {
  assert.equal(clampListLimit(100), 30);
  assert.equal(clampListLimit(31), 30);
});

test('정상 범위의 목록 개수는 그대로 쓴다', () => {
  assert.equal(clampListLimit(5), 5);
  assert.equal(clampListLimit('5'), 5);
});

const knownEntry = (logNo: string, overrides: Partial<KnownPost> = {}): KnownPost => ({
  logNo,
  title: `제목 ${logNo}`,
  addDate: '2026.08.30',
  blogId: 'sampleblog',
  accountId: 'acc-a',
  ...overrides,
});

const knownMap = (...posts: KnownPost[]) => new Map(posts.map((post) => [post.logNo, post]));

const emptyPlanState = () => ({
  attempted: new Set<string>(),
  refused: new Set<string>(),
  accountId: 'acc-a',
});

test('목록 결과를 실행 기록으로 옮길 때 계정과 블로그를 함께 박는다', () => {
  const [post] = toKnownPosts(
    [{ logNo: '223344556677', title: '개', addDate: '2026.08.30', postUrl: 'https://blog.naver.com/sampleblog/223344556677' }],
    'sampleblog',
    'acc-a',
  );

  assert.deepEqual(post, {
    logNo: '223344556677',
    title: '개',
    addDate: '2026.08.30',
    blogId: 'sampleblog',
    accountId: 'acc-a',
  });
});

test('목록에서 본 글이면 삭제 계획이 선다', () => {
  const plan = planDeletion({
    raw: ['223344556677'],
    known: knownMap(knownEntry('223344556677')),
    ...emptyPlanState(),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.ok === true && plan.blogId, 'sampleblog');
  assert.deepEqual(plan.ok === true && plan.targets.map(({ logNo }) => logNo), ['223344556677']);
});

test('사용자가 거절한 글은 같은 실행에서 다시 물어보지 못한다', () => {
  const state = emptyPlanState();
  state.refused.add('223344556677');

  const plan = planDeletion({
    raw: ['223344556677'],
    known: knownMap(knownEntry('223344556677')),
    ...state,
  });

  assert.deepEqual(plan, { ok: false, result: RESULT.deleteRefusedEarlier(['223344556677']) });
});

test('이미 시도한 글은 재시도할 수 없다', () => {
  const state = emptyPlanState();
  state.attempted.add('223344556677');

  const plan = planDeletion({
    raw: ['223344556677'],
    known: knownMap(knownEntry('223344556677')),
    ...state,
  });

  assert.deepEqual(plan, { ok: false, result: RESULT.deleteRetryBlocked(['223344556677']) });
});

test('실행 상한은 성공 건수가 아니라 시도 건수로 센다', () => {
  const state = emptyPlanState();
  const known = new Map<string, KnownPost>();

  // 앞선 호출에서 9건을 시도했지만 검증이 전부 unknown 이라 성공은 0건인 상황.
  for (let index = 0; index < MAX_DELETE_PER_RUN - 1; index += 1) {
    state.attempted.add(`10000000000${index}`);
  }

  const fresh = ['223344556677', '223344556678'];
  fresh.forEach((logNo) => known.set(logNo, knownEntry(logNo)));

  assert.deepEqual(planDeletion({ raw: fresh, known, ...state }), {
    ok: false,
    result: RESULT.deleteRunLimit(MAX_DELETE_PER_RUN),
  });

  const oneMore = planDeletion({ raw: ['223344556677'], known, ...state });
  assert.equal(oneMore.ok, true);
});

test('서로 다른 블로그의 글이 섞이면 계획을 세우지 않는다', () => {
  const plan = planDeletion({
    raw: ['223344556677', '223344556678'],
    known: knownMap(
      knownEntry('223344556677'),
      knownEntry('223344556678', { blogId: 'other__blog' }),
    ),
    ...emptyPlanState(),
  });

  assert.deepEqual(plan, { ok: false, result: RESULT.deleteBlogMismatch });
});

test('승인 문안에는 지울 글의 제목과 logNo 가 전부 들어간다', async () => {
  const asked: { question: string; choices?: string[] }[] = [];

  const result = await requestDeleteApproval({
    askUser: async (question, choices) => {
      asked.push({ question, choices });
      return CONFIRM.deleteYes;
    },
    blogId: 'sampleblog',
    targets: [knownEntry('223344556677'), knownEntry('223344556678')],
  });

  assert.equal(result.approved, true);
  assert.equal(asked.length, 1);
  assert.ok(asked[0]?.question.includes('제목 223344556677'));
  assert.ok(asked[0]?.question.includes('223344556678'));
  assert.ok(asked[0]?.question.includes('sampleblog'));
  assert.deepEqual(asked[0]?.choices, [CONFIRM.deleteYes, CONFIRM.deleteNo]);
});

test('정확일치가 아닌 답으로는 삭제를 승인하지 않는다', async () => {
  const result = await requestDeleteApproval({
    askUser: async () => '네, 삭제할게요!',
    blogId: 'sampleblog',
    targets: [knownEntry('223344556677')],
  });

  assert.deepEqual(result, { approved: false, answer: '네, 삭제할게요!' });
});

test('답을 기다리다 끊기면 승인이 아니라 취소로 떨어진다', async () => {
  const result = await requestDeleteApproval({
    askUser: async () => {
      throw new Error(ERRORS.questionTimeout);
    },
    blogId: 'sampleblog',
    targets: [knownEntry('223344556677')],
  });

  assert.deepEqual(result, { approved: false, answer: CONFIRM.deleteNo });
});

test('알 수 없는 예외는 원문 대신 우리 문장으로 바꾼다', () => {
  const playwrightError = new Error('Execution context was destroyed\nCall log:\n  - waiting for locator');

  assert.equal(describeToolError(playwrightError), ERRORS.deleteFailed);
  assert.equal(describeToolError(new Error(ERRORS.sessionExpired)), ERRORS.sessionExpired);
});

const STUB_ACCOUNT = { id: 'acc-a', label: '메인 계정', naverId: 'sampleblog', hasPassword: true };

/** list_dabut_projects 를 부르지 않은 실행. projectId 를 실으면 거부되어야 한다. */
const NO_PROJECTS: ReadonlySet<string> = new Set<string>();

/** 오늘을 고정한다. 실제 시계를 쓰면 과거 날짜 게이트가 날마다 다르게 판정된다. */
const TODAY = '2026-09-01';

/**
 * 도구를 통째로 부르는 테스트는 진짜 시계를 탄다.
 * 오늘로 걸면 startHour 가 지난 시각인지에 따라 결과가 하루 안에서도 달라지므로 내일로 건다.
 */
const kstTomorrow = () => toKstDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

/** startHour 는 필수라 기본값을 채워 준다. raw 가 주면 그 값이 이긴다. */
const buildSchedule = (
  raw: Record<string, unknown>,
  knownProjectIds: ReadonlySet<string> = NO_PROJECTS,
  today: string = TODAY,
  nowMinutes = 0,
) => buildAutoScheduleInput({ startHour: 9, ...raw }, { knownProjectIds, today, nowMinutes });

const createStubContext = (
  cookieNames: string[] = ['NID_AUT', 'NID_SES'],
  answer: () => Promise<string> = async () => CONFIRM.deleteYes,
  formAnswer: () => Promise<string> = async () => '{}',
  schedulerToken: string | undefined = undefined,
  viroToken: string | undefined = undefined,
) => {
  const spy = {
    askUserCalls: [] as string[],
    createTabCalls: 0,
    createdTabIds: [] as number[],
    createTabOptions: [] as { url?: string; openedByAgent?: boolean; focus?: boolean }[],
    closedTabIds: [] as number[],
    selectedTabIds: [] as number[],
    formCalls: [] as { question: string; fields: QuestionField[] }[],
    accountCardCalls: [] as Omit<AccountCardRequest, 'id'>[],
    removedAccountIds: [] as string[],
    exposureCookieCleared: 0,
  };

  const findAccount = (id: string) => (id === STUB_ACCOUNT.id ? STUB_ACCOUNT : undefined);

  let nextTabId = 1;

  const createTab = (options: { url?: string; openedByAgent?: boolean; focus?: boolean } = {}) => {
    spy.createTabCalls += 1;
    spy.createTabOptions.push(options);
    const tabId = nextTabId;
    nextTabId += 1;
    spy.createdTabIds.push(tabId);

    return tabId;
  };

  const closeTab = (tabId: number) => {
    spy.closedTabIds.push(tabId);
  };

  const selectTab = (tabId: number) => {
    spy.selectedTabIds.push(tabId);
  };

  const askUser = async (question: string) => {
    spy.askUserCalls.push(question);
    return answer();
  };

  const askUserForm = async (question: string, fields: QuestionField[]) => {
    spy.formCalls.push({ question, fields });
    return formAnswer();
  };

  const context: ToolContext = {
    accountStore: {
      list: () => [STUB_ACCOUNT],
      find: findAccount,
      remove: (id: string) => {
        spy.removedAccountIds.push(id);
        return [];
      },
    } as unknown as AccountStore,
    tabManager: { createTab, closeTab, selectTab } as unknown as TabManager,
    cdpPort: 0,
    client: {} as AxiosInstance,
    writerModel: 'test/writer',
    getEndpoints: () => ({
      dabutBaseUrl: '',
      schedulerBaseUrl: '',
      exposureBotDir: '',
      exposureDashboardUrl: '',
      viroBaseUrl: '',
    }),
    getSchedulerToken: () => schedulerToken,
    getViroToken: () => viroToken,
    getCookieNames: async () => cookieNames,
    onProgress: () => undefined,
    askUser,
    askUserForm,
    requestDabutLogin: async () => '',
    requestAccountCard: async (request) => {
      spy.accountCardCalls.push(request);
      return '{}';
    },
    requestExposureLogin: async () => '{}',
    getExposureCookie: () => undefined,
    clearExposureCookie: () => {
      spy.exposureCookieCleared += 1;
    },
  };

  return { context, spy };
};

const findTool = (tools: ToolSpec[], name: string) => {
  const tool = tools.find((item) => item.name === name);
  assert.ok(tool, name);

  return tool;
};

// ---------- 작업용 탭 정리 ----------

test('publish_blog_post 는 도중에 실패해도 연 탭을 닫는다', async () => {
  // cdpPort 가 0 이라 브라우저 연결에서 던진다. 그 경로에서도 탭이 남으면 안 된다.
  const { context, spy } = createStubContext();

  await assert.rejects(
    findTool(createNaverTools(context), 'publish_blog_post').run({
      accountId: STUB_ACCOUNT.id,
      title: '제목',
      body: '본문',
    }),
  );

  assert.deepEqual(spy.closedTabIds, spy.createdTabIds);
  assert.equal(spy.closedTabIds.length, 1);
});

test('list_my_posts 도 실패한 실행의 탭을 남기지 않는다', async () => {
  const { context, spy } = createStubContext();

  await assert.rejects(
    findTool(createNaverTools(context), 'list_my_posts').run({ accountId: STUB_ACCOUNT.id }),
  );

  assert.deepEqual(spy.closedTabIds, spy.createdTabIds);
});

test('사용자에게 보여주려고 연 탭은 닫지 않는다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({ 'exposure-dashboard': 'https://exposure.internal' });

  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  await findTool(tools, 'open_tab').run({ url: 'https://example.internal' });
  await findTool(tools, 'open_service').run({ service: '노출지기' });

  assert.equal(spy.createTabCalls, 2);
  assert.deepEqual(spy.closedTabIds, []);
});

test('사용자가 열라고 시킨 탭은 화면에도 띄운다', async (t) => {
  // 안 띄우면 화면은 그대로인데 모델은 "열었어요" 라고 보고한다.
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({ 'exposure-dashboard': 'https://exposure.internal' });

  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  await findTool(tools, 'open_tab').run({ url: 'https://example.internal' });
  await findTool(tools, 'open_service').run({ service: '노출지기' });

  assert.deepEqual(
    spy.createTabOptions.map(({ focus }) => focus),
    [true, true],
  );
  // 사이드바 분류와 정리 판정이 이 값을 보므로 openedByAgent 는 그대로 둔다.
  assert.deepEqual(
    spy.createTabOptions.map(({ openedByAgent }) => openedByAgent),
    [true, true],
  );
});

test('작업용 탭은 여전히 화면을 뺏지 않는다', async () => {
  const { context, spy } = createStubContext();

  await findTool(createNaverTools(context), 'list_my_posts')
    .run({ accountId: 'acc-a' })
    .catch(() => undefined);

  assert.equal(spy.createTabOptions.at(0)?.focus, undefined);
});

test('다붓 로그인 대기가 만료돼도 도구가 던지지 않는다', async () => {
  const { context } = createStubContext();
  context.requestDabutLogin = async () => {
    throw new Error(ERRORS.dabutLoginTimeout);
  };

  const output = await findTool(createNaverTools(context), 'dabut_login').run({ reason: '원고 생성' });

  assert.equal(output, RESULT.dabutLoginNoAnswer);
});

test('삭제 도구 두 개가 이름 충돌 없이 등록된다', () => {
  const { context } = createStubContext();
  const tools = createNaverTools(context);
  const names = tools.map(({ name }) => name);

  assert.ok(names.includes('list_my_posts'));
  assert.ok(names.includes('delete_blog_posts'));
  assert.equal(new Set(names).size, names.length);
});

test('두 도구의 파라미터 스키마가 닫혀 있다', () => {
  const tools = createNaverTools(createStubContext().context);

  const list = findTool(tools, 'list_my_posts').parameters as Record<string, unknown>;
  const remove = findTool(tools, 'delete_blog_posts').parameters as Record<string, unknown>;

  assert.equal(list.additionalProperties, false);
  assert.equal(remove.additionalProperties, false);
  assert.deepEqual(list.required, ['accountId']);
  assert.deepEqual(remove.required, ['accountId', 'logNos']);
});

test('목록을 안 읽었으면 브라우저를 열기 전에 거부한다', async () => {
  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'delete_blog_posts').run({
    accountId: 'acc-a',
    logNos: ['223344556677'],
  });

  assert.equal(output, RESULT.deleteUnknownLogNo(['223344556677']));
  assert.equal(spy.askUserCalls.length, 0);
  assert.equal(spy.createTabCalls, 0);
});

test('없는 계정이면 확인을 묻지 않는다', async () => {
  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'delete_blog_posts').run({
    accountId: 'acc-none',
    logNos: ['223344556677'],
  });

  assert.equal(output, RESULT.accountNotFound('acc-none'));
  assert.equal(spy.askUserCalls.length, 0);
  assert.equal(spy.createTabCalls, 0);
});

test('로그인 세션이 없으면 확인을 묻지 않는다', async () => {
  const { context, spy } = createStubContext([]);
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'delete_blog_posts').run({
    accountId: 'acc-a',
    logNos: ['223344556677'],
  });

  assert.equal(output, RESULT.notLoggedIn);
  assert.equal(spy.askUserCalls.length, 0);
  assert.equal(spy.createTabCalls, 0);
});

test('한 번에 열한 개를 넣으면 확인 전에 막는다', async () => {
  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'delete_blog_posts').run({
    accountId: 'acc-a',
    logNos: Array.from({ length: 11 }, (_, index) => `99999999999${index}`),
  });

  assert.equal(output, RESULT.deleteTooMany(MAX_DELETE_PER_CALL));
  assert.equal(spy.askUserCalls.length, 0);
  assert.equal(spy.createTabCalls, 0);
});

test('사용자가 답하지 않아도 ask_user 는 도구 실패로 새지 않는다', async () => {
  const { context } = createStubContext(['NID_AUT', 'NID_SES'], async () => {
    throw new Error(ERRORS.questionTimeout);
  });

  const output = await findTool(createNaverTools(context), 'ask_user').run({ question: '어느 글이요?' });

  assert.equal(output, RESULT.userDidNotAnswer);
});

test('주소를 안 넣어도 코드 기본값으로 연다', async (t) => {
  // 설정 화면에서 서비스 주소 칸을 뺐다. 사용자가 넣을 자리가 없으니 기본값으로 열려야 한다.
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({});

  const { context, spy } = createStubContext();
  const output = await findTool(createNaverTools(context), 'open_service').run({ service: '노출지기' });

  assert.ok(output.startsWith('노출지기 을 탭으로 열었다'), output);
  assert.equal(spy.createTabCalls, 1);
  assert.equal(output.includes('example.com'), false);
});

test('주소를 넣은 서비스는 그 주소로 연다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({ 'exposure-dashboard': 'https://exposure.internal' });

  const { context, spy } = createStubContext();
  const output = await findTool(createNaverTools(context), 'open_service').run({ service: '노출지기' });

  assert.equal(output, RESULT.serviceOpened('노출지기', 'https://exposure.internal'));
  assert.equal(spy.createTabCalls, 1);
});

test('모르는 이름과 미설정을 다른 말로 돌려준다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({});

  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'open_service').run({ service: '없는서비스' });

  assert.equal(output, RESULT.serviceNotFound('없는서비스'));
});

test('list_services 는 기본값이 있는 서비스를 전부 준다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({});

  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'list_services').run({});
  const rows = JSON.parse(output) as { key: string; url: string }[];

  assert.ok(rows.length > 0);
  rows.forEach(({ url }) => assert.match(url, /^https:\/\//));
  assert.equal(output.includes('example.com'), false);
});

test('list_services 는 사용자가 넣은 주소를 우선한다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({ 'image-generator': 'https://image.internal' });

  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'list_services').run({});
  const rows = JSON.parse(output) as { key: string; url: string }[];

  assert.equal(rows.find(({ key }) => key === 'image-generator')?.url, 'https://image.internal');
});

test('시스템 프롬프트는 지어낸 주소를 싣지 않는다', async (t) => {
  t.after(() => applyServiceUrls({}));

  applyServiceUrls({});
  assert.equal(buildAgentSystemPrompt({ today: TODAY }).includes('example.com'), false);

  applyServiceUrls({ 'image-generator': 'https://image.internal' });
  const prompt = buildAgentSystemPrompt({ today: TODAY });

  assert.ok(prompt.includes('https://image.internal'));
  assert.equal(prompt.includes('example.com'), false);
});

// ---------- ask_user_form ----------

test('폼 답은 JSON 객체로 오고 키: 값 줄로 풀린다', () => {
  const fields: QuestionField[] = [
    { key: 'scheduleDate', label: '발행 날짜' },
    { key: 'postsPerDay', label: '하루 건수' },
    { key: 'businessName', label: '업체명', optional: true },
  ];
  const answer = parseFormAnswer('{"scheduleDate":"2026-09-10","postsPerDay":"3","businessName":""}');

  assert.equal(answer.cancelled, false);
  assert.deepEqual(answer.cancelled === false ? answer.values : null, {
    scheduleDate: '2026-09-10',
    postsPerDay: '3',
    businessName: '',
  });

  // 비어 있는 선택 칸은 모델에게 넘기지 않는다. 빈 값을 값으로 오해하면 안 된다.
  assert.deepEqual(
    formatFormAnswer(fields, answer.cancelled === false ? answer.values : {}),
    ['scheduleDate: 2026-09-10', 'postsPerDay: 3'],
  );
});

test('취소 토큰은 값이 아니라 취소로 읽힌다', () => {
  assert.equal(parseFormAnswer(JSON.stringify({ [QUESTION_FORM_CANCEL]: true })).cancelled, true);
});

test('폼 답이 JSON 이 아니면 추측하지 않고 취소로 본다', () => {
  assert.equal(parseFormAnswer('네 그렇게 해주세요').cancelled, true);
  assert.equal(parseFormAnswer('["a","b"]').cancelled, true);
  assert.equal(parseFormAnswer('null').cancelled, true);
});

const normalizedFields = (raw: unknown) => {
  const checked = normalizeQuestionFields(raw);
  assert.equal(checked.ok, true);

  return checked.ok ? checked.fields : [];
};

test('폼 필드를 패널이 그릴 수 있는 모양으로만 통과시킨다', () => {
  const fields = normalizedFields([
    { key: 'date', label: '날짜', type: 'date' },
    { key: 'style', label: '스타일', choices: ['default', '', 'pet'], value: 'pet' },
    { key: 'memo', label: '메모', optional: true },
  ]);

  assert.deepEqual(fields.map(({ key }) => key), ['date', 'style', 'memo']);
  assert.equal(fields[0]?.type, 'date');
  // 문자열 보기는 label 과 value 가 같은 보기로 넓힌다.
  assert.deepEqual(fields[1]?.choices, [
    { label: 'default', value: 'default' },
    { label: 'pet', value: 'pet' },
  ]);
  assert.equal(fields[1]?.value, 'pet');
  assert.equal(fields[2]?.optional, true);
  assert.equal(fields[0]?.optional, false);
});

test('보기의 라벨과 값을 따로 받는다', () => {
  // 프로젝트는 이름을 보여주고 id 를 돌려줘야 한다. 라벨만 돌려주면 모델이 id 를 짐작하게 된다.
  const fields = normalizedFields([
    {
      key: 'projectId',
      label: '원고 스타일',
      choices: [
        { label: '펫 프로젝트', value: '68f1a2b3' },
        { label: '맛집 프로젝트', value: '68f1a2c4' },
      ],
      value: '68f1a2c4',
    },
  ]);

  assert.deepEqual(fields[0]?.choices, [
    { label: '펫 프로젝트', value: '68f1a2b3' },
    { label: '맛집 프로젝트', value: '68f1a2c4' },
  ]);
  assert.equal(fields[0]?.value, '68f1a2c4');
});

test('보기에 없는 값을 미리 채우면 폼을 띄우지 않는다', () => {
  // 그대로 그리면 빈 칸이 되는데 모델은 자기 값이 살아있다고 믿는다.
  const checked = normalizeQuestionFields([
    { key: 'projectId', label: '원고 스타일', choices: [{ label: '펫', value: 'p1' }], value: 'p9' },
  ]);

  assert.equal(checked.ok, false);
  assert.equal(checked.ok === false ? checked.reason : '', 'prefill');
  assert.equal(checked.ok === false ? checked.key : '', 'projectId');
});

test('key 나 label 이 없거나 겹치면 폼을 띄우지 않는다', () => {
  const rejected = (raw: unknown) => {
    const checked = normalizeQuestionFields(raw);
    assert.equal(checked.ok, false);

    return checked.ok === false ? checked.reason : '';
  };

  assert.equal(rejected([]), 'shape');
  assert.equal(rejected('날짜'), 'shape');
  assert.equal(rejected([{ label: '날짜' }]), 'shape');
  assert.equal(rejected([{ key: 'a' }]), 'shape');
  assert.equal(rejected([{ key: 'a', label: '가' }, { key: 'a', label: '나' }]), 'shape');
});

test('비밀번호 칸은 폼으로 받지 않는다', () => {
  const checked = normalizeQuestionFields([{ key: 'pw', label: '비밀번호', type: 'password' }]);

  assert.equal(checked.ok, false);
});

test('ask_user_form 은 폼을 띄우고 답을 키: 값으로 돌려준다', async () => {
  const { context, spy } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.deleteYes,
    async () => JSON.stringify({ scheduleDate: '2026-09-10', accountId: 'a1' }),
  );

  const output = await findTool(createNaverTools(context), 'ask_user_form').run({
    question: '예약에 필요한 값을 알려주세요',
    fields: [
      { key: 'scheduleDate', label: '발행 날짜', type: 'date' },
      { key: 'accountId', label: '계정' },
    ],
  });

  assert.equal(output, RESULT.userAnsweredForm(['scheduleDate: 2026-09-10', 'accountId: a1']));
  assert.equal(spy.formCalls.length, 1);
  assert.equal(spy.formCalls[0]?.fields.length, 2);
  assert.equal(spy.askUserCalls.length, 0);
});

test('폼을 취소하면 추측하지 말고 멈추라고 돌려준다', async () => {
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.deleteYes,
    async () => JSON.stringify({ [QUESTION_FORM_CANCEL]: true }),
  );

  const output = await findTool(createNaverTools(context), 'ask_user_form').run({
    question: '값을 알려주세요',
    fields: [{ key: 'a', label: '가' }],
  });

  assert.equal(output, RESULT.formCancelled);
});

test('폼이 만료돼도 도구 실패로 새지 않는다', async () => {
  const { context } = createStubContext(['NID_AUT', 'NID_SES'], async () => CONFIRM.deleteYes, async () => {
    throw new Error(ERRORS.questionTimeout);
  });

  const output = await findTool(createNaverTools(context), 'ask_user_form').run({
    question: '값을 알려주세요',
    fields: [{ key: 'a', label: '가' }],
  });

  assert.equal(output, RESULT.userDidNotAnswer);
});

test('필드가 깨졌으면 폼을 띄우지 않고 모델에게 되돌린다', async () => {
  const { context, spy } = createStubContext();
  const tool = findTool(createNaverTools(context), 'ask_user_form');

  assert.equal(await tool.run({ question: '?', fields: [] }), RESULT.formNoFields);
  assert.equal(await tool.run({ question: '?', fields: [{ label: '가' }] }), RESULT.formBadFields);
  assert.equal(
    await tool.run({
      question: '?',
      fields: [{ key: 'p', label: '프로젝트', choices: [{ label: '펫', value: 'p1' }], value: 'p9' }],
    }),
    RESULT.formPrefillNotInChoices('p'),
  );
  assert.equal(spy.formCalls.length, 0);
});

test('폼을 빈 채로 확인하면 답변이 아니라 멈추라고 돌려준다', async () => {
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.deleteYes,
    async () => JSON.stringify({ memo: '', note: '   ' }),
  );

  const output = await findTool(createNaverTools(context), 'ask_user_form').run({
    question: '값을 알려주세요',
    fields: [
      { key: 'memo', label: '메모', optional: true },
      { key: 'note', label: '비고', optional: true },
    ],
  });

  // 빈 줄을 "사용자 입력:" 으로 넘기면 모델이 답을 받았다고 보고 추측으로 잇는다.
  assert.equal(output, RESULT.formEmptyAnswer);
});

test('보기를 고르면 라벨이 아니라 value 가 모델에게 간다', async () => {
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.deleteYes,
    async () => JSON.stringify({ projectId: '68f1a2c4' }),
  );

  const output = await findTool(createNaverTools(context), 'ask_user_form').run({
    question: '원고 스타일을 골라주세요',
    fields: [
      {
        key: 'projectId',
        label: '원고 스타일',
        choices: [
          { label: '펫 프로젝트', value: '68f1a2b3' },
          { label: '맛집 프로젝트', value: '68f1a2c4' },
        ],
      },
    ],
  });

  assert.equal(output, RESULT.userAnsweredForm(['projectId: 68f1a2c4']));
});

// ---------- auto_schedule_posts ----------

test('예약 계정은 dabutAccountId 로 실어 보낸다', () => {
  const built = buildSchedule(
    {
      scheduleDate: '2026-09-10',
      accountId: '68b0f0aa11223344556677ff',
      keywords: ['강아지유치원'],
    },
    NO_PROJECTS,
  );

  assert.equal(built.ok, true);
  if (!built.ok) return;

  const [queue] = built.input.queues;

  // account.id 는 스케줄러에서 네이버 로그인 id 다. Mongo _id 를 그리로 보내면 계정 해석이 죽는다.
  assert.deepEqual(queue?.account, { dabutAccountId: '68b0f0aa11223344556677ff' });
  assert.equal((queue?.account as Record<string, unknown>).id, undefined);
});

test('projectId 와 imageSource 가 예약 페이로드까지 간다', () => {
  const built = buildSchedule(
    {
      scheduleDate: '2026-09-10',
      accountId: 'acc',
      keywords: ['가', '나'],
      projectId: 'proj-1',
      imageSource: 'google',
      manuscriptType: 'pet',
      keywordCategory: '반려동물',
      blogName: '내 블로그',
      postsPerDay: 2,
      startHour: 9,
      intervalMinutes: 120,
    },
    new Set(['proj-1']),
  );

  assert.equal(built.ok, true);
  if (!built.ok) return;

  assert.equal(built.input.projectId, 'proj-1');
  assert.equal(built.input.imageSource, 'google');
  assert.equal(built.input.manuscriptType, 'pet');
  assert.equal(built.input.keywordCategory, '반려동물');
  assert.equal(built.input.queues[0]?.blog_name, '내 블로그');
  assert.deepEqual(built.input.queues[0]?.keywords, ['가', '나']);
});

test('projectId 는 항목별 item_options 로도 실린다', () => {
  // 최상위 project_id 는 ScheduleJob 문서에 저장되지 않아 재실행하면 사라진다.
  const built = buildSchedule(
    { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가', '나', '다'], projectId: 'proj-1' },
    new Set(['proj-1']),
  );

  assert.equal(built.ok, true);
  if (!built.ok) return;

  const [queue] = built.input.queues;

  // 길이가 keywords 와 다르면 스케줄러가 HTTP 200 + success:false 로 조용히 실패한다.
  assert.deepEqual(queue?.item_options, [
    { projectId: 'proj-1' },
    { projectId: 'proj-1' },
    { projectId: 'proj-1' },
  ]);
  assert.equal(queue?.item_options?.length, queue?.keywords.length);
});

test('projectId 가 없으면 item_options 를 만들지 않는다', () => {
  const built = buildSchedule(
    { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] },
    NO_PROJECTS,
  );

  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.input.queues[0]?.item_options, undefined);
});

test('목록에 없던 projectId 는 예약을 걸기 전에 거부한다', () => {
  const base = { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] };

  // list_dabut_projects 를 부르지 않고 id 를 지어낸 경우.
  const guessed = buildSchedule({ ...base, projectId: 'proj-9' }, NO_PROJECTS);
  assert.equal(guessed.ok === false ? guessed.result : '', RESULT.projectNotListed);

  // 목록은 받았지만 다른 id 를 실은 경우. 틀린 프로젝트는 몇 시간 뒤 생성 시점에나 드러난다.
  const wrong = buildSchedule({ ...base, projectId: 'proj-9' }, new Set(['proj-1']));
  assert.equal(wrong.ok === false ? wrong.result : '', RESULT.projectNotFound('proj-9'));
});

test('날짜 형식이 어긋나면 스케줄러 500 을 맞기 전에 막는다', () => {
  const base = { accountId: 'acc', keywords: ['가'] };

  // 스케줄러의 schedule_date 에는 regex 가 없다. 한 자리 월/일은 Invalid Date 로 500 이 된다.
  const loose = buildSchedule({ ...base, scheduleDate: '2026-9-2' }, NO_PROJECTS);
  assert.equal(loose.ok === false ? loose.result : '', RESULT.scheduleDateFormat('2026-9-2'));

  const impossible = buildSchedule({ ...base, scheduleDate: '2026-02-31' }, NO_PROJECTS);
  assert.equal(impossible.ok === false ? impossible.result : '', RESULT.scheduleDateFormat('2026-02-31'));

  assert.equal(buildSchedule({ ...base, scheduleDate: '2026-09-10' }, NO_PROJECTS).ok, true);
});

test('지난 날짜는 예약을 걸기 전에 거부한다', () => {
  const base = { accountId: 'acc', keywords: ['가'], startHour: 9 };

  // 스케줄러는 지난 날짜를 거르지 않는다. 워커가 밀린 job 으로 보고 바로 집어간다.
  const yesterday = buildAutoScheduleInput(
    { ...base, scheduleDate: '2026-08-31' },
    { knownProjectIds: NO_PROJECTS, today: TODAY, nowMinutes: 0 },
  );

  assert.equal(yesterday.ok, false);
  assert.equal(
    yesterday.ok === false ? yesterday.result : '',
    RESULT.scheduleDatePast('2026-08-31', TODAY),
  );
});

test('오늘이라도 이미 지난 시각이면 거부한다', () => {
  // 날짜만 보면 KST 22시에 "오늘 06시" 를 거는 것을 못 막는다. 그것도 밀린 job 이 된다.
  const built = buildSchedule(
    { scheduleDate: TODAY, accountId: 'acc', keywords: ['가'], startHour: 6 },
    NO_PROJECTS,
    TODAY,
    22 * 60,
  );

  assert.equal(built.ok, false);
  assert.equal(
    built.ok === false ? built.result : '',
    RESULT.scheduleStartHourPast(6, TODAY, 22),
  );
});

test('오늘 정각에 그 시각으로 거는 것은 통과한다', () => {
  const built = buildSchedule(
    { scheduleDate: TODAY, accountId: 'acc', keywords: ['가'], startHour: 15 },
    NO_PROJECTS,
    TODAY,
    15 * 60,
  );

  assert.equal(built.ok, true);
});

test('내일이면 이른 시각이어도 통과한다', () => {
  const built = buildSchedule(
    { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'], startHour: 1 },
    NO_PROJECTS,
    TODAY,
    23 * 60,
  );

  assert.equal(built.ok, true);
});

test('멈춘 뒤 남은 삭제 대상은 손대지 않았다고 표에 남는다', () => {
  // 표에서 빼면 모델이 "전부 지웠다" 로 읽고 사용자에게 그렇게 보고한다.
  const rows = stoppedDeleteRows([
    { logNo: '111111111111', title: '가' },
    { logNo: '222222222222', title: '나' },
  ]);

  assert.deepEqual(
    rows.map(({ status }) => status),
    [RESULT.deleteStatusStopped, RESULT.deleteStatusStopped],
  );
  assert.deepEqual(
    rows.map(({ logNo }) => logNo),
    ['111111111111', '222222222222'],
  );
  assert.equal(rows.every(({ status }) => status !== RESULT.deleteStatus.deleted), true);
});

test('멈추지 않았으면 건너뛴 행이 생기지 않는다', () => {
  assert.deepEqual(stoppedDeleteRows([]), []);
});

test('정지된 실행에서는 다붓 로그인 무응답이라고 적지 않는다', async () => {
  const controller = new AbortController();
  const { context } = createStubContext();
  context.signal = controller.signal;
  context.requestDabutLogin = async () => {
    throw new Error(ERRORS.runCancelled);
  };
  controller.abort();

  const output = await findTool(createNaverTools(context), 'dabut_login').run({ reason: '원고 생성' });

  assert.equal(output, RESULT.runStopped);
});

test('오늘 날짜는 통과한다', () => {
  const built = buildAutoScheduleInput(
    { scheduleDate: TODAY, accountId: 'acc', keywords: ['가'], startHour: 9 },
    { knownProjectIds: NO_PROJECTS, today: TODAY, nowMinutes: 0 },
  );

  assert.equal(built.ok, true);
  assert.equal(built.ok === true ? built.input.scheduleDate : '', TODAY);
});

test('startHour 가 빠지면 서버 기본값으로 새기 전에 막는다', () => {
  // 빠진 값은 hub 가 body 에서 통째로 뺀다. 사용자가 정한 적 없는 시각에 글이 올라간다.
  const built = buildAutoScheduleInput(
    { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] },
    { knownProjectIds: NO_PROJECTS, today: TODAY, nowMinutes: 0 },
  );

  assert.equal(built.ok, false);
  assert.equal(built.ok === false ? built.result : '', RESULT.scheduleStartHourRequired);
});

test('스케줄러가 모르는 스타일과 이미지 출처는 부르기 전에 막는다', () => {
  const base = { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] };

  const badType = buildSchedule({ ...base, manuscriptType: '맛집v3' }, NO_PROJECTS);
  assert.equal(badType.ok, false);
  assert.equal(badType.ok === false ? badType.result : '', RESULT.unknownManuscriptType('맛집v3'));

  const badSource = buildSchedule({ ...base, imageSource: 'unsplash' }, NO_PROJECTS);
  assert.equal(badSource.ok, false);
  assert.equal(badSource.ok === false ? badSource.result : '', RESULT.unknownImageSource('unsplash'));

  MANUSCRIPT_TYPES.forEach((manuscriptType) =>
    assert.equal(buildSchedule({ ...base, manuscriptType }, NO_PROJECTS).ok, true),
  );
  IMAGE_SOURCES.forEach((imageSource) =>
    assert.equal(buildSchedule({ ...base, imageSource }, NO_PROJECTS).ok, true),
  );
});

test('스케줄러 범위 밖의 숫자는 400 을 맞기 전에 막는다', () => {
  const base = { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] };
  const { intervalMinutesMin, intervalMinutesMax, postsPerDayMax, startHourMax } = SCHEDULE_LIMITS;

  assert.equal(buildSchedule({ ...base, intervalMinutes: 5 }, NO_PROJECTS).ok, false);
  assert.equal(buildSchedule({ ...base, postsPerDay: postsPerDayMax + 1 }, NO_PROJECTS).ok, false);
  assert.equal(buildSchedule({ ...base, startHour: startHourMax + 1 }, NO_PROJECTS).ok, false);
  assert.equal(buildSchedule({ ...base, intervalMinutes: intervalMinutesMin }, NO_PROJECTS).ok, true);
  assert.equal(buildSchedule({ ...base, intervalMinutes: intervalMinutesMax }, NO_PROJECTS).ok, true);
});

test('빈 키워드와 빈 계정은 네트워크를 타기 전에 걸린다', () => {
  const empty = buildSchedule({ scheduleDate: '2026-09-10', accountId: 'acc', keywords: [] }, NO_PROJECTS);
  assert.equal(empty.ok === false ? empty.result : '', RESULT.emptyKeywords);

  const noAccount = buildSchedule({ scheduleDate: '2026-09-10', accountId: ' ', keywords: ['가'] }, NO_PROJECTS);
  assert.equal(noAccount.ok === false ? noAccount.result : '', RESULT.schedulerAccountRequired);

  const noDate = buildSchedule({ scheduleDate: '', accountId: 'acc', keywords: ['가'] }, NO_PROJECTS);
  assert.equal(noDate.ok === false ? noDate.result : '', RESULT.scheduleDateRequired);
});

test('auto_schedule_posts 스키마가 스케줄러 enum 을 그대로 노출한다', () => {
  const { context } = createStubContext();
  const schema = findTool(createNaverTools(context), 'auto_schedule_posts').parameters as {
    properties: Record<string, { enum?: string[] }>;
    additionalProperties: boolean;
  };

  assert.deepEqual(schema.properties.manuscriptType?.enum, [...MANUSCRIPT_TYPES]);
  assert.deepEqual(schema.properties.imageSource?.enum, [...IMAGE_SOURCES]);
  assert.ok(schema.properties.projectId);
  assert.equal(schema.additionalProperties, false);
});

test('시스템 프롬프트에 오늘 날짜와 타임존이 들어간다', () => {
  const prompt = buildAgentSystemPrompt({ today: '2026-09-03' });

  assert.ok(prompt.includes('2026-09-03'));
  assert.ok(prompt.includes('KST'));
});

test('auto_schedule_posts 는 startHour 를 필수로 받는다', () => {
  const { context } = createStubContext();
  const schema = findTool(createNaverTools(context), 'auto_schedule_posts').parameters as {
    required: string[];
  };

  assert.ok(schema.required.includes('startHour'));
});

test('시스템 프롬프트가 폼과 프로젝트 규칙을 싣는다', () => {
  const prompt = buildAgentSystemPrompt({ today: TODAY });

  assert.ok(prompt.includes('ask_user_form'));
  assert.ok(prompt.includes('list_dabut_projects'));
  assert.ok(prompt.includes('projectId'));
});

test('스케줄러 호출이 실패하면 등록 완료로 보고하지 않는다', async () => {
  // baseUrl 이 비어 있어 axios 가 던진다. 예전에는 이 예외가 도구 밖으로 새거나
  // 성공 문장으로 덮여서, 아무것도 안 걸린 채 "예약 등록 완료" 로 끝났다.
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.deleteYes,
    async () => '{}',
    'token-1',
  );

  const output = await findTool(createNaverTools(context), 'auto_schedule_posts').run({
    scheduleDate: kstTomorrow(),
    accountId: 'acc',
    keywords: ['가'],
    startHour: 9,
  });

  assert.ok(output.startsWith('예약이 걸리지 않았다'), output);
  assert.equal(output.includes('예약 등록 완료'), false);
});

test('list_dabut_projects 를 부르지 않으면 projectId 를 실은 예약이 막힌다', async () => {
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.deleteYes,
    async () => '{}',
    'token-1',
  );

  const output = await findTool(createNaverTools(context), 'auto_schedule_posts').run({
    scheduleDate: kstTomorrow(),
    accountId: 'acc',
    keywords: ['가'],
    startHour: 9,
    projectId: '68f1a2b3',
  });

  assert.equal(output, RESULT.projectNotListed);
});

test('다붓 로그인 없이는 예약을 걸지 않는다', async () => {
  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'auto_schedule_posts').run({
    scheduleDate: kstTomorrow(),
    accountId: 'acc',
    keywords: ['가'],
    startHour: 9,
  });

  // accountId 는 다붓이 준 id 라서 토큰이 없으면 스케줄러가 크리덴셜을 풀지 못한다.
  assert.equal(output, RESULT.dabutNotLoggedIn);
});

// ---------- 예약 읽기와 취소 ----------

const scheduleFixture = (overrides: Partial<ScheduleSummary> = {}): ScheduleSummary => ({
  id: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8',
  accountId: 'sampleblog01',
  scheduleDate: '2026-09-03',
  status: 'pending',
  totalJobs: 1,
  completedJobs: 0,
  failedJobs: 0,
  createdAt: '2026-09-02T10:00:00.000Z',
  ...overrides,
});

/** 이 예약이 내 것이라고 말해 주는 유일한 근거. 스케줄러의 조회 라우트에는 소유자 스코프가 없다. */
const ownedFixture = (...accounts: Partial<OwnedAccount>[]): Map<string, OwnedAccount> =>
  indexOwnedAccounts(
    (accounts.length ? accounts : [{}]).map((account) => ({
      id: '68f1a2b3c4d5e6f7a8b9c0d1',
      name: '샘플블로그',
      blogId: 'sampleblog',
      loginId: 'sampleblog01',
      ...account,
    })),
  );

const jobFixture = (overrides: Partial<ScheduleJobDetail> = {}): ScheduleJobDetail => ({
  id: 'job_809afa57',
  keyword: '제물포구맛집',
  scheduledAt: '2026-09-03 23:00',
  status: 'pending',
  projectId: '6a76084a9f8378fbf93e52f3',
  manuscriptType: '',
  businessName: '',
  postUrl: '',
  error: '',
  ...overrides,
});

const knownScheduleMap = (...rows: KnownSchedule[]) => new Map(rows.map((row) => [row.id, row]));

const emptyCancelState = () => ({
  attempted: new Set<string>(),
  refused: new Set<string>(),
});

test('예약 목록 결과를 실행 기록으로 옮긴다', () => {
  const [known] = toKnownSchedules([scheduleFixture()]);

  assert.deepEqual(known, {
    id: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8',
    accountId: 'sampleblog01',
    scheduleDate: '2026-09-03',
    status: 'pending',
    totalJobs: 1,
  });
});

test('예약 취소 승인 토큰은 정확히 맞아야 한다', () => {
  assert.equal(isCancelApproved(CONFIRM.cancelScheduleYes), true);
  assert.equal(isCancelApproved(`  ${CONFIRM.cancelScheduleYes}  `), true);

  ['네', '예', 'ㅇㅇ', '취소', CONFIRM.cancelScheduleNo, '', '   '].forEach((answer) => {
    assert.equal(isCancelApproved(answer), false, answer);
  });
});

test('글 삭제 승인과 예약 취소 승인은 서로 다른 말이다', () => {
  // 값이 같으면 한쪽 승인이 다른 쪽 승인으로 샌다.
  assert.notEqual(CONFIRM.cancelScheduleYes, CONFIRM.deleteYes);
  assert.notEqual(CONFIRM.cancelScheduleNo, CONFIRM.deleteNo);
  assert.equal(isCancelApproved(CONFIRM.deleteYes), false);
  assert.equal(isDeleteApproved(CONFIRM.cancelScheduleYes), false);
});

test('이번 실행에서 읽은 예약이면 취소 계획이 선다', () => {
  const plan = planScheduleCancel({
    raw: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8',
    known: knownScheduleMap(...toKnownSchedules([scheduleFixture()])),
    ...emptyCancelState(),
  });

  assert.deepEqual(plan, { ok: true, scheduleId: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8' });
});

test('예약 취소 판정 순서를 고정한다', () => {
  const known = knownScheduleMap(...toKnownSchedules([scheduleFixture()]));
  const id = 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8';

  const empty = planScheduleCancel({ raw: '  ', known, ...emptyCancelState() });
  assert.equal(empty.ok === false ? empty.result : '', RESULT.scheduleIdRequired);

  // 목록에도 상세에도 없던 id. 모델이 기억으로 만들어 낸 경우다.
  const guessed = planScheduleCancel({ raw: 'sch_made-up', known, ...emptyCancelState() });
  assert.equal(guessed.ok === false ? guessed.result : '', RESULT.scheduleNotRead('sch_made-up'));

  const refusedState = emptyCancelState();
  refusedState.refused.add(id);
  const refused = planScheduleCancel({ raw: id, known, ...refusedState });
  assert.equal(refused.ok === false ? refused.result : '', RESULT.scheduleCancelRefusedEarlier(id));

  // 시도가 거절보다 먼저 잡힌다. 이미 서버로 나간 사실이 더 구체적인 이유다.
  const bothState = emptyCancelState();
  bothState.refused.add(id);
  bothState.attempted.add(id);
  const both = planScheduleCancel({ raw: id, known, ...bothState });
  assert.equal(both.ok === false ? both.result : '', RESULT.scheduleCancelRetryBlocked(id));

  const attemptedState = emptyCancelState();
  attemptedState.attempted.add(id);
  const retried = planScheduleCancel({ raw: id, known, ...attemptedState });
  assert.equal(retried.ok === false ? retried.result : '', RESULT.scheduleCancelRetryBlocked(id));
});

test('취소한 예약을 다시 부르면 사실이 아닌 이유가 아니라 재시도 차단이 나온다', () => {
  // 취소 성공 뒤 known 에서 지웠다면 "읽은 적 없다" 가 나가고, 모델은 목록을 다시 읽어
  // 같은 id 를 known 에 되살린다. attempted 를 먼저 보므로 known 이 어느 쪽이든 이유가 참이다.
  const id = 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8';
  const state = emptyCancelState();
  state.attempted.add(id);

  const afterDelete = planScheduleCancel({ raw: id, known: new Map(), ...state });
  assert.equal(afterDelete.ok === false ? afterDelete.result : '', RESULT.scheduleCancelRetryBlocked(id));
});

test('한 실행에서 취소할 수 있는 건수를 제한한다', () => {
  const known = knownScheduleMap(...toKnownSchedules([scheduleFixture()]));
  const state = emptyCancelState();

  for (let index = 0; index < MAX_CANCEL_PER_RUN; index += 1) {
    state.attempted.add(`sch_done-${index}`);
  }

  const plan = planScheduleCancel({
    raw: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8',
    known,
    ...state,
  });

  assert.equal(plan.ok === false ? plan.result : '', RESULT.scheduleCancelRunLimit(MAX_CANCEL_PER_RUN));
});

test('취소 확인 문안에는 키워드와 발행 시각이 전부 들어간다', async () => {
  const asked: { question: string; choices?: string[] }[] = [];

  const result = await requestScheduleCancelApproval({
    askUser: async (question, choices) => {
      asked.push({ question, choices });
      return CONFIRM.cancelScheduleYes;
    },
    schedule: scheduleFixture(),
    jobs: [jobFixture(), jobFixture({ id: 'job_2', keyword: '인천맛집', scheduledAt: '2026-09-04 09:00' })],
    owned: ownedFixture(),
  });

  assert.equal(result.approved, true);
  assert.equal(asked.length, 1);
  assert.ok(asked[0]?.question.includes('제물포구맛집'));
  assert.ok(asked[0]?.question.includes('2026-09-03 23:00'));
  assert.ok(asked[0]?.question.includes('인천맛집'));
  assert.ok(asked[0]?.question.includes('sch_4e2f5c84-22e3-4a33-af12-549a427341f8'));
  assert.deepEqual(asked[0]?.choices, [CONFIRM.cancelScheduleYes, CONFIRM.cancelScheduleNo]);
  // 계정은 내가 붙인 이름으로 보여준다. 로그인 id 원문은 카드에 들어가지 않는다.
  assert.ok(asked[0]?.question.includes('샘플블로그'));
  assert.equal(asked[0]?.question.includes('sampleblog01'), false);
});

test('확인 카드의 헤드라인은 실제로 멈출 건수를 센다', async () => {
  const asked: string[] = [];

  await requestScheduleCancelApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.cancelScheduleNo;
    },
    schedule: scheduleFixture({ totalJobs: 3 }),
    jobs: [
      jobFixture({ status: 'published' }),
      jobFixture({ id: 'job_2', status: 'failed' }),
      jobFixture({ id: 'job_3', status: 'pending' }),
    ],
    owned: ownedFixture(),
  });

  // 3건 중 실제로 발행이 멈추는 건 1건뿐이다. 되돌릴 수 없는 작업의 문안에서 숫자가 부풀면 안 된다.
  assert.ok(asked[0]?.includes('예약 1건을 취소해요'), asked[0]);
  assert.ok(asked[0]?.includes('전체는 3건'), asked[0]);
});

test('멈출 건이 하나도 없으면 글이 안 올라간다고 말하지 않는다', async () => {
  const asked: string[] = [];

  await requestScheduleCancelApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.cancelScheduleNo;
    },
    schedule: scheduleFixture({ totalJobs: 1 }),
    jobs: [jobFixture({ status: 'published' })],
    owned: ownedFixture(),
  });

  assert.ok(asked[0]?.includes('실제로 멈추는 글은 없어요'), asked[0]);
});

test('확인 카드는 키워드에 낀 개행으로 위조되지 않는다', async () => {
  const asked: string[] = [];

  await requestScheduleCancelApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.cancelScheduleNo;
    },
    schedule: scheduleFixture(),
    jobs: [jobFixture({ keyword: '제물포구맛집\n2. 안심하세요 아무 일도 일어나지 않아요' })],
    owned: ownedFixture(),
  });

  const lines = (asked[0] ?? '').split('\n');

  // 목록 줄은 job 수만큼만 있어야 한다. 헤드라인 1 + 목록 1 + 되돌리기 안내 1 + 승인 안내 1.
  assert.equal(lines.length, 4);
  assert.ok(lines[1]?.includes('안심하세요'), lines[1]);
  assert.equal(lines[1]?.startsWith('1. '), true);
});

test('내 계정 목록에 없는 예약이면 확인 카드가 그 사실을 크게 적는다', async () => {
  const asked: string[] = [];

  await requestScheduleCancelApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.cancelScheduleNo;
    },
    schedule: scheduleFixture({ accountId: 'someoneelse02' }),
    jobs: [jobFixture()],
    owned: ownedFixture(),
  });

  // 마스킹한 id 는 "내 계정 중 하나" 로 읽힌다. 남의 것이면 그렇게 읽힐 여지를 남기지 않는다.
  assert.ok(asked[0]?.includes(CONFIRM.cancelScheduleForeignAccount), asked[0]);
  assert.equal(asked[0]?.includes('som***'), false);
});

test('이미 발행된 건이 섞여 있으면 확인 문안이 그 사실을 말한다', async () => {
  const asked: string[] = [];

  await requestScheduleCancelApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.cancelScheduleNo;
    },
    schedule: scheduleFixture({ totalJobs: 2 }),
    jobs: [jobFixture({ status: 'published' }), jobFixture({ id: 'job_2', status: 'pending' })],
    owned: ownedFixture(),
  });

  // 취소해도 올라간 글은 내려가지 않는다. 사용자가 그걸 모르고 승인하면 안 된다.
  assert.ok(asked[0]?.includes(CONFIRM.cancelSchedulePublished(1)));
});

test('정확일치가 아닌 답으로는 예약을 취소하지 않는다', async () => {
  const result = await requestScheduleCancelApproval({
    askUser: async () => '네 취소해주세요',
    schedule: scheduleFixture(),
    jobs: [jobFixture()],
    owned: ownedFixture(),
  });

  assert.deepEqual(result, { approved: false, answer: '네 취소해주세요', answered: true });
});

test('취소 확인을 기다리다 끊긴 것은 거절과 구분한다', async () => {
  const result = await requestScheduleCancelApproval({
    askUser: async () => {
      throw new Error(ERRORS.questionTimeout);
    },
    schedule: scheduleFixture(),
    jobs: [jobFixture()],
    owned: ownedFixture(),
  });

  // 승인이 아닌 건 같지만, 사용자가 하지 않은 답변을 지어내 보고하면 안 된다.
  assert.deepEqual(result, { approved: false, answer: '', answered: false });
});

test('예약 상세 표에 저장된 원고 프로젝트가 열로 나온다', () => {
  const [row] = formatScheduleJobRows(
    [jobFixture()],
    new Map([['6a76084a9f8378fbf93e52f3', '맛집3']]),
  );

  // 라벨을 알면 id 대신 사람이 읽는 이름을 보여준다.
  assert.equal(row?.project, '맛집3');
  assert.equal(row?.keyword, '제물포구맛집');
  assert.equal(row?.scheduledAt, '2026-09-03 23:00');
  assert.equal(row?.status, RESULT.scheduleJobStatus.pending);
});

test('라벨을 모르면 projectId 를 그대로 보여준다', () => {
  const [row] = formatScheduleJobRows([jobFixture()], new Map());

  assert.equal(row?.project, '6a76084a9f8378fbf93e52f3');
});

test('라벨을 알아도 원문 projectId 를 함께 낸다', () => {
  // 사용자가 묻는 건 "내가 보낸 그 id 가 저장됐나" 다. 이름만 내면 대조할 원문이 사라지고,
  // 이름이 같은 프로젝트가 둘이면 불일치가 보이지 않는다.
  const [row] = formatScheduleJobRows(
    [jobFixture()],
    new Map([['6a76084a9f8378fbf93e52f3', '맛집3']]),
  );

  assert.equal(row?.project, '맛집3');
  assert.equal(row?.projectId, '6a76084a9f8378fbf93e52f3');
});

test('예약에 프로젝트가 저장되지 않았으면 표가 그 사실을 말한다', () => {
  // 이 도구가 있는 이유. 빈 칸으로 두면 "확인했다" 와 "저장 안 됐다" 가 구분되지 않는다.
  const [row] = formatScheduleJobRows([jobFixture({ projectId: '' })], new Map());

  assert.equal(row?.project, RESULT.scheduleProjectMissing);
  assert.equal(row?.projectId, RESULT.scheduleProjectMissing);
});

test('manuscriptType 도 저장 안 됨을 표에 남긴다', () => {
  // 최상위 manuscript_type 은 ScheduleJob 문서에 안 남는다. 열을 지우면 모델이 확인했다고 착각한다.
  const [row] = formatScheduleJobRows([jobFixture({ manuscriptType: '' })], new Map());

  assert.equal(row?.manuscriptType, RESULT.scheduleManuscriptTypeMissing);

  const view = formatToolOutput(JSON.stringify(formatScheduleJobRows([jobFixture()], new Map())));
  assert.match(view.html ?? '', /<th>manuscriptType<\/th>/);
  assert.match(view.html ?? '', /<th>projectId<\/th>/);
});

test('발행된 글 주소는 표에서 지워지지 않는 열 이름으로 낸다', () => {
  const rows = formatScheduleJobRows(
    [jobFixture({ status: 'published', postUrl: 'https://blog.naver.com/sampleblog/223' })],
    new Map(),
  );
  const view = formatToolOutput(JSON.stringify(rows));

  // 키가 url 이면 tool-output 의 NOISY_KEYS 가 표에서 통째로 지운다.
  assert.match(view.html ?? '', /<th>postUrl<\/th>/);
  assert.match(view.html ?? '', /<th>project<\/th>/);
  assert.match(view.html ?? '', /<th>keyword<\/th>/);
});

test('값이 빈 열은 표에 만들지 않는다', () => {
  const view = formatToolOutput(JSON.stringify(formatScheduleJobRows([jobFixture()], new Map())));

  assert.equal((view.html ?? '').includes('<th>postUrl</th>'), false);
  assert.equal((view.html ?? '').includes('<th>error</th>'), false);
});

test('예약 도구 세 개가 이름 충돌 없이 등록된다', () => {
  const names = createNaverTools(createStubContext().context).map(({ name }) => name);

  assert.ok(names.includes('list_schedules'));
  assert.ok(names.includes('get_schedule'));
  assert.ok(names.includes('cancel_schedule'));
  assert.equal(new Set(names).size, names.length);
});

test('예약 도구의 파라미터 스키마가 닫혀 있다', () => {
  const tools = createNaverTools(createStubContext().context);

  const list = findTool(tools, 'list_schedules').parameters as Record<string, unknown>;
  const detail = findTool(tools, 'get_schedule').parameters as Record<string, unknown>;
  const cancel = findTool(tools, 'cancel_schedule').parameters as Record<string, unknown>;

  assert.equal(list.additionalProperties, false);
  assert.equal(detail.additionalProperties, false);
  assert.equal(cancel.additionalProperties, false);
  assert.deepEqual(detail.required, ['scheduleId']);
  assert.deepEqual(cancel.required, ['scheduleId']);

  // 예약 묶음의 status 만 필터로 받는다. job 의 published 같은 값을 넣으면 빈 결과가 나온다.
  const { properties } = list as { properties: Record<string, { enum?: string[] }> };
  assert.deepEqual(properties.status?.enum, [...SCHEDULE_STATUSES]);
});

test('다붓 로그인 없이는 예약을 읽지도 취소하지도 않는다', async () => {
  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  assert.equal(await findTool(tools, 'list_schedules').run({}), RESULT.dabutNotLoggedIn);
  assert.equal(await findTool(tools, 'get_schedule').run({ scheduleId: 'sch_1' }), RESULT.dabutNotLoggedIn);
  assert.equal(await findTool(tools, 'cancel_schedule').run({ scheduleId: 'sch_1' }), RESULT.dabutNotLoggedIn);
  assert.equal(spy.askUserCalls.length, 0);
});

test('읽은 적 없는 예약은 확인조차 묻지 않고 거부한다', async () => {
  const { context, spy } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.cancelScheduleYes,
    async () => '{}',
    'token-1',
  );

  const output = await findTool(createNaverTools(context), 'cancel_schedule').run({
    scheduleId: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8',
  });

  assert.equal(output, RESULT.scheduleNotRead('sch_4e2f5c84-22e3-4a33-af12-549a427341f8'));
  // 목록을 안 읽었으면 서버에 아무것도 묻지 않고, 사용자에게 확인도 요청하지 않는다.
  assert.equal(spy.askUserCalls.length, 0);
});

test('scheduleId 가 비면 서버를 부르기 전에 막는다', async () => {
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.cancelScheduleYes,
    async () => '{}',
    'token-1',
  );
  const tools = createNaverTools(context);

  assert.equal(await findTool(tools, 'get_schedule').run({ scheduleId: '  ' }), RESULT.scheduleIdRequired);
  assert.equal(await findTool(tools, 'cancel_schedule').run({ scheduleId: '' }), RESULT.scheduleIdRequired);
});

test('계정 목록을 못 읽으면 예약을 읽지도 빈 결과로 뭉개지도 않는다', async () => {
  // baseUrl 이 비어 있어 axios 가 던진다. 소유 판정의 근거가 없으면 남의 예약을 건드릴 수 있다.
  const { context } = createStubContext(
    ['NID_AUT', 'NID_SES'],
    async () => CONFIRM.cancelScheduleYes,
    async () => '{}',
    'token-1',
  );

  const output = await findTool(createNaverTools(context), 'list_schedules').run({});

  assert.ok(output.startsWith('내 계정 목록을 읽지 못해서'), output);
  assert.notEqual(output, RESULT.noSchedules);
});

test('시스템 프롬프트가 예약 확인 규칙을 싣는다', () => {
  const prompt = buildAgentSystemPrompt({ today: TODAY });

  assert.ok(prompt.includes('get_schedule'));
  assert.ok(prompt.includes('list_schedules'));
  assert.ok(prompt.includes('cancel_schedule'));
});

test('예약 상태는 전부 한국어 라벨을 가진다', () => {
  // 라벨이 빠지면 표에 영어 원문이 그대로 새어 나간다.
  SCHEDULE_STATUSES.forEach((status) =>
    assert.ok(RESULT.scheduleStatus[status], status),
  );
  SCHEDULE_JOB_STATUSES.forEach((status) =>
    assert.ok(RESULT.scheduleJobStatus[status], status),
  );
});

// ---------- 소유 판정 (스케줄러 조회 라우트에 소유자 스코프가 없어서 여기서 한다) ----------

test('loginId 가 없는 계정 행은 소유 판정에서 뺀다', () => {
  // Schedule.accountId 와 맞춰 볼 값이 없으면 그 계정으로는 아무것도 인가할 수 없다.
  const owned = indexOwnedAccounts([
    { id: 'a1', name: '가', blogId: 'blog-a', loginId: 'sampleblog01' },
    { id: 'a2', name: '나', blogId: 'blog-b' },
  ]);

  assert.equal(owned.size, 1);
  assert.equal(isOwnedSchedule('sampleblog01', owned), true);
  assert.equal(isOwnedSchedule('blog-b', owned), false);
});

test('네이버 로그인 id 는 대소문자와 공백을 가리지 않고 맞춘다', () => {
  const owned = ownedFixture();

  assert.equal(isOwnedSchedule('  SampleBlog01 ', owned), true);
  assert.equal(isOwnedSchedule('sampleblog0', owned), false);
  assert.equal(isOwnedSchedule('', owned), false);
});

test('계정 표시는 내 것이면 이름, 아니면 남의 것이라고 적는다', () => {
  const owned = ownedFixture();

  assert.equal(describeScheduleAccount('sampleblog01', owned), '샘플블로그');
  assert.equal(describeScheduleAccount('someoneelse02', owned), CONFIRM.cancelScheduleForeignAccount);

  // 이름을 안 붙였으면 블로그 id 로, 그것도 없으면 가린 로그인 id 로 떨어진다.
  const noName = ownedFixture({ name: '' });
  assert.equal(describeScheduleAccount('sampleblog01', noName), 'sampleblog');
  const bare = ownedFixture({ name: '', blogId: '' });
  assert.equal(describeScheduleAccount('sampleblog01', bare), 'sam***');
});

test('accountId 필터는 다붓 id·이름·블로그 id 를 전부 받는다', () => {
  // 예전에는 목록이 마스킹한 값만 보여줘서 모델이 넣을 수 있는 유효한 값이 아예 없었다.
  const owned = ownedFixture();

  ['68f1a2b3c4d5e6f7a8b9c0d1', '샘플블로그', 'sampleblog', 'sampleblog01'].forEach((value) => {
    const resolved = resolveScheduleAccountFilter(value, owned);
    assert.equal(resolved.ok, true, value);
    assert.deepEqual(resolved.ok ? resolved.accounts.map(({ id }) => id) : [], [
      '68f1a2b3c4d5e6f7a8b9c0d1',
    ]);
  });
});

test('모르는 accountId 필터는 조용히 비우지 않고 거부한다', () => {
  const resolved = resolveScheduleAccountFilter('acc-none', ownedFixture());

  assert.equal(resolved.ok === false ? resolved.result : '', RESULT.scheduleAccountFilterUnknown('acc-none'));
});

test('필터가 없으면 내 계정 전부를 대상으로 삼는다', () => {
  const owned = ownedFixture(
    { id: 'a1', loginId: 'sampleblog01' },
    { id: 'a2', loginId: 'sampleblog02' },
  );

  const resolved = resolveScheduleAccountFilter(undefined, owned);

  assert.deepEqual(resolved.ok ? resolved.accounts.map(({ id }) => id) : [], ['a1', 'a2']);
});

test('계정이 너무 많으면 일부만 훑고 다 봤다고 하지 않는다', () => {
  const owned = ownedFixture(
    ...Array.from({ length: MAX_SCHEDULE_ACCOUNTS + 1 }, (_, index) => ({
      id: `a${index}`,
      loginId: `sampleblog${index}`,
    })),
  );

  const resolved = resolveScheduleAccountFilter('', owned);

  assert.equal(
    resolved.ok === false ? resolved.result : '',
    RESULT.scheduleTooManyAccounts(MAX_SCHEDULE_ACCOUNTS + 1, MAX_SCHEDULE_ACCOUNTS),
  );
});

test('계정별로 받은 목록을 등록 시각으로 다시 최신순으로 합친다', () => {
  // 계정마다 최근 50건이 따로 온다. 그대로 이으면 첫 계정이 목록을 독차지한다.
  const merged = mergeScheduleLists(
    [
      [scheduleFixture({ id: 'sch_old', createdAt: '2026-09-01T00:00:00.000Z' })],
      [
        scheduleFixture({ id: 'sch_new', createdAt: '2026-09-05T00:00:00.000Z' }),
        scheduleFixture({ id: 'sch_mid', createdAt: '2026-09-03T00:00:00.000Z' }),
      ],
    ],
    50,
  );

  assert.deepEqual(merged.map(({ id }) => id), ['sch_new', 'sch_mid', 'sch_old']);
});

test('멈출 수 있는 건수와 이미 발행된 건수를 상태로 가른다', () => {
  const jobs = [
    jobFixture({ id: 'j1', status: 'pending' }),
    jobFixture({ id: 'j2', status: 'generating' }),
    jobFixture({ id: 'j3', status: 'generated' }),
    jobFixture({ id: 'j4', status: 'publishing' }),
    jobFixture({ id: 'j5', status: 'published' }),
    jobFixture({ id: 'j6', status: 'failed' }),
    jobFixture({ id: 'j7', status: 'cancelled' }),
  ];

  assert.equal(countStoppableJobs(jobs), 4);
  assert.equal(countPublishedJobs(jobs), 1);
});

// ---------- 되돌릴 수 없는 경로를 진짜 HTTP 로 확인한다 ----------

type SchedulerCall = { method: string; url: string };

/**
 * 스케줄러 흉내를 내는 로컬 서버.
 *
 * 게이트 전체가 `if (!approved) return` 한 줄인데, 스텁 컨텍스트의 baseUrl 이 비어 있으면
 * 승인 이후 경로가 테스트에서 아예 열리지 않는다. 그 줄을 지워도 전부 초록이면
 * 되돌릴 수 없는 작업의 유일한 분기가 회귀 감지 밖에 있는 것이다. 그래서 실제로 요청을 받아
 * DELETE 가 몇 번 나갔는지 센다.
 */
const startFakeScheduler = async ({
  accounts = [{ id: 'acc-1', name: '샘플블로그', blogId: 'sampleblog', loginId: 'sampleblog01' }],
  schedule = { _id: 'sch_1', accountId: 'sampleblog01', scheduleDate: '2026-09-03', status: 'pending', totalJobs: 1, createdAt: '2026-09-02T10:00:00.000Z' } as Record<string, unknown>,
  jobs = [{ _id: 'job_1', keyword: '제물포구맛집', scheduledAt: '2026-09-03 23:00', status: 'pending', projectId: '6a76084a9f8378fbf93e52f3' }] as Record<string, unknown>[],
  scheduleFound = true,
}: {
  accounts?: Record<string, unknown>[];
  schedule?: Record<string, unknown>;
  jobs?: Record<string, unknown>[];
  scheduleFound?: boolean;
} = {}) => {
  const calls: SchedulerCall[] = [];

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '';
    calls.push({ method: req.method ?? '', url });

    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.startsWith('/api/blog-accounts')) return send(200, { accounts });
    if (!scheduleFound) return send(404, { message: 'Schedule not found' });
    if (req.method === 'DELETE') return send(200, { success: true, id: schedule._id });
    if (url.startsWith('/schedules/')) return send(200, { schedule, jobs });
    if (url.startsWith('/schedules')) return send(200, { schedules: [schedule] });

    return send(404, { message: 'not found' });
  };

  const server: Server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    deleteCount: () => calls.filter(({ method }) => method === 'DELETE').length,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
  };
};

const schedulerContext = (baseUrl: string, answer: () => Promise<string>) => {
  const { context, spy } = createStubContext(['NID_AUT', 'NID_SES'], answer, async () => '{}', 'token-1');

  return {
    spy,
    context: {
      ...context,
      getEndpoints: () => ({
        dabutBaseUrl: baseUrl,
        schedulerBaseUrl: baseUrl,
        exposureBotDir: '',
        exposureDashboardUrl: baseUrl,
      }),
    } as ToolContext,
  };
};

test('사용자가 거절하면 DELETE 요청이 한 번도 나가지 않는다', async () => {
  const server = await startFakeScheduler();

  try {
    const { context } = schedulerContext(server.baseUrl, async () => CONFIRM.cancelScheduleNo);
    const tools = createNaverTools(context);

    await findTool(tools, 'list_schedules').run({});
    const output = await findTool(tools, 'cancel_schedule').run({ scheduleId: 'sch_1' });

    assert.equal(output, RESULT.scheduleCancelNotApproved(CONFIRM.cancelScheduleNo));
    assert.equal(server.deleteCount(), 0);
  } finally {
    await server.close();
  }
});

test('확인이 끊겨도 DELETE 는 나가지 않고 거절과 다른 이유를 남긴다', async () => {
  const server = await startFakeScheduler();

  try {
    const { context } = schedulerContext(server.baseUrl, async () => {
      throw new Error(ERRORS.questionTimeout);
    });
    const tools = createNaverTools(context);

    await findTool(tools, 'list_schedules').run({});
    const output = await findTool(tools, 'cancel_schedule').run({ scheduleId: 'sch_1' });

    assert.equal(output, RESULT.scheduleCancelNoAnswer('sch_1'));
    assert.equal(server.deleteCount(), 0);
  } finally {
    await server.close();
  }
});

test('빈 답도 승인이 아니다', async () => {
  const server = await startFakeScheduler();

  try {
    const { context } = schedulerContext(server.baseUrl, async () => '   ');
    const tools = createNaverTools(context);

    await findTool(tools, 'list_schedules').run({});
    await findTool(tools, 'cancel_schedule').run({ scheduleId: 'sch_1' });

    assert.equal(server.deleteCount(), 0);
  } finally {
    await server.close();
  }
});

test('정확일치 승인이면 DELETE 가 한 번 나가고 실제 효과대로 보고한다', async () => {
  const server = await startFakeScheduler({
    schedule: {
      _id: 'sch_1',
      accountId: 'sampleblog01',
      scheduleDate: '2026-09-03',
      status: 'pending',
      totalJobs: 2,
      createdAt: '2026-09-02T10:00:00.000Z',
    },
    jobs: [
      { _id: 'job_1', keyword: '제물포구맛집', scheduledAt: '2026-09-03 23:00', status: 'published' },
      { _id: 'job_2', keyword: '인천맛집', scheduledAt: '2026-09-04 09:00', status: 'pending' },
    ],
  });

  try {
    const { context } = schedulerContext(server.baseUrl, async () => CONFIRM.cancelScheduleYes);
    const tools = createNaverTools(context);

    await findTool(tools, 'list_schedules').run({});
    const output = await findTool(tools, 'cancel_schedule').run({ scheduleId: 'sch_1' });

    assert.equal(server.deleteCount(), 1);
    // 전체 2건이지만 실제로 멈추는 건 1건이고, 발행된 1건은 네이버에 남는다.
    assert.equal(output, RESULT.scheduleCancelled('sch_1', 1, 2, 1));
  } finally {
    await server.close();
  }
});

test('내 계정 목록에 없는 예약은 읽지도 취소하지도 않는다', async () => {
  // 스케줄러의 GET/DELETE /schedules 에는 소유자 스코프가 없어서 남의 예약이 그대로 나온다.
  const server = await startFakeScheduler({
    schedule: {
      _id: 'sch_other',
      accountId: 'someoneelse02',
      scheduleDate: '2026-09-05',
      status: 'pending',
      totalJobs: 3,
      createdAt: '2026-09-02T10:00:00.000Z',
    },
  });

  try {
    const { context, spy } = schedulerContext(server.baseUrl, async () => CONFIRM.cancelScheduleYes);
    const tools = createNaverTools(context);

    // 목록에 남의 예약이 섞여 와도 knownSchedules 에 들어가지 않는다.
    assert.equal(await findTool(tools, 'list_schedules').run({}), RESULT.noSchedules);

    // 상세를 직접 읽어도 내용을 내주지 않고, 취소 게이트가 인정할 id 로 만들어 주지도 않는다.
    assert.equal(
      await findTool(tools, 'get_schedule').run({ scheduleId: 'sch_other' }),
      RESULT.scheduleNotOwned('sch_other'),
    );
    assert.equal(
      await findTool(tools, 'cancel_schedule').run({ scheduleId: 'sch_other' }),
      RESULT.scheduleNotRead('sch_other'),
    );

    assert.equal(server.deleteCount(), 0);
    assert.equal(spy.askUserCalls.length, 0);
  } finally {
    await server.close();
  }
});

test('없는 예약은 읽기 실패가 아니라 id 를 다시 확인하라고 알린다', async () => {
  // axios 가 404 를 던지므로 schedule === null 로는 절대 도달하지 않는다.
  const server = await startFakeScheduler({ scheduleFound: false });

  try {
    const { context } = schedulerContext(server.baseUrl, async () => CONFIRM.cancelScheduleNo);
    const output = await findTool(createNaverTools(context), 'get_schedule').run({
      scheduleId: 'sch_gone',
    });

    assert.equal(output, RESULT.scheduleNotFound('sch_gone'));
  } finally {
    await server.close();
  }
});

test('get_schedule 이 저장된 projectId 를 원문 그대로 돌려준다', async () => {
  // 이 도구를 만든 이유. 에이전트가 "저장값을 직접 검증하지는 못한다" 고 말하던 자리다.
  const server = await startFakeScheduler();

  try {
    const { context } = schedulerContext(server.baseUrl, async () => CONFIRM.cancelScheduleNo);
    const output = await findTool(createNaverTools(context), 'get_schedule').run({ scheduleId: 'sch_1' });
    const [row] = JSON.parse(output) as Record<string, string>[];

    assert.equal(row?.projectId, '6a76084a9f8378fbf93e52f3');
    assert.equal(row?.keyword, '제물포구맛집');
    assert.equal(row?.manuscriptType, RESULT.scheduleManuscriptTypeMissing);
  } finally {
    await server.close();
  }
});

test('계정 목록은 네이버 로그인 id 원문을 모델에게 내보내지 않는다', async () => {
  const server = await startFakeScheduler();

  try {
    const { context } = schedulerContext(server.baseUrl, async () => CONFIRM.cancelScheduleNo);
    const output = await findTool(createNaverTools(context), 'list_scheduler_accounts').run({});

    assert.equal(output.includes('sampleblog01'), false, output);
    assert.ok(output.includes('샘플블로그'), output);
  } finally {
    await server.close();
  }
});

test('job 상태는 하나도 빠짐없이 멈출 수 있음/없음으로 갈린다', () => {
  // 스케줄러에 상태가 추가됐는데 여기 분류가 안 되면 취소 문안의 숫자가 조용히 틀어진다.
  const terminal = ['published', 'failed', 'cancelled'];

  SCHEDULE_JOB_STATUSES.forEach((status) => {
    const isStoppable = STOPPABLE_JOB_STATUSES.includes(status);
    assert.equal(isStoppable !== terminal.includes(status), true, status);
  });
});

// ---------- 계정 관리 ----------

test('승인 토큰 다섯이 서로 겹치지 않는다', () => {
  // 겹치면 한쪽 승인이 다른 쪽으로 샌다. 글 삭제 승인이 계정 삭제가 되는 식이다.
  const tokens = [
    CONFIRM.deleteYes,
    CONFIRM.cancelScheduleYes,
    CONFIRM.accountRemoveYes,
    CONFIRM.exposureRunYes,
    CONFIRM.presetSaveYes,
  ];

  assert.equal(new Set(tokens).size, tokens.length);
  assert.equal(isAccountRemoveApproved(CONFIRM.deleteYes), false);
  assert.equal(isExposureRunApproved(CONFIRM.cancelScheduleYes), false);
  assert.equal(isPresetSaveApproved(CONFIRM.accountRemoveYes), false);
  assert.equal(isAccountRemoveApproved(` ${CONFIRM.accountRemoveYes} `), true);
});

test('manage_naver_account 스키마에 password 가 없다', () => {
  // 인자에 실으면 tool_start 이벤트와 OpenRouter 요청 본문에 평문이 그대로 남는다.
  const tools = createNaverTools(createStubContext().context);
  const schema = findTool(tools, 'manage_naver_account').parameters as {
    properties: Record<string, unknown>;
    additionalProperties: boolean;
  };

  assert.equal(Object.hasOwn(schema.properties, 'password'), false);
  assert.equal(schema.additionalProperties, false);
});

test('목록을 안 읽었으면 계정을 못 고친다', async () => {
  const { context, spy } = createStubContext();
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'manage_naver_account').run({
    action: 'change_password',
    accountId: STUB_ACCOUNT.id,
  });

  assert.equal(output, RESULT.accountNotListed(STUB_ACCOUNT.id));
  assert.equal(spy.accountCardCalls.length, 0);
});

test('목록을 읽은 뒤에는 카드를 띄운다', async () => {
  const { context, spy } = createStubContext();
  context.requestAccountCard = async (request) => {
    spy.accountCardCalls.push(request);

    return JSON.stringify({
      status: 'account_password',
      id: STUB_ACCOUNT.id,
      label: STUB_ACCOUNT.label,
      local: true,
      dabut: 'changed',
      dabutDetail: '메인 블로그',
    });
  };

  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});

  const output = await findTool(tools, 'manage_naver_account').run({
    action: 'change_password',
    accountId: STUB_ACCOUNT.id,
  });

  assert.equal(spy.accountCardCalls.length, 1);
  assert.equal(spy.accountCardCalls[0]?.mode, 'change_password');
  // 두 곳을 반드시 따로 적는다. 한 줄로 뭉치면 모델이 "다 바꿨어요" 라고 보고한다.
  assert.equal(output.includes(RESULT.accountLocalChanged), true);
  assert.equal(output.includes(RESULT.accountDabutChanged('메인 블로그')), true);
});

test('다붓 반영 실패를 로컬 성공에 묻지 않는다', async () => {
  const { context } = createStubContext();
  context.requestAccountCard = async () =>
    JSON.stringify({
      status: 'account_password',
      id: STUB_ACCOUNT.id,
      label: STUB_ACCOUNT.label,
      local: true,
      dabut: 'no_match',
      dabutDetail: '',
    });

  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});

  const output = await findTool(tools, 'manage_naver_account').run({
    action: 'change_password',
    accountId: STUB_ACCOUNT.id,
  });

  assert.equal(output.includes(RESULT.accountDabutNoMatch), true);
});

test('비밀번호 카드를 되돌려보내면 같은 계정에 다시 띄우지 않는다', async () => {
  // 거절이 끈적하지 않으면 모델이 max_iterations 까지 비밀번호 칸을 다시 띄울 수 있다.
  // 앱 크롬 안에서 뜨는 정품 카드라 사용자는 몇 번째인지 말고는 구분할 근거가 없다.
  const { context, spy } = createStubContext();
  context.requestAccountCard = async (request) => {
    spy.accountCardCalls.push(request);

    return JSON.stringify({ status: 'cancelled' });
  };

  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});
  const manage = findTool(tools, 'manage_naver_account');

  const first = await manage.run({ action: 'change_password', accountId: STUB_ACCOUNT.id });
  const second = await manage.run({ action: 'change_password', accountId: STUB_ACCOUNT.id });

  assert.equal(first, RESULT.accountCardCancelled);
  assert.equal(second, RESULT.accountAlreadyAttempted(STUB_ACCOUNT.id));
  assert.equal(spy.accountCardCalls.length, 1);
});

test('비밀번호 카드에 답이 없어도 다시 띄우지 않는다', async () => {
  const { context, spy } = createStubContext();
  context.requestAccountCard = async (request) => {
    spy.accountCardCalls.push(request);

    return '';
  };

  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});
  const manage = findTool(tools, 'manage_naver_account');

  await manage.run({ action: 'change_password', accountId: STUB_ACCOUNT.id });
  const second = await manage.run({ action: 'change_password', accountId: STUB_ACCOUNT.id });

  assert.equal(second, RESULT.accountAlreadyAttempted(STUB_ACCOUNT.id));
  assert.equal(spy.accountCardCalls.length, 1);
});

test('계정 추가 카드를 닫으면 이번 실행에서는 다시 안 띄운다', async () => {
  // add 에는 accountId 가 없어 touchedAccountIds 가 못 잡는다. 따로 막는다.
  const { context, spy } = createStubContext();
  context.requestAccountCard = async (request) => {
    spy.accountCardCalls.push(request);

    return JSON.stringify({ status: 'cancelled' });
  };

  const tools = createNaverTools(context);
  const manage = findTool(tools, 'manage_naver_account');

  const first = await manage.run({ action: 'add', naverId: 'someone' });
  const second = await manage.run({ action: 'add', naverId: 'someone' });

  assert.equal(first, RESULT.accountCardCancelled);
  assert.equal(second, RESULT.accountCardAlreadyDeclined);
  assert.equal(spy.accountCardCalls.length, 1);
});

test('노출지기 로그인 카드를 건너뛰면 다시 안 띄운다', async () => {
  const { context } = createStubContext();
  let cards = 0;
  context.requestExposureLogin = async () => {
    cards += 1;

    return JSON.stringify({ status: 'cancelled' });
  };

  const tools = createNaverTools(context);
  const login = findTool(tools, 'exposure_login');

  const first = await login.run({});
  const second = await login.run({});

  assert.equal(first, RESULT.exposureLoginSkipped);
  assert.equal(second, RESULT.exposureLoginAlreadyDeclined);
  assert.equal(cards, 1);
});

test('다붓 반영 상태마다 다른 문장을 낸다', () => {
  assert.equal(describeDabutSync('changed', '이름'), RESULT.accountDabutChanged('이름'));
  assert.equal(describeDabutSync('no_match', ''), RESULT.accountDabutNoMatch);
  assert.equal(describeDabutSync('no_login', ''), RESULT.accountDabutNoLogin);
  assert.equal(describeDabutSync('failed', '502'), RESULT.accountDabutFailed('502'));
});

test('카드를 닫으면 아무것도 안 바뀐 것으로 본다', () => {
  assert.deepEqual(parseCardOutcome('{}'), { status: 'cancelled' });
  assert.deepEqual(parseCardOutcome('not json'), { status: 'cancelled' });
  assert.deepEqual(parseCardOutcome('[1,2]'), { status: 'cancelled' });
  assert.deepEqual(parseCardOutcome('{"status":"exposure_login","name":"a"}'), {
    status: 'exposure_login',
    name: 'a',
  });
});

test('계정 삭제는 확인을 받아야 지운다', async () => {
  const { context, spy } = createStubContext(['NID_AUT', 'NID_SES'], async () => '아니요');
  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});

  const output = await findTool(tools, 'manage_naver_account').run({
    action: 'remove',
    accountId: STUB_ACCOUNT.id,
  });

  assert.equal(output, RESULT.accountRemoveNotApproved('아니요'));
  assert.deepEqual(spy.removedAccountIds, []);
});

test('계정 삭제 확인 문구에 남는 것과 사라지는 것을 둘 다 적는다', async () => {
  const asked: string[] = [];

  await requestAccountRemoveApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.accountRemoveNo;
    },
    account: { id: 'acc-a', label: '메인', naverId: 'myblog01', hasPassword: true },
  });

  const [question] = asked;
  assert.ok(question);
  // "지웠으니 로그아웃됐겠지" 라는 틀린 안심을 주면 안 된다.
  assert.equal(question.includes('비밀번호도 같이 사라져서'), true);
  assert.equal(question.includes('쿠키는 남아요'), true);
});

test('승인하면 지우고 남는 것을 알린다', async () => {
  const { context, spy } = createStubContext(['NID_AUT', 'NID_SES'], async () => CONFIRM.accountRemoveYes);
  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});

  const output = await findTool(tools, 'manage_naver_account').run({
    action: 'remove',
    accountId: STUB_ACCOUNT.id,
  });

  assert.deepEqual(spy.removedAccountIds, [STUB_ACCOUNT.id]);
  assert.equal(output, RESULT.accountRemoved(STUB_ACCOUNT.label, STUB_ACCOUNT.id));
  assert.equal(output.includes('쿠키는 그대로'), true);
});

test('같은 계정에 두 번 손대지 않는다', async () => {
  const { context } = createStubContext(['NID_AUT', 'NID_SES'], async () => CONFIRM.accountRemoveNo);
  const tools = createNaverTools(context);
  await findTool(tools, 'list_accounts').run({});

  const first = await findTool(tools, 'manage_naver_account').run({
    action: 'remove',
    accountId: STUB_ACCOUNT.id,
  });
  const second = await findTool(tools, 'manage_naver_account').run({
    action: 'remove',
    accountId: STUB_ACCOUNT.id,
  });

  assert.equal(first, RESULT.accountRemoveNotApproved(CONFIRM.accountRemoveNo));
  assert.equal(second, RESULT.accountAlreadyAttempted(STUB_ACCOUNT.id));
});

// ---------- 노출지기 ----------

test('노출지기 로그인 전에는 프리셋을 못 고친다', async () => {
  const { context } = createStubContext();
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({
    action: 'add_cafe_check',
    label: 'x',
  });

  assert.equal(output, RESULT.exposureNotLoggedIn);
});

test('만료된 쿠키는 지우고 다시 로그인시킨다', async () => {
  const { context, spy } = createStubContext();
  // 발급 시각이 8일 전이면 서버에 묻지 않고도 죽은 줄 안다.
  context.getExposureCookie = () => `${Date.now() - 8 * 24 * 60 * 60 * 1000}.m1.sig`;

  const tools = createNaverTools(context);
  const output = await findTool(tools, 'update_exposure_preset').run({ action: 'enable_target' });

  assert.equal(output, RESULT.exposureSessionExpired);
  assert.equal(spy.exposureCookieCleared, 1);
});

test('모르는 프리셋 동작은 네트워크를 타기 전에 막는다', async () => {
  const { context } = createStubContext();
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({ action: 'set_target_sheet' });

  assert.equal(output, RESULT_PRESET.unknownPresetAction('set_target_sheet'));
});

test('update_exposure_preset 스키마에 set_target_sheet 가 없다', () => {
  const tools = createNaverTools(createStubContext().context);
  const schema = findTool(tools, 'update_exposure_preset').parameters as {
    properties: { action: { enum: string[] } };
  };

  assert.equal(schema.properties.action.enum.includes('set_target_sheet'), false);
  assert.equal(schema.properties.action.enum.includes('add_cafe_check'), true);
});

test('노출체크 실행은 확인 카드를 먼저 띄운다', async () => {
  // "카페노출체크하고싶어" 사고는 프롬프트가 아니라 게이트가 없어서 났다.
  const asked: string[] = [];

  const { approved } = await requestExposureRunApproval({
    askUser: async (question) => {
      asked.push(question);
      return CONFIRM.exposureRunNo;
    },
    label: '카페',
  });

  const [question] = asked;
  assert.equal(approved, false);
  assert.ok(question);
  assert.equal(question.includes('수 분에서 수십 분'), true);
  assert.equal(question.includes('새 체크를 만들려던 것이면'), true);
});

test('노출체크 실행 거절은 실패가 아니라고 알린다', async () => {
  const { context } = createStubContext(['NID_AUT', 'NID_SES'], async () => CONFIRM.exposureRunNo);
  context.getEndpoints = () => ({
    dabutBaseUrl: '',
    schedulerBaseUrl: '',
    exposureBotDir: '/tmp/does-not-exist-gng',
    exposureDashboardUrl: '',
    viroBaseUrl: '',
  });

  const tools = createNaverTools(context);
  const output = await findTool(tools, 'run_exposure_check').run({ job: 'cafe' });

  // 저장소가 없으면 findExposureJob 이 먼저 걸러서 확인 카드까지 못 간다.
  assert.equal(output, RESULT.unknownExposureJob);
});

test('빈 job 은 목록을 보라고 돌려준다', async () => {
  const { context } = createStubContext();
  const tools = createNaverTools(context);

  assert.equal(await findTool(tools, 'run_exposure_check').run({ job: '  ' }), RESULT.unknownExposureJob);
});

// ---------- 읽기 도구 ----------

test('허용목록 밖 경로는 네트워크를 타지 않는다', async () => {
  const { context } = createStubContext(['NID_AUT', 'NID_SES'], undefined, undefined, 'token');
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'api_get').run({
    service: 'dabut',
    path: '/generate/project',
  });

  assert.equal(output, RESULT.apiGetPathNotAllowed('dabut', '/generate/project'));
});

test('쿼리를 경로에 붙이면 거부한다', async () => {
  const { context } = createStubContext(['NID_AUT', 'NID_SES'], undefined, undefined, 'token');
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'api_get').run({
    service: 'scheduler',
    path: '/schedules?accountId=me',
  });

  assert.equal(output, RESULT.apiGetPathNotAllowed('scheduler', '/schedules?accountId=me'));
});

test('로그인 없이 읽으려 하면 무엇을 부를지 알려준다', async () => {
  const { context } = createStubContext();
  const tools = createNaverTools(context);

  assert.equal(
    await findTool(tools, 'api_get').run({ service: 'dabut', path: '/projects' }),
    RESULT.apiGetNoAuth('dabut'),
  );
  assert.equal(
    await findTool(tools, 'api_get').run({ service: 'exposure', path: '/api/preset' }),
    RESULT.exposureNotLoggedIn,
  );
});

test('api_get 은 헤더 파라미터를 받지 않는다', () => {
  // 받게 두면 모델이 토큰을 인자에 쓰게 되고 그 인자는 대화 기록에 남는다.
  const tools = createNaverTools(createStubContext().context);
  const schema = findTool(tools, 'api_get').parameters as {
    properties: Record<string, unknown>;
    additionalProperties: boolean;
  };

  assert.deepEqual(Object.keys(schema.properties).sort(), ['path', 'query', 'service']);
  assert.equal(schema.additionalProperties, false);
});

test('read_api_doc 은 목차와 limits 를 준다', async () => {
  const tools = createNaverTools(createStubContext().context);

  const index = await findTool(tools, 'read_api_doc').run({});
  assert.equal(index.includes('limits'), true);

  const limits = await findTool(tools, 'read_api_doc').run({ topic: 'limits' });
  assert.equal(limits.includes('EXPOSURE_TARGET_IDS'), true);
  assert.equal(limits.includes('카페 노출체크'), true);
});

test('없는 주제를 지어내면 목록을 돌려준다', async () => {
  const tools = createNaverTools(createStubContext().context);

  const output = await findTool(tools, 'read_api_doc').run({ topic: 'billing' });

  assert.equal(output.includes('accounts'), true);
  assert.equal(output.includes('billing'), true);
});

test('도구 이름이 전부 다르고 새 다섯 개가 들어 있다', () => {
  const names = createNaverTools(createStubContext().context).map(({ name }) => name);

  assert.equal(new Set(names).size, names.length);
  ['manage_naver_account', 'exposure_login', 'update_exposure_preset', 'read_api_doc', 'api_get'].forEach(
    (name) => assert.equal(names.includes(name), true, name),
  );
});

// ---------- 노출지기 왕복 ----------

/**
 * 노출지기 대시보드 흉내. 쿠키 세션이라 Cookie 헤더가 오는지도 같이 본다.
 * 프리셋 PUT 이 전체 교체이므로 "보낸 몸통 전체" 를 그대로 붙잡아 둔다.
 */
const fakeExposure = async ({
  preset = {
    targets: [
      { id: 'cafe', label: '카페 + 블로그', kind: 'basic', source: { sheetId: 's1', tabTitle: '카페' }, enabled: true },
    ],
    blogGroups: [{ id: 'group-1', label: '준최', blogIds: ['blog-a'] }],
    doorayWebhookUrl: 'https://hook.dooray.com/old',
  } as Record<string, unknown>,
  jobs = [
    { id: 'cafe-check:my-cafe', label: '내 카페', description: '설명', kind: 'cafe-check', isRunning: false, isBlocked: false },
  ] as Record<string, unknown>[],
  presetStatus = 200,
  // 실제 노출지기는 저장 직전에 값을 정규화하고 못 쓰는 값을 조용히 버린다.
  // 기본은 받은 그대로 저장하고, 그 갈림을 재현할 때만 갈아 끼운다.
  normalize = (raw: Record<string, unknown>) => raw,
}: {
  preset?: Record<string, unknown>;
  jobs?: Record<string, unknown>[];
  presetStatus?: number;
  normalize?: (raw: Record<string, unknown>) => Record<string, unknown>;
} = {}) => {
  const calls: { method: string; url: string; cookie: string; body: string }[] = [];
  let stored = preset;

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const url = req.url ?? '';
      calls.push({
        method: req.method ?? '',
        url,
        cookie: String(req.headers.cookie ?? ''),
        body: Buffer.concat(chunks).toString(),
      });

      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (url === '/api/preset' && req.method === 'GET') {
        return send(200, { member: { id: 'm1', loginId: 'me', displayName: '나' }, preset: stored });
      }
      if (url === '/api/preset' && req.method === 'PUT') {
        if (presetStatus !== 200) {
          return send(presetStatus, { error: '패키지: 읽기 시트 ID가 비어 있음' });
        }

        const sent = (JSON.parse(Buffer.concat(chunks).toString()) as { preset: Record<string, unknown> })
          .preset;
        stored = normalize(sent);

        // 저장된 값을 되돌려준다. 보낸 값을 그대로 메아리치면 정규화로 갈리는 자리를 못 잡는다.
        return send(200, { member: { id: 'm1' }, preset: stored });
      }
      if (url === '/api/jobs') return send(200, { jobs, bundles: [] });
      if (url.endsWith('/run')) return send(200, { runId: 'run-9' });

      return send(404, { error: 'not found' });
    });
  };

  const server: Server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    /** 승인 대기 중에 다른 곳에서 프리셋이 바뀌는 상황을 만든다. */
    mutate: (change: (raw: Record<string, unknown>) => Record<string, unknown>) => {
      stored = change(stored);
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};

const exposureContext = (baseUrl: string, answer: () => Promise<string>) => {
  const { context, spy } = createStubContext(['NID_AUT', 'NID_SES'], answer);

  return {
    spy,
    context: {
      ...context,
      getEndpoints: () => ({
        dabutBaseUrl: '',
        schedulerBaseUrl: '',
        exposureBotDir: '',
        exposureDashboardUrl: baseUrl,
      }),
      getExposureCookie: () => `${Date.now()}.m1.sig`,
    } as ToolContext,
  };
};

test('프리셋 저장은 GET 으로 읽은 나머지를 통째로 다시 보낸다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveYes);
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({
    action: 'add_cafe_check',
    label: 'My Cafe',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1AbC/edit',
    tabTitle: '9월',
    targets: ['https://cafe.naver.com/abc'],
  });

  const put = server.calls.find(({ method }) => method === 'PUT');
  assert.ok(put);

  const { preset } = JSON.parse(put.body) as { preset: Record<string, unknown> };

  // 전체 교체라 여기서 하나라도 빠지면 사용자 설정이 조용히 사라진다.
  assert.equal((preset.targets as unknown[]).length, 1);
  assert.equal((preset.blogGroups as unknown[]).length, 1);
  assert.equal(preset.doorayWebhookUrl, 'https://hook.dooray.com/old');
  assert.equal((preset.cafeChecks as { id: string }[])[0]?.id, 'my-cafe');
  assert.equal(put.cookie.includes('dashboard_session='), true);
  assert.equal(output.includes('My Cafe'), true);
});

test('저장 결과는 서버가 실제로 저장한 값으로 보고한다', async (t) => {
  // 노출지기는 저장 직전에 blogIds 를 정규화하고 못 쓰는 값을 버린다.
  // 보내기 전 요약을 사실로 보고하면 "블로그 3개" 라고 말한 뒤 서버에는 1개만 남는다.
  const server = await fakeExposure({
    normalize: (raw) => ({
      ...raw,
      blogGroups: (raw.blogGroups as { id: string; label: string; blogIds: string[] }[]).map(
        (group) => ({ ...group, blogIds: group.blogIds.slice(0, 1) }),
      ),
    }),
  });
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveYes);
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({
    action: 'add_blog_group',
    label: '최블',
    blogIds: ['airtrd', 'solantoro', 'tpeany'],
  });

  // 도구가 보낸 것은 3개인데 서버가 1개만 저장했다. 보고는 저장된 쪽을 따라야 한다.
  assert.equal(output.includes('블로그 1개'), true);
  assert.equal(output.includes('블로그 3개'), false);
});

test('저장했는데 되돌아온 값에 없으면 만들어졌다고 하지 않는다', async (t) => {
  const server = await fakeExposure({ normalize: (raw) => ({ ...raw, cafeChecks: [] }) });
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveYes);
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({
    action: 'add_cafe_check',
    label: 'My Cafe',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1AbC/edit',
    tabTitle: '9월',
    targets: ['https://cafe.naver.com/abc'],
  });

  assert.equal(output.includes(RESULT_PRESET.savedMissing('my-cafe')), true);
});

test('카드를 읽는 사이 프리셋이 바뀌면 덮어쓰지 않는다', async (t) => {
  // PUT 은 전체 교체다. GET -> 승인 대기 -> PUT 사이에 대시보드에서 뭘 고치면 조용히 사라진다.
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => {
    // 사용자가 카드를 읽는 동안 다른 곳에서 프리셋이 바뀌었다고 치자.
    server.mutate((raw) => ({ ...raw, doorayWebhookUrl: 'https://hook.dooray.com/new' }));

    return CONFIRM.presetSaveYes;
  });
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({
    action: 'disable_target',
    targetId: 'cafe',
  });

  assert.equal(output, RESULT.presetChangedWhileWaiting);
  assert.equal(server.calls.some(({ method }) => method === 'PUT'), false);
});

test('api_get 은 두레이 웹훅 주소를 대화에 싣지 않는다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveNo);
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'api_get').run({ service: 'exposure', path: '/api/preset' });

  // 웹훅 인커밍 주소는 그 자체가 인증 토큰이다.
  assert.equal(output.includes('hook.dooray.com'), false);
  assert.equal(output.includes(REDACTED), true);
  // 나머지는 그대로 읽혀야 targetId 를 고를 수 있다.
  assert.equal(output.includes('"id":"cafe"'), true);
});

test('승인하지 않으면 PUT 을 아예 보내지 않는다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveNo);
  const tools = createNaverTools(context);

  const output = await findTool(tools, 'update_exposure_preset').run({
    action: 'disable_target',
    targetId: 'cafe',
  });

  assert.equal(output, RESULT.presetNotApproved(CONFIRM.presetSaveNo));
  assert.equal(server.calls.some(({ method }) => method === 'PUT'), false);
});

test('확인 카드가 손대지 않는 항목 수를 같이 보여준다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const asked: string[] = [];
  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveNo);
  context.askUser = async (question) => {
    asked.push(question);
    return CONFIRM.presetSaveNo;
  };

  await findTool(createNaverTools(context), 'update_exposure_preset').run({
    action: 'disable_target',
    targetId: 'cafe',
  });

  const [question] = asked;
  assert.ok(question);
  assert.equal(question.includes('통째로 저장'), true);
});

test('400 의 한국어 문구를 고치지 말라고 붙여서 넘긴다', async (t) => {
  const server = await fakeExposure({ presetStatus: 400 });
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.presetSaveYes);
  const output = await findTool(createNaverTools(context), 'update_exposure_preset').run({
    action: 'disable_target',
    targetId: 'cafe',
  });

  assert.equal(output, RESULT.presetRejected('패키지: 읽기 시트 ID가 비어 있음'));
});

test('로그인돼 있으면 서버 목록을 쓰고 카페체크도 나온다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.exposureRunYes);
  const output = await findTool(createNaverTools(context), 'list_exposure_jobs').run({});

  const rows = JSON.parse(output) as { job: string }[];
  assert.equal(rows[0]?.job, 'cafe-check:my-cafe');
});

test('원격 실행은 확인을 받은 뒤에야 POST 한다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.exposureRunNo);
  const tools = createNaverTools(context);

  await findTool(tools, 'list_exposure_jobs').run({});
  const refused = await findTool(tools, 'run_exposure_check').run({ job: 'cafe-check:my-cafe' });

  assert.equal(refused, RESULT.exposureRunNotApproved(CONFIRM.exposureRunNo));
  assert.equal(server.calls.some(({ url }) => url.endsWith('/run')), false);
});

test('승인하면 원격 실행 runId 를 돌려준다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => CONFIRM.exposureRunYes);
  const tools = createNaverTools(context);

  await findTool(tools, 'list_exposure_jobs').run({});
  const output = await findTool(tools, 'run_exposure_check').run({ job: 'cafe-check:my-cafe' });

  assert.equal(output, RESULT.exposureRunStarted('내 카페', 'run-9'));
  const run = server.calls.find(({ url }) => url.endsWith('/run'));
  assert.equal(run?.url, '/api/jobs/cafe-check%3Amy-cafe/run');
});

test('다른 노출체크가 돌고 있으면 확인도 묻지 않는다', async (t) => {
  const server = await fakeExposure({
    jobs: [
      {
        id: 'cafe-check:my-cafe',
        label: '내 카페',
        description: '',
        kind: 'cafe-check',
        isRunning: false,
        isBlocked: true,
        blockReason: '다른 노출체크가 실행 중임',
      },
    ],
  });
  t.after(() => server.close());

  const { context, spy } = exposureContext(server.baseUrl, async () => CONFIRM.exposureRunYes);
  const tools = createNaverTools(context);

  await findTool(tools, 'list_exposure_jobs').run({});
  const output = await findTool(tools, 'run_exposure_check').run({ job: 'cafe-check:my-cafe' });

  assert.equal(output, RESULT.exposureRunBlocked('내 카페', '다른 노출체크가 실행 중임'));
  assert.equal(spy.askUserCalls.length, 0);
});

test('api_get 은 허용된 경로만 실제로 부른다', async (t) => {
  const server = await fakeExposure();
  t.after(() => server.close());

  const { context } = exposureContext(server.baseUrl, async () => '');
  const output = await findTool(createNaverTools(context), 'api_get').run({
    service: 'exposure',
    path: '/api/preset',
  });

  assert.equal(output.includes('displayName'), true);
  assert.equal(server.calls.some(({ url }) => url === '/api/preset'), true);
});

test('도구는 29개다', () => {
  // AGENT.md 가 상한을 못박아 뒀다. 늘리려면 그 문장부터 다시 읽는다.
  // update_dabut_project 만 더했다. 읽기는 api_get 이 /projects* 를 이미 허용한다.
  assert.equal(createNaverTools(createStubContext().context).length, 29);
});

test('로컬 실행도 확인 카드를 먼저 띄운다', async (t) => {
  // 원격이든 로컬이든 30분짜리를 잘못 시작하는 비용은 같다.
  const dir = mkdtempSync(join(tmpdir(), 'gng-exposure-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ scripts: { 'exposure:cafe': 'echo hi' } }),
    'utf-8',
  );

  const { context, spy } = createStubContext(['NID_AUT', 'NID_SES'], async () => CONFIRM.exposureRunNo);
  context.getEndpoints = () => ({
    dabutBaseUrl: '',
    schedulerBaseUrl: '',
    exposureBotDir: dir,
    exposureDashboardUrl: '',
    viroBaseUrl: '',
  });

  const output = await findTool(createNaverTools(context), 'run_exposure_check').run({ job: 'cafe' });

  assert.equal(spy.askUserCalls.length, 1);
  assert.equal(output, RESULT.exposureRunNotApproved(CONFIRM.exposureRunNo));
});
