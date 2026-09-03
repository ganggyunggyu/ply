/**
 * 문서가 실제 API 와 어긋나는 것을 막는 층.
 *
 * 완전히는 못 막는다. 대신 실행 가능한 주장을 전부 기계가 검사하게 만들고, 스냅샷 갱신을
 * 눈에 보이는 diff 한 번(`npm run api:sync`)으로 만든다.
 *
 * 이 파일은 네트워크를 타지 않는다. 커밋된 스냅샷 json 만 읽으므로 항상 오프라인이고 결정적이다.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { API_DOCS, API_DOC_TOPICS, apiDocIndex, apiDocSections, readApiDoc } from './api-docs';
import { API_READ_ALLOWLIST, isAllowedApiPath, isApiService, type ApiService } from './api-access';
import { buildAgentSystemPrompt } from './prompts';
import { createNaverTools, type ToolContext } from './agent-tools';
import { DEFAULT_ENDPOINTS } from './hub';
import { MANUSCRIPT_TYPES } from './scheduler-enums';
import { PRESET_ACTIONS } from './exposure-preset';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const docsDir = join(root, 'docs', 'api');
const snapshotDir = join(docsDir, '_snapshots');

type Snapshot = { source: string; generatedAt: string; routes: Record<string, string[]> };

const snapshot = (service: string): Snapshot =>
  JSON.parse(readFileSync(join(snapshotDir, `${service}.routes.json`), 'utf-8')) as Snapshot;

/** frontmatter 의 `<service> <METHOD> <path>` 한 줄을 쪼갠다. */
const parseRoute = (line: string) => {
  const [service, method, ...rest] = line.split(/\s+/);

  return { service: service ?? '', method: method ?? '', path: rest.join(' ') };
};

/** `{id}` 자리를 실제 값 하나로 채운다. 허용목록 정규식과 맞춰 보기 위한 것이다. */
const concretePath = (path: string) => path.replace(/\{[^}]+\}/g, 'sample');

const declaredRoutes = () =>
  API_DOC_TOPICS.flatMap((topic) =>
    API_DOCS[topic].routes.map((line) => ({ topic, line, ...parseRoute(line) })),
  );

// ---------- 층 1: 자리표시자가 코드의 실제 값으로 채워졌는가 ----------

test('문서에 채우지 못한 자리표시자가 남아 있지 않다', () => {
  API_DOC_TOPICS.forEach((topic) => {
    assert.equal(/\{\{\w+\}\}/.test(API_DOCS[topic].body), false, topic);
  });
});

test('베이스 주소는 코드 값과 글자 그대로 같다', () => {
  // 여기가 어긋나면 모델이 문서의 주소를 진짜로 믿고 다른 서버를 부른다.
  assert.equal(API_DOCS.manuscripts.body.includes(DEFAULT_ENDPOINTS.dabutBaseUrl), true);
  assert.equal(API_DOCS.schedules.body.includes(DEFAULT_ENDPOINTS.schedulerBaseUrl), true);
  assert.equal(API_DOCS.exposure.body.includes(DEFAULT_ENDPOINTS.exposureDashboardUrl), true);
  assert.equal(API_DOCS.settings.body.includes(DEFAULT_ENDPOINTS.dabutBaseUrl), true);
});

test('enum 목록도 코드에서 온 값이다', () => {
  assert.equal(API_DOCS.schedules.body.includes(MANUSCRIPT_TYPES.join(', ')), true);
});

// ---------- 층 2·3: frontmatter 의 주장을 고정한다 ----------

test('문서가 적은 경로가 스냅샷에 실제로 있다', () => {
  declaredRoutes().forEach(({ topic, line, service, method, path }) => {
    assert.equal(isApiService(service), true, `${topic}: ${line}`);

    const { routes } = snapshot(service);
    const methods = routes[path];

    assert.ok(methods, `${topic}: ${line} — 스냅샷에 ${path} 가 없다`);
    assert.equal(methods.includes(method), true, `${topic}: ${line} — ${path} 에 ${method} 가 없다`);
  });
});

test('문서가 적은 도구가 실제로 등록된 도구다', () => {
  const context = {
    accountStore: { list: () => [] },
    tabManager: {},
    cdpPort: 0,
    client: {},
    writerModel: '',
    getEndpoints: () => DEFAULT_ENDPOINTS,
    getSchedulerToken: () => undefined,
    getCookieNames: async () => [],
    onProgress: () => undefined,
    askUser: async () => '',
    askUserForm: async () => '',
    requestDabutLogin: async () => '',
    requestAccountCard: async () => '',
    requestExposureLogin: async () => '',
    getExposureCookie: () => undefined,
    clearExposureCookie: () => undefined,
  } as unknown as ToolContext;

  const names = new Set(createNaverTools(context).map(({ name }) => name));

  API_DOC_TOPICS.forEach((topic) => {
    API_DOCS[topic].tools.forEach((tool) => {
      assert.equal(names.has(tool), true, `${topic}: ${tool} 이라는 도구가 없다`);
    });
  });
});

test('주제 목록과 md 파일이 정확히 일대일이다', () => {
  const files = readdirSync(docsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))
    .sort();

  assert.deepEqual(files, [...API_DOC_TOPICS].sort());
});

// ---------- 층 4: md 를 고치고 빌드를 잊은 것을 잡는다 ----------

test('생성물이 지금 md 로 다시 만든 것과 같다', () => {
  const generated = join(here, 'api-docs.generated.ts');
  const before = readFileSync(generated, 'utf-8');

  execFileSync('node', [join(root, 'scripts', 'build-api-docs.mjs')], { cwd: root });

  assert.equal(
    readFileSync(generated, 'utf-8'),
    before,
    'docs/api/*.md 를 고치고 npm run build 를 안 돌렸다',
  );
});

// ---------- 층 5: 프롬프트 목차와 도구 목차가 같다 ----------

test('시스템 프롬프트의 목차가 주제 목록과 같다', () => {
  const prompt = buildAgentSystemPrompt({ today: '2026-09-03' });

  apiDocIndex().forEach((line) => {
    assert.equal(prompt.includes(line), true, line);
  });

  // limits 로 유도하는 문장이 프롬프트에 실제로 실려야 이 설계가 작동한다.
  assert.equal(prompt.includes('read_api_doc'), true);
  assert.equal(prompt.includes('limits'), true);
});

test('떠넘기기 금지 규칙이 프롬프트에 실려 있다', () => {
  const prompt = buildAgentSystemPrompt({ today: '2026-09-03' });

  assert.equal(prompt.includes('manage_naver_account'), true);
  assert.equal(prompt.includes('exposure_login'), true);
  assert.equal(prompt.includes('update_exposure_preset'), true);
  assert.equal(prompt.includes('제 권한 밖이에요'), true);
});

// ---------- 층 6: 문서와 허용목록이 어긋날 수 없다 ----------

test('문서가 적은 GET 은 전부 읽기 허용목록에 걸린다', () => {
  declaredRoutes()
    .filter(({ method }) => method === 'GET')
    .forEach(({ topic, line, service, path }) => {
      const concrete = concretePath(path);
      const allowed = isAllowedApiPath(service as ApiService, concrete);

      // 일부러 뺀 것은 문서에도 "뺐다" 고 적혀 있어야 한다. 그 사실을 여기서 확인한다.
      if (!allowed) {
        assert.equal(
          API_DOCS[topic].body.includes(path),
          true,
          `${line} — 허용목록에도 없고 문서에 이유도 없다`,
        );
        return;
      }

      assert.equal(allowed, true, `${topic}: ${line}`);
    });
});

test('허용목록의 모든 경로가 실제 서버에 있다', () => {
  // 반대 방향 검사다. 지금까지는 "문서에 적힌 GET 이 허용목록에 있나" 만 봤다.
  // 그러면 서버에서 사라진 경로가 허용목록에 죽은 권한으로 남아도 아무도 모른다.
  // 스냅샷은 npm run api:sync 가 실서버 openapi 와 두 저장소의 라우트에서 만든 것이다.
  (Object.keys(API_READ_ALLOWLIST) as ApiService[]).forEach((service) => {
    const live = Object.entries(snapshot(service).routes)
      .filter(([, methods]) => methods.includes('GET'))
      .map(([path]) => concretePath(path));

    API_READ_ALLOWLIST[service].forEach((pattern) => {
      assert.equal(
        live.some((path) => pattern.test(path)),
        true,
        `${service} 허용목록의 ${pattern} 에 맞는 GET 이 서버에 없다`,
      );
    });
  });
});

test('허용목록의 모든 서비스가 문서에 한 번씩 나온다', () => {
  const documented = new Set(declaredRoutes().map(({ service }) => service));

  Object.keys(API_READ_ALLOWLIST).forEach((service) => {
    assert.equal(documented.has(service), true, `${service} 를 다루는 문서가 없다`);
  });
});

// ---------- 층 6+: 도구가 없는 것을 문서가 있다고 말하지 않는다 ----------

test('프리셋 문서가 실제 action 목록과 같은 것을 말한다', () => {
  // 목록은 자리표시자로 들어가므로 코드에서 action 을 더하면 문서가 자동으로 따라간다.
  assert.equal(API_DOCS.exposure.body.includes(PRESET_ACTIONS.join(', ')), true);

  // 이 문장이 사라지면 다음 사람이 set_target_sheet 도구를 다시 만든다.
  assert.equal(API_DOCS.limits.body.includes('set_target_sheet'), true);
  assert.equal(API_DOCS.exposure.body.includes('set_target_sheet'), true);
});

// ---------- 층 6++: 읽기 인터페이스 ----------

test('topic 을 빼면 목차가 나온다', () => {
  const index = readApiDoc();

  API_DOC_TOPICS.forEach((topic) => assert.equal(index.includes(topic), true));
});

test('없는 주제와 없는 절은 지어내지 않고 목록을 준다', () => {
  const badTopic = readApiDoc('없는주제');
  assert.equal(badTopic.includes('accounts'), true);

  const badSection = readApiDoc('limits', '없는절');
  assert.equal(badSection.includes(apiDocSections('limits')[0] ?? ''), true);
});

test('절 이름은 ## 과 대소문자 차이를 견딘다', () => {
  const [first] = apiDocSections('accounts');
  assert.ok(first);

  assert.equal(readApiDoc('accounts', `## ${first}`).includes(first), true);
});

// ---------- 층 4 보조: 스냅샷이 늙었는지 알린다 ----------

test('스냅샷이 90일보다 오래되면 경고만 찍는다', () => {
  // 실패시키지 않는다. 오프라인에서 테스트가 죽으면 안 된다.
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  ['dabut', 'scheduler', 'exposure'].forEach((service) => {
    const file = join(snapshotDir, `${service}.routes.json`);
    assert.equal(existsSync(file), true, `${service} 스냅샷이 없다. npm run api:sync 를 돌릴 것`);

    const { generatedAt } = snapshot(service);
    const age = Date.now() - Date.parse(generatedAt);

    if (Number.isFinite(age) && age > ninetyDays) {
      console.warn(`[api-docs] ${service} 스냅샷이 90일보다 오래됐다. npm run api:sync 를 돌릴 것`);
    }
  });
});
