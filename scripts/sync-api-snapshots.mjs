/**
 * docs/api/_snapshots/*.routes.json 갱신. `npm run api:sync`
 *
 * 문서가 실제 서버와 어긋나는 것을 막는 유일한 사람 손이다.
 * 테스트는 여기서 만든 json 만 읽으므로 항상 오프라인이고 결정적이다.
 * 드리프트는 오직 이 스크립트의 diff 로만 들어오고, 그건 리뷰 대상이다.
 *
 * 두 저장소가 이 컴퓨터에 없으면 크게 실패한다. 조용히 넘어가면 낡은 스냅샷이
 * "확인했다" 는 얼굴로 남는다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'docs', 'api', '_snapshots');

const DABUT_OPENAPI = 'https://blog-analyzer.fly.dev/openapi.json';
const EXPOSURE_REPO = '/Users/ganggyunggyu/Programing/blog-cron-bot';
const SCHEDULER_REPO = '/Users/ganggyunggyu/Programing/21lab/blog-bot/scheduler-server';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const sortRoutes = (routes) =>
  Object.fromEntries(
    Object.entries(routes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, methods]) => [path, [...new Set(methods)].sort()]),
  );

const writeSnapshot = (name, routes, source) => {
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.routes.json`);
  const payload = {
    source,
    generatedAt: new Date().toISOString(),
    routes: sortRoutes(routes),
  };

  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`[api-sync] ${name}: ${Object.keys(payload.routes).length}개 경로`);
};

/** 다붓은 FastAPI 라 openapi.json 이 그대로 있다. 인증도 필요 없다. */
const syncDabut = async () => {
  const response = await fetch(DABUT_OPENAPI);
  if (!response.ok) throw new Error(`[api-sync] 다붓 openapi.json 실패: HTTP ${response.status}`);

  const { paths } = await response.json();
  if (!paths) throw new Error('[api-sync] 다붓 openapi.json 에 paths 가 없다');

  const routes = Object.fromEntries(
    Object.entries(paths).map(([path, operations]) => [
      path,
      Object.keys(operations)
        .map((method) => method.toUpperCase())
        .filter((method) => METHODS.includes(method)),
    ]),
  );

  writeSnapshot('dabut', routes, DABUT_OPENAPI);
};

const walk = (dir, matches) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full, matches);

    return matches(full) ? [full] : [];
  });

/**
 * 노출지기는 Next.js App Router 다. route.ts 의 export 된 HTTP 동사가 곧 라우트이고
 * 파일 경로가 곧 URL 이다. [id] 는 openapi 표기에 맞춰 {id} 로 바꾼다.
 */
const syncExposure = () => {
  const apiDir = join(EXPOSURE_REPO, 'dashboard', 'src', 'app', 'api');
  if (!existsSync(apiDir)) throw new Error(`[api-sync] 노출지기 저장소가 없다: ${apiDir}`);

  const routes = {};

  walk(apiDir, (file) => file.endsWith(`${'route'}.ts`)).forEach((file) => {
    const source = readFileSync(file, 'utf-8');
    const methods = METHODS.filter((method) =>
      new RegExp(`export const ${method}\\b`).test(source),
    );
    if (methods.length === 0) return;

    const path = `/api/${relative(apiDir, dirname(file))}`
      .replace(/\\/g, '/')
      .replace(/\/$/, '')
      .replace(/\[(\.\.\.)?(\w+)\]/g, '{$2}');

    routes[path === '/api/.' ? '/api' : path] = methods;
  });

  writeSnapshot('exposure', routes, relative(root, apiDir));
};

/**
 * 스케줄러는 fastify 다. openapi 문서가 없다(/openapi.json, /api-docs 둘 다 401).
 * 라우트 등록 호출을 그대로 긁는다.
 */
const syncScheduler = () => {
  const routesDir = join(SCHEDULER_REPO, 'src', 'routes');
  if (!existsSync(routesDir)) throw new Error(`[api-sync] 스케줄러 저장소가 없다: ${routesDir}`);

  const routes = {};

  walk(routesDir, (file) => file.endsWith('.ts') && !file.endsWith('.test.ts')).forEach((file) => {
    const source = readFileSync(file, 'utf-8');

    [...source.matchAll(/app\.(get|post|put|delete|patch)\(\s*'([^']+)'/g)].forEach(
      ([, method, path]) => {
        const normalized = path.replace(/:(\w+)/g, '{$1}');
        routes[normalized] = [...(routes[normalized] ?? []), method.toUpperCase()];
      },
    );
  });

  writeSnapshot('scheduler', routes, relative(root, routesDir));
};

await syncDabut();
syncExposure();
syncScheduler();
console.log('[api-sync] 스냅샷 갱신 완료');
