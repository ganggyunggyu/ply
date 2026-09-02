/**
 * 에이전트가 탭으로 여는 화면 카탈로그.
 * "노출지기 열어줘" 를 알아들으려면 주소를 미리 알고 있어야 한다.
 *
 * 배포된 주소가 기본값이다. 설치만 하면 어느 컴퓨터에서든 바로 돌아야 하므로
 * 비워 두지 않는다. 다른 서버를 쓰려면 패널 설정에서 덮어쓰고,
 * 덮어쓴 값은 settings.json 의 serviceUrls 에만 남는다.
 * 부팅할 때 applyServiceUrls 가 그 값으로 이 카탈로그를 덮는다.
 *
 * 주소가 빈 항목은 '미설정' 이라 프롬프트와 도구에서 통째로 빠진다.
 * 기본값이 채워져 있으므로 사용자가 일부러 지우지 않는 한 그럴 일은 없다.
 *
 * 도구가 직접 호출하는 API 서버(다붓 백엔드, 블로그 스케줄러)는 여기 없다.
 * 그쪽 주인은 hub.ts 의 ServiceEndpoints 하나뿐이다. 같은 주소를 두 군데 두지 않는다.
 */

export type ServiceAuth =
  /** 로그인이 필요 없다 */
  | 'none'
  /** 다붓 계정으로 토큰을 받아 Authorization 헤더에 싣는다 */
  | 'bearer'
  /** 브라우저 쿠키 세션. 탭으로 열어 한 번 로그인하면 프로필에 남는다 */
  | 'cookie';

export type ServiceEntry = {
  key: string;
  name: string;
  url: string;
  kind: 'ui' | 'api';
  auth: ServiceAuth;
  description: string;
};

export const SERVICE_CATALOG: ServiceEntry[] = [
  {
    key: 'exposure-dashboard',
    name: '노출지기',
    url: 'https://blog-cron-bot-production.up.railway.app',
    kind: 'ui',
    auth: 'cookie',
    description: '네이버 검색 노출체크 대시보드. 키워드 시트 관리와 실행 결과를 본다.',
  },
  {
    key: 'dabut-app',
    name: '다붓',
    url: 'https://21lab-ai-agent.vercel.app',
    kind: 'ui',
    auth: 'cookie',
    description: 'AI 원고 생성 웹앱. 프로젝트별 지침과 원고 이력을 본다.',
  },
  {
    key: 'sheet-app',
    name: '시트앱',
    url: 'https://21lab-sheet-app.vercel.app',
    kind: 'ui',
    auth: 'cookie',
    description: '구글시트 연동 관리 화면.',
  },
  {
    key: 'image-generator',
    name: '이미지 생성기',
    url: 'https://image-generator-weld-two.vercel.app',
    kind: 'ui',
    auth: 'cookie',
    description: '원고에 넣을 이미지를 만든다.',
  },
  {
    key: 'cafe-bot',
    name: '카페봇',
    url: 'https://cafe-bot-two.vercel.app',
    kind: 'ui',
    auth: 'cookie',
    description: '네이버 카페 글·댓글 자동화 대시보드.',
  },
];

/** 모듈이 처음 로드된 시점의 코드 기본값. applyServiceUrls 가 되돌릴 기준점이다. */
const DEFAULT_SERVICE_URLS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(SERVICE_CATALOG.map(({ key, url }) => [key, url])),
);

export const SERVICE_KEYS: readonly string[] = SERVICE_CATALOG.map(({ key }) => key);

/**
 * 사용자가 실제로 주소를 넣은 key. applyServiceUrls 가 갱신한다.
 * 한 번도 안 불렀으면 비어 있다 = 전부 미설정. 안전한 쪽으로 틀린다.
 */
const configuredKeys = new Set<string>();

/** 사용자가 설정에서 채운 주소가 붙은 카탈로그 항목. 패널이 이 모양으로 받는다. */
export type ResolvedService = ServiceEntry & {
  /** services.ts 의 코드 기본값. 입력칸 placeholder 로 쓴다 */
  defaultUrl: string;
  /** 사용자가 덮어썼는가 */
  custom: boolean;
};

/** 손으로 고친 설정 파일에 문자열이 아닌 값이 들어와도 죽지 않게 한다. */
const overrideOf = (key: string, overrides: Record<string, string>) => {
  const value = overrides[key];
  return typeof value === 'string' ? value.trim() : '';
};

const resolveUrl = (key: string, overrides: Record<string, string>) =>
  overrideOf(key, overrides) || DEFAULT_SERVICE_URLS[key] || '';

/** 순수 함수. 카탈로그를 건드리지 않고 해석된 사본을 만든다. */
export const resolveServices = (overrides: Record<string, string>): ResolvedService[] =>
  SERVICE_CATALOG.map((service) => {
    const defaultUrl = DEFAULT_SERVICE_URLS[service.key] ?? '';
    const override = overrideOf(service.key, overrides);

    return { ...service, url: override || defaultUrl, defaultUrl, custom: Boolean(override) };
  });

export const findService = (query: string): ServiceEntry | null => {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;

  return (
    SERVICE_CATALOG.find((s) => s.key === needle) ??
    SERVICE_CATALOG.find((s) => s.name.toLowerCase() === needle) ??
    SERVICE_CATALOG.find((s) => s.name.toLowerCase().includes(needle) || needle.includes(s.name.toLowerCase())) ??
    null
  );
};

/** 사용자가 주소를 넣었는가. 안 넣었으면 그 서비스는 열 수 없다. */
export const isServiceConfigured = (key: string) => configuredKeys.has(key);

/** 주소가 실제로 들어있는 항목만. 프롬프트와 도구는 이것만 본다. */
export const configuredServices = (): ServiceEntry[] =>
  SERVICE_CATALOG.filter(({ key }) => configuredKeys.has(key));

/** 시스템 프롬프트에 넣을 한 줄 요약들. 미설정이면 빈 문자열이다. */
export const catalogSummary = () =>
  configuredServices()
    .map((s) => `- ${s.name} (${s.key}): ${s.url} — ${s.description}`)
    .join('\n');

/**
 * key -> url. 사용자의 실제 배포 주소를 코드가 아니라 설정에서 받는다.
 * 조건 없이 항상 대입한다. 빈 오버라이드로 부르면 전부 코드 기본값으로 되돌아가고
 * 설정된 항목도 전부 사라진다.
 */
export const applyServiceUrls = (overrides: Record<string, string>) => {
  configuredKeys.clear();

  SERVICE_CATALOG.forEach((service) => {
    if (overrideOf(service.key, overrides)) configuredKeys.add(service.key);
    service.url = resolveUrl(service.key, overrides);
  });
};
