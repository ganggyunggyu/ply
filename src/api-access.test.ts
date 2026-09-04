import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  API_GET_MAX_CHARS,
  API_READ_ALLOWLIST,
  API_SERVICES,
  clampApiBody,
  isAllowedApiPath,
  isApiService,
  isWellFormedApiPath,
  normalizeApiQuery,
  REDACTED,
  redactSecrets,
} from './api-access';

test('서비스 이름은 네 개뿐이다', () => {
  assert.deepEqual([...API_SERVICES], ['dabut', 'scheduler', 'exposure', 'viro']);
  assert.equal(isApiService('dabut'), true);
  assert.equal(isApiService('openrouter'), false);
  assert.equal(isApiService(null), false);
});

test('경로에 쿼리를 붙일 수 없다', () => {
  // 붙이게 두면 인코딩이 갈리고 그 자리에 개인정보가 실려 로그에 남는다.
  assert.equal(isWellFormedApiPath('/schedules?accountId=me'), false);
  assert.equal(isWellFormedApiPath('/schedules#frag'), false);
  assert.equal(isWellFormedApiPath('/sche dules'), false);
});

test('상대 경로 탈출을 막는다', () => {
  assert.equal(isWellFormedApiPath('/../etc/passwd'), false);
  assert.equal(isWellFormedApiPath('/projects/../../admin'), false);
  assert.equal(isAllowedApiPath('dabut', '/projects/..'), false);
});

test('슬래시로 시작하지 않거나 너무 길면 거부한다', () => {
  assert.equal(isWellFormedApiPath('projects'), false);
  assert.equal(isWellFormedApiPath('https://evil.example/x'), false);
  assert.equal(isWellFormedApiPath(`/${'a'.repeat(300)}`), false);
});

test('허용목록에 있는 경로만 통과한다', () => {
  assert.equal(isAllowedApiPath('dabut', '/naver-accounts'), true);
  assert.equal(isAllowedApiPath('dabut', '/naver-accounts/abc123'), true);
  assert.equal(isAllowedApiPath('scheduler', '/schedules'), true);
  assert.equal(isAllowedApiPath('scheduler', '/schedules/sch_1'), true);
  assert.equal(isAllowedApiPath('scheduler', '/api/blog-accounts/xyz/credential-check'), true);
  assert.equal(isAllowedApiPath('exposure', '/api/preset'), true);
});

test('한 칸짜리 자리에 여러 칸을 넣을 수 없다', () => {
  assert.equal(isAllowedApiPath('dabut', '/naver-accounts/a/b'), false);
  assert.equal(isAllowedApiPath('scheduler', '/schedules/a/execute'), false);
});

test('서비스가 다르면 같은 경로도 막는다', () => {
  assert.equal(isAllowedApiPath('exposure', '/schedules'), false);
  assert.equal(isAllowedApiPath('dabut', '/api/preset'), false);
});

test('일부러 뺀 GET 은 통과하지 않는다', () => {
  // 파일 바이트를 대화에 부을 이유가 없다. SSE 는 응답이 끝나지 않는다.
  assert.equal(isAllowedApiPath('exposure', '/api/outputs/download'), false);
  assert.equal(isAllowedApiPath('exposure', '/api/runs/r1/stream'), false);
  assert.equal(isAllowedApiPath('dabut', '/generate/image-batch/j1/download'), false);
});

test('쓰기 경로는 목록에 아예 없다', () => {
  // 이 도구는 GET 만 보내지만, 쓰기 경로를 목록에 넣어 두면 다음 사람이 오해한다.
  assert.equal(isAllowedApiPath('exposure', '/api/jobs/cafe-check:c1/run'), false);
  assert.equal(isAllowedApiPath('scheduler', '/bot/auto-schedule'), false);
  assert.equal(isAllowedApiPath('dabut', '/generate/project'), false);
  assert.equal(isAllowedApiPath('exposure', '/api/auth/login'), false);
});

test('모든 정규식이 전체 일치로 묶여 있다', () => {
  // 앞뒤가 안 묶이면 /schedules 패턴이 /evil/schedules/x 까지 통과시킨다.
  API_SERVICES.forEach((service) => {
    API_READ_ALLOWLIST[service].forEach((pattern) => {
      assert.equal(pattern.source.startsWith('^'), true, pattern.source);
      assert.equal(pattern.source.endsWith('$'), true, pattern.source);
    });
  });
});

test('쿼리는 문자열 값만 남긴다', () => {
  assert.deepEqual(normalizeApiQuery({ status: 'pending', limit: 10, ok: true }), {
    status: 'pending',
    limit: '10',
    ok: 'true',
  });
  assert.deepEqual(normalizeApiQuery({ nested: { a: 1 }, list: [1], empty: null }), {});
  assert.deepEqual(normalizeApiQuery('nope'), {});
  assert.deepEqual(normalizeApiQuery(undefined), {});
});

test('긴 응답은 자르고 잘렸다고 표시한다', () => {
  assert.deepEqual(clampApiBody('short'), { text: 'short', truncated: false });

  const long = 'x'.repeat(API_GET_MAX_CHARS + 10);
  const clamped = clampApiBody(long);

  assert.equal(clamped.truncated, true);
  assert.equal(clamped.text.length, API_GET_MAX_CHARS);
});


test('퍼센트 인코딩으로 허용목록을 넘지 못한다', () => {
  // %2f 를 풀면 세 칸이 되는 경로다. 안 풀면 /ref/<한 칸> 으로 보여 그대로 통과한다.
  assert.equal(isWellFormedApiPath('/ref/%2e%2e%2f%2e%2e%2fadmin'), false);
  assert.equal(isAllowedApiPath('dabut', '/ref/%2e%2e%2f%2e%2e%2fadmin'), false);
  assert.equal(isAllowedApiPath('dabut', '/ref/%2E%2E%2Fadmin'), false);

  // 인코딩된 물음표와 우물정도 막는다. 쿼리는 별도 인자로만 받는다.
  assert.equal(isWellFormedApiPath('/ref/a%3Fb'), false);
  assert.equal(isWellFormedApiPath('/ref/a%23b'), false);

  // 못 읽는 % 시퀀스는 서버에도 보내지 않는다.
  assert.equal(isWellFormedApiPath('/ref/%zz'), false);

  // 한글 키워드처럼 정상적인 인코딩은 그대로 통과한다.
  assert.equal(isAllowedApiPath('dabut', '/ref/%EA%B0%95%EC%95%84%EC%A7%80'), true);
});

test('응답의 비밀 키는 값을 지우고 준다', () => {
  const redacted = redactSecrets({
    id: 'p1',
    doorayWebhookUrl: 'https://hook.dooray.com/services/1/2/secret',
    nested: { apiKey: 'sk-live', label: '보임' },
    rows: [{ password: 'hunter2', loginId: 'me' }],
  }) as Record<string, unknown>;

  assert.equal(redacted.id, 'p1');
  assert.equal(redacted.doorayWebhookUrl, REDACTED);
  assert.equal((redacted.nested as Record<string, unknown>).apiKey, REDACTED);
  assert.equal((redacted.nested as Record<string, unknown>).label, '보임');
  assert.equal((redacted.rows as Record<string, unknown>[])[0]?.password, REDACTED);
  assert.equal((redacted.rows as Record<string, unknown>[])[0]?.loginId, 'me');

  // 값이 원문 어디에도 남으면 안 된다.
  assert.equal(JSON.stringify(redacted).includes('hook.dooray.com'), false);
  assert.equal(JSON.stringify(redacted).includes('hunter2'), false);
});

test('키 이름 변형도 같이 가린다', () => {
  const redacted = redactSecrets({
    api_key: 'a',
    'x-api-key': 'b',
    accessToken: 'c',
    refreshToken: 'd',
    sessionCookie: 'e',
    credentials: 'f',
    plain: 'g',
  }) as Record<string, string>;

  Object.entries(redacted).forEach(([key, value]) => {
    assert.equal(value, key === 'plain' ? 'g' : REDACTED);
  });
});

test('너무 깊은 값은 통과시키지 않고 가린다', () => {
  // 못 본 곳을 통과시키면 깊이로 감싸는 것만으로 우회가 된다.
  let deep: unknown = { password: 'leak' };
  for (let i = 0; i < 20; i += 1) deep = { next: deep };

  assert.equal(JSON.stringify(redactSecrets(deep)).includes('leak'), false);
});


test('불리언 깃발은 가리지 않는다', () => {
  // 다붓의 has_password 는 "저장돼 있느냐" 만 말한다. accounts 문서가 이걸 읽으라고 시킨다.
  const redacted = redactSecrets({ has_password: true, password: 'hunter2' }) as Record<
    string,
    unknown
  >;

  assert.equal(redacted.has_password, true);
  assert.equal(redacted.password, REDACTED);
});

test('바이로 잡 조회 경로는 허용한다', () => {
  assert.equal(isAllowedApiPath('viro', '/api/agent/jobs'), true);
  assert.equal(isAllowedApiPath('viro', '/api/agent/jobs/68b1f0c2a1'), true);
  assert.equal(isAllowedApiPath('viro', '/api/agent/cafes'), true);
  assert.equal(isAllowedApiPath('viro', '/api/agent/worker'), true);
});

test('바이로 쓰기 경로는 api_get 으로 못 부른다', () => {
  // 취소와 스캔은 되돌릴 수 없거나 큐를 늘린다. 읽기 도구가 열어줄 자리가 아니다.
  assert.equal(isAllowedApiPath('viro', '/api/agent/jobs/68b1f0c2a1/cancel'), false);
  assert.equal(isAllowedApiPath('viro', '/api/agent/scan/low-comment'), false);
  assert.equal(isAllowedApiPath('viro', '/api/agent/prepare'), false);
  assert.equal(isAllowedApiPath('viro', '/api/agent/captcha'), false);
});

test('서비스별 허용목록은 서로 새지 않는다', () => {
  assert.equal(isAllowedApiPath('scheduler', '/api/agent/jobs'), false);
  assert.equal(isAllowedApiPath('viro', '/schedules'), false);
  assert.equal(isAllowedApiPath('dabut', '/api/agent/cafes'), false);
});
