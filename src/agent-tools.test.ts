import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AxiosInstance } from 'axios';
import type { AccountStore } from './accounts';
import { CONFIRM, ERRORS } from './messages';
import type { ToolSpec } from './openrouter';
import { TOOL_RESULTS as RESULT } from './prompts';
import { applyServiceUrls } from './services';
import type { TabManager } from './tabs';
import {
  buildAgentSystemPrompt,
  clampListLimit,
  createNaverTools,
  describeToolError,
  hasNaverSession,
  isDeleteApproved,
  MAX_DELETE_PER_CALL,
  MAX_DELETE_PER_RUN,
  planDeletion,
  requestDeleteApproval,
  resolveDeleteTargets,
  splitManuscript,
  toKnownPosts,
  type KnownPost,
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

const createStubContext = (
  cookieNames: string[] = ['NID_AUT', 'NID_SES'],
  answer: () => Promise<string> = async () => CONFIRM.deleteYes,
) => {
  const spy = { askUserCalls: [] as string[], createTabCalls: 0 };

  const findAccount = (id: string) => (id === STUB_ACCOUNT.id ? STUB_ACCOUNT : undefined);

  const createTab = () => {
    spy.createTabCalls += 1;
    return 1;
  };

  const askUser = async (question: string) => {
    spy.askUserCalls.push(question);
    return answer();
  };

  const context: ToolContext = {
    accountStore: { list: () => [STUB_ACCOUNT], find: findAccount } as unknown as AccountStore,
    tabManager: { createTab } as unknown as TabManager,
    cdpPort: 0,
    client: {} as AxiosInstance,
    writerModel: 'test/writer',
    getEndpoints: () => ({ dabutBaseUrl: '', schedulerBaseUrl: '', exposureBotDir: '' }),
    getSchedulerToken: () => undefined,
    getCookieNames: async () => cookieNames,
    onProgress: () => undefined,
    askUser,
    requestDabutLogin: async () => '',
  };

  return { context, spy };
};

const findTool = (tools: ToolSpec[], name: string) => {
  const tool = tools.find((item) => item.name === name);
  assert.ok(tool, name);

  return tool;
};

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

test('주소를 안 넣은 서비스는 열지 않고 설정으로 보낸다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({});

  const { context, spy } = createStubContext();
  const output = await findTool(createNaverTools(context), 'open_service').run({ service: '노출지기' });

  assert.equal(output, RESULT.serviceNotConfigured('노출지기'));
  assert.equal(spy.createTabCalls, 0);
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

test('list_services 는 미설정이면 목록 대신 안내를 준다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({});

  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'list_services').run({});

  assert.equal(output, RESULT.noServicesConfigured);
  assert.equal(output.includes('example.com'), false);
});

test('list_services 는 주소를 넣은 것만 준다', async (t) => {
  t.after(() => applyServiceUrls({}));
  applyServiceUrls({ 'cafe-bot': 'https://cafe.internal' });

  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'list_services').run({});
  const rows = JSON.parse(output) as { key: string; url: string }[];

  assert.deepEqual(rows.map(({ key }) => key), ['cafe-bot']);
  assert.equal(rows[0]?.url, 'https://cafe.internal');
});

test('시스템 프롬프트는 미설정 주소를 싣지 않는다', async (t) => {
  t.after(() => applyServiceUrls({}));

  applyServiceUrls({});
  assert.equal(buildAgentSystemPrompt().includes('example.com'), false);

  applyServiceUrls({ 'cafe-bot': 'https://cafe.internal' });
  const prompt = buildAgentSystemPrompt();

  assert.ok(prompt.includes('https://cafe.internal'));
  assert.equal(prompt.includes('example.com'), false);
});
