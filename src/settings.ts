import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { SecretCrypto } from './accounts';
import { DEFAULT_ENDPOINTS, type ServiceEndpoints } from './hub';
import { DEFAULT_AGENT_MODEL, DEFAULT_WRITER_MODEL } from './models';
import { ERRORS } from './messages';
import { resolveServices, SERVICE_KEYS, type ResolvedService } from './services';
import { isServiceUrl, normalizeServiceUrl } from './url';

/** 카탈로그 key -> 사용자가 넣은 주소. 기본값은 여기 담지 않는다. 기본값 주인은 services.ts 다. */
export type ServiceUrls = Record<string, string>;

export type PublicSettings = {
  hasApiKey: boolean;
  hasSchedulerToken: boolean;
  schedulerLabel: string;
  agentModel: string;
  writerModel: string;
  endpoints: ServiceEndpoints;
  /** 사용자가 덮어쓴 것만. 아무것도 없으면 {} */
  serviceUrls: ServiceUrls;
  /** 해석이 끝난 카탈로그. 렌더러는 이걸 그린다. */
  services: ResolvedService[];
};

type StoredSettings = {
  apiKeyCipher?: string;
  schedulerTokenCipher?: string;
  schedulerLabel?: string;
  agentModel?: string;
  writerModel?: string;
  endpoints?: Partial<ServiceEndpoints>;
  serviceUrls?: ServiceUrls;
};

type SettingsStoreOptions = {
  filePath: string;
  crypto: SecretCrypto;
};

/**
 * 저장 직전에만 부른다. 빈 값은 키째로 지워서 '기본값으로 되돌리기'가 되게 한다.
 * 스킴 검사도 여기서 한다. 패널에만 두면 손으로 고친 settings.json 이 그대로 통과해
 * javascript: 같은 값이 카탈로그를 거쳐 loadURL 까지 간다.
 */
const sanitizeServiceUrls = (input: Record<string, unknown>): ServiceUrls =>
  Object.fromEntries(
    SERVICE_KEYS.flatMap((key) => {
      const value = input[key];
      const url = typeof value === 'string' ? normalizeServiceUrl(value) : '';

      return url && isServiceUrl(url) ? [[key, url] as const] : [];
    }),
  );

/**
 * 예전 services.json 은 다붓 백엔드와 스케줄러 주소도 들고 있었다.
 * 지금 그 주소의 주인은 endpoints 하나뿐이라 카탈로그로 옮기지 않고 endpoints 의 빈칸만 채운다.
 * 이미 저장된 endpoints 가 있으면 손대지 않는다.
 */
const LEGACY_ENDPOINT_KEYS: Readonly<Record<string, keyof ServiceEndpoints>> = {
  'dabut-api': 'dabutBaseUrl',
  'scheduler-api': 'schedulerBaseUrl',
};

const legacyEndpoints = (input: Record<string, unknown>): Partial<ServiceEndpoints> =>
  Object.fromEntries(
    Object.entries(LEGACY_ENDPOINT_KEYS).flatMap(([legacyKey, endpointKey]) => {
      const value = input[legacyKey];
      const url = typeof value === 'string' ? normalizeServiceUrl(value) : '';

      return url && isServiceUrl(url) ? [[endpointKey, url] as const] : [];
    }),
  );

export const toPublicSettings = ({
  apiKeyCipher,
  schedulerTokenCipher,
  schedulerLabel,
  agentModel,
  writerModel,
  endpoints,
  serviceUrls,
}: StoredSettings): PublicSettings => ({
  hasApiKey: Boolean(apiKeyCipher),
  hasSchedulerToken: Boolean(schedulerTokenCipher),
  schedulerLabel: schedulerLabel ?? '',
  agentModel: agentModel ?? DEFAULT_AGENT_MODEL,
  writerModel: writerModel ?? DEFAULT_WRITER_MODEL,
  endpoints: { ...DEFAULT_ENDPOINTS, ...(endpoints ?? {}) },
  serviceUrls: serviceUrls ?? {},
  services: resolveServices(serviceUrls ?? {}),
});

export const createSettingsStore = ({ filePath, crypto }: SettingsStoreOptions) => {
  const read = (): StoredSettings => {
    if (!existsSync(filePath)) return {};

    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as StoredSettings;
    } catch (error) {
      console.error(ERRORS.settingsFileUnreadable, error);
      return {};
    }
  };

  const write = (settings: StoredSettings) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  };

  const get = () => toPublicSettings(read());

  const setApiKey = (apiKey: string) => {
    if (!crypto.isAvailable()) throw new Error(ERRORS.safeStorageUnavailable);

    const trimmed = apiKey.trim();
    const current = read();

    write({ ...current, apiKeyCipher: trimmed ? crypto.encrypt(trimmed) : undefined });

    return get();
  };

  const setModels = ({ agentModel, writerModel }: { agentModel?: string; writerModel?: string }) => {
    const current = read();
    write({
      ...current,
      agentModel: agentModel ?? current.agentModel,
      writerModel: writerModel ?? current.writerModel,
    });

    return get();
  };

  const setEndpoints = (next: Partial<ServiceEndpoints>) => {
    const current = read();
    write({ ...current, endpoints: { ...DEFAULT_ENDPOINTS, ...(current.endpoints ?? {}), ...next } });

    return get();
  };

  const readEndpoints = (): ServiceEndpoints => get().endpoints;

  const setServiceUrls = (next: ServiceUrls) => {
    const current = read();
    write({
      ...current,
      serviceUrls: sanitizeServiceUrls({ ...(current.serviceUrls ?? {}), ...next }),
    });

    return get();
  };

  const readServiceUrls = (): ServiceUrls => get().serviceUrls;

  /** 예전 config/services.json 을 settings.json 으로 한 번만 옮긴다. 원본 파일은 지우지 않는다. */
  const migrateServiceUrls = (legacyPath: string) => {
    const current = read();

    if (current.serviceUrls) return get();
    if (!existsSync(legacyPath)) return get();

    try {
      const parsed = JSON.parse(readFileSync(legacyPath, 'utf-8')) as Record<string, unknown>;

      const endpoints = { ...legacyEndpoints(parsed), ...(current.endpoints ?? {}) };

      write({
        ...current,
        ...(Object.keys(endpoints).length > 0 ? { endpoints } : {}),
        serviceUrls: sanitizeServiceUrls(parsed),
      });
    } catch (error) {
      console.error(ERRORS.settingsFileUnreadable, error);
    }

    return get();
  };

  const setSchedulerToken = (token: string, label: string) => {
    if (token && !crypto.isAvailable()) throw new Error(ERRORS.safeStorageUnavailable);

    const current = read();
    write({
      ...current,
      schedulerTokenCipher: token ? crypto.encrypt(token) : undefined,
      schedulerLabel: token ? label : undefined,
    });

    return get();
  };

  const readSchedulerToken = () => {
    const { schedulerTokenCipher } = read();
    return schedulerTokenCipher ? crypto.decrypt(schedulerTokenCipher) : null;
  };

  const readApiKey = () => {
    const { apiKeyCipher } = read();
    return apiKeyCipher ? crypto.decrypt(apiKeyCipher) : null;
  };

  return {
    get,
    setApiKey,
    setModels,
    setEndpoints,
    setServiceUrls,
    migrateServiceUrls,
    setSchedulerToken,
    readEndpoints,
    readServiceUrls,
    readApiKey,
    readSchedulerToken,
  };
};

export type SettingsStore = ReturnType<typeof createSettingsStore>;
