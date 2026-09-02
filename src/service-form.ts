import type { ServiceCatalogItemView } from './bridge';
import { SERVICE_LABELS } from './messages';
import { isServiceUrl, normalizeServiceUrl } from './url';

/**
 * 설정 패널의 서비스 주소 칸에서 DOM 을 뺀 부분.
 * 패널 스크립트는 렌더러 IIFE 라 테스트에서 불러올 수 없어서, 판단하는 로직만 여기로 뺀다.
 */

export type ServiceUrlDraft = { key: string; name: string; raw: string };

export type ServiceUrlCollection = {
  /** 저장 IPC 로 보낼 값. 빈 문자열은 '기본값으로 되돌리기' 신호라 그대로 싣는다 */
  next: Record<string, string>;
  /** 입력칸에 되비출 정리된 값 */
  normalized: Record<string, string>;
  /** 스킴이 틀린 칸. 하나라도 있으면 저장하지 않는다 */
  invalid: { key: string; name: string }[];
};

export const collectServiceUrls = (drafts: ServiceUrlDraft[]): ServiceUrlCollection => {
  const next: Record<string, string> = {};
  const normalized: Record<string, string> = {};
  const invalid: { key: string; name: string }[] = [];

  drafts.forEach(({ key, name, raw }) => {
    const url = normalizeServiceUrl(raw);
    normalized[key] = url;

    if (url && !isServiceUrl(url)) {
      invalid.push({ key, name });
      return;
    }

    next[key] = url;
  });

  return { next, normalized, invalid };
};

/** 주소를 안 넣은 서비스는 빼둔다. 칩을 눌렀는데 example.com 이 열리면 그건 버그로 보인다. */
export const cookieLoginServices = (catalog: ServiceCatalogItemView[]) =>
  catalog.filter(({ auth, kind, custom }) => auth === 'cookie' && kind === 'ui' && custom);

export type ConnectionState = { key: string; label: string; ok: boolean };

/**
 * 컴포저 칩이 세는 대상.
 * 카탈로그 서비스 + 노출지기 저장소 경로. 이 둘만 사용자가 안 넣으면 비어 있는 값이다.
 * 다붓·스케줄러 주소는 항상 기본값이 있어서 세어봐야 늘 켜져 있고 알려주는 게 없다.
 */
export const connectionStates = (
  services: ServiceCatalogItemView[],
  exposureBotDir: string,
): ConnectionState[] => [
  ...services.map(({ key, name, custom }) => ({ key, label: name, ok: custom })),
  { key: 'exposure-bot-dir', label: SERVICE_LABELS.exposure, ok: Boolean(exposureBotDir.trim()) },
];
