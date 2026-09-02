import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { AxiosInstance } from 'axios';
import type { AccountStore } from './accounts';
import type { QuestionField } from './bridge';
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
import { TOOL_RESULTS as RESULT } from './prompts';
import { applyServiceUrls } from './services';
import type { TabManager } from './tabs';
import type { ScheduleJobDetail, ScheduleSummary } from './hub';
import { formatToolOutput } from './tool-output';
import {
  buildAgentSystemPrompt,
  buildAutoScheduleInput,
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

const createStubContext = (
  cookieNames: string[] = ['NID_AUT', 'NID_SES'],
  answer: () => Promise<string> = async () => CONFIRM.deleteYes,
  formAnswer: () => Promise<string> = async () => '{}',
  schedulerToken: string | undefined = undefined,
) => {
  const spy = {
    askUserCalls: [] as string[],
    createTabCalls: 0,
    formCalls: [] as { question: string; fields: QuestionField[] }[],
  };

  const findAccount = (id: string) => (id === STUB_ACCOUNT.id ? STUB_ACCOUNT : undefined);

  const createTab = () => {
    spy.createTabCalls += 1;
    return 1;
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
    accountStore: { list: () => [STUB_ACCOUNT], find: findAccount } as unknown as AccountStore,
    tabManager: { createTab } as unknown as TabManager,
    cdpPort: 0,
    client: {} as AxiosInstance,
    writerModel: 'test/writer',
    getEndpoints: () => ({ dabutBaseUrl: '', schedulerBaseUrl: '', exposureBotDir: '' }),
    getSchedulerToken: () => schedulerToken,
    getCookieNames: async () => cookieNames,
    onProgress: () => undefined,
    askUser,
    askUserForm,
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
  const built = buildAutoScheduleInput(
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
  const built = buildAutoScheduleInput(
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
  const built = buildAutoScheduleInput(
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
  const built = buildAutoScheduleInput(
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
  const guessed = buildAutoScheduleInput({ ...base, projectId: 'proj-9' }, NO_PROJECTS);
  assert.equal(guessed.ok === false ? guessed.result : '', RESULT.projectNotListed);

  // 목록은 받았지만 다른 id 를 실은 경우. 틀린 프로젝트는 몇 시간 뒤 생성 시점에나 드러난다.
  const wrong = buildAutoScheduleInput({ ...base, projectId: 'proj-9' }, new Set(['proj-1']));
  assert.equal(wrong.ok === false ? wrong.result : '', RESULT.projectNotFound('proj-9'));
});

test('날짜 형식이 어긋나면 스케줄러 500 을 맞기 전에 막는다', () => {
  const base = { accountId: 'acc', keywords: ['가'] };

  // 스케줄러의 schedule_date 에는 regex 가 없다. 한 자리 월/일은 Invalid Date 로 500 이 된다.
  const loose = buildAutoScheduleInput({ ...base, scheduleDate: '2026-9-2' }, NO_PROJECTS);
  assert.equal(loose.ok === false ? loose.result : '', RESULT.scheduleDateFormat('2026-9-2'));

  const impossible = buildAutoScheduleInput({ ...base, scheduleDate: '2026-02-31' }, NO_PROJECTS);
  assert.equal(impossible.ok === false ? impossible.result : '', RESULT.scheduleDateFormat('2026-02-31'));

  assert.equal(buildAutoScheduleInput({ ...base, scheduleDate: '2026-09-10' }, NO_PROJECTS).ok, true);
});

test('스케줄러가 모르는 스타일과 이미지 출처는 부르기 전에 막는다', () => {
  const base = { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] };

  const badType = buildAutoScheduleInput({ ...base, manuscriptType: '맛집v3' }, NO_PROJECTS);
  assert.equal(badType.ok, false);
  assert.equal(badType.ok === false ? badType.result : '', RESULT.unknownManuscriptType('맛집v3'));

  const badSource = buildAutoScheduleInput({ ...base, imageSource: 'unsplash' }, NO_PROJECTS);
  assert.equal(badSource.ok, false);
  assert.equal(badSource.ok === false ? badSource.result : '', RESULT.unknownImageSource('unsplash'));

  MANUSCRIPT_TYPES.forEach((manuscriptType) =>
    assert.equal(buildAutoScheduleInput({ ...base, manuscriptType }, NO_PROJECTS).ok, true),
  );
  IMAGE_SOURCES.forEach((imageSource) =>
    assert.equal(buildAutoScheduleInput({ ...base, imageSource }, NO_PROJECTS).ok, true),
  );
});

test('스케줄러 범위 밖의 숫자는 400 을 맞기 전에 막는다', () => {
  const base = { scheduleDate: '2026-09-10', accountId: 'acc', keywords: ['가'] };
  const { intervalMinutesMin, intervalMinutesMax, postsPerDayMax, startHourMax } = SCHEDULE_LIMITS;

  assert.equal(buildAutoScheduleInput({ ...base, intervalMinutes: 5 }, NO_PROJECTS).ok, false);
  assert.equal(buildAutoScheduleInput({ ...base, postsPerDay: postsPerDayMax + 1 }, NO_PROJECTS).ok, false);
  assert.equal(buildAutoScheduleInput({ ...base, startHour: startHourMax + 1 }, NO_PROJECTS).ok, false);
  assert.equal(buildAutoScheduleInput({ ...base, intervalMinutes: intervalMinutesMin }, NO_PROJECTS).ok, true);
  assert.equal(buildAutoScheduleInput({ ...base, intervalMinutes: intervalMinutesMax }, NO_PROJECTS).ok, true);
});

test('빈 키워드와 빈 계정은 네트워크를 타기 전에 걸린다', () => {
  const empty = buildAutoScheduleInput({ scheduleDate: '2026-09-10', accountId: 'acc', keywords: [] }, NO_PROJECTS);
  assert.equal(empty.ok === false ? empty.result : '', RESULT.emptyKeywords);

  const noAccount = buildAutoScheduleInput({ scheduleDate: '2026-09-10', accountId: ' ', keywords: ['가'] }, NO_PROJECTS);
  assert.equal(noAccount.ok === false ? noAccount.result : '', RESULT.schedulerAccountRequired);

  const noDate = buildAutoScheduleInput({ scheduleDate: '', accountId: 'acc', keywords: ['가'] }, NO_PROJECTS);
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

test('시스템 프롬프트가 폼과 프로젝트 규칙을 싣는다', () => {
  const prompt = buildAgentSystemPrompt();

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
    scheduleDate: '2026-09-10',
    accountId: 'acc',
    keywords: ['가'],
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
    scheduleDate: '2026-09-10',
    accountId: 'acc',
    keywords: ['가'],
    projectId: '68f1a2b3',
  });

  assert.equal(output, RESULT.projectNotListed);
});

test('다붓 로그인 없이는 예약을 걸지 않는다', async () => {
  const { context } = createStubContext();
  const output = await findTool(createNaverTools(context), 'auto_schedule_posts').run({
    scheduleDate: '2026-09-10',
    accountId: 'acc',
    keywords: ['가'],
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
  const prompt = buildAgentSystemPrompt();

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
      getEndpoints: () => ({ dabutBaseUrl: baseUrl, schedulerBaseUrl: baseUrl, exposureBotDir: '' }),
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
