/**
 * 연동 서비스 카탈로그.
 * 에이전트가 "노출지기 열어줘" 같은 말을 알아들으려면 주소를 미리 알고 있어야 한다.
 *
 * 공개 저장소라서 주소는 전부 example.com 플레이스홀더로 둔다.
 * 자기 배포 주소는 코드가 아니라 패널 설정에서 넣는다. settings.json 의 serviceUrls 로 저장되고
 * 부팅할 때 applyServiceUrls 가 이 카탈로그를 덮는다. 저장소에는 남지 않는다.
 *
 * 다붓 백엔드와 스케줄러는 여기가 아니라 hub.ts 의 DEFAULT_ENDPOINTS 를 쓰고,
 * 그 값도 같은 settings.json 에 저장된다.
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
    url: 'https://exposure.example.com',
    kind: 'ui',
    auth: 'cookie',
    description: '네이버 검색 노출체크 대시보드. 키워드 시트 관리와 실행 결과를 본다.',
  },
  {
    key: 'dabut-app',
    name: '다붓',
    url: 'https://dabut.example.com',
    kind: 'ui',
    auth: 'cookie',
    description: 'AI 원고 생성 웹앱. 프로젝트별 지침과 원고 이력을 본다.',
  },
  {
    key: 'dabut-api',
    name: '다붓 백엔드',
    url: 'https://dabut-api.example.com',
    kind: 'api',
    auth: 'bearer',
    description: '원고 생성 API. generate_manuscript_dabut 이 여기를 부른다.',
  },
  {
    key: 'scheduler-api',
    name: '블로그 스케줄러',
    url: 'https://scheduler.example.com',
    kind: 'api',
    auth: 'bearer',
    description: '예약 발행 서버. auto_schedule_posts 가 여기를 부른다.',
  },
  {
    key: 'sheet-app',
    name: '시트앱',
    url: 'https://sheet.example.com',
    kind: 'ui',
    auth: 'cookie',
    description: '구글시트 연동 관리 화면.',
  },
  {
    key: 'image-generator',
    name: '이미지 생성기',
    url: 'https://image.example.com',
    kind: 'ui',
    auth: 'cookie',
    description: '원고에 넣을 이미지를 만든다.',
  },
  {
    key: 'cafe-bot',
    name: '카페봇',
    url: 'https://cafe-bot.example.com',
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

/** 시스템 프롬프트에 넣을 한 줄 요약들 */
export const catalogSummary = () =>
  SERVICE_CATALOG.map((s) => `- ${s.name} (${s.key}): ${s.url} — ${s.description}`).join('\n');

/**
 * key -> url. 사용자의 실제 배포 주소를 코드가 아니라 설정에서 받는다.
 * 조건 없이 항상 대입한다. 빈 오버라이드로 부르면 전부 코드 기본값으로 되돌아간다.
 */
export const applyServiceUrls = (overrides: Record<string, string>) => {
  SERVICE_CATALOG.forEach((service) => {
    service.url = resolveUrl(service.key, overrides);
  });
};
