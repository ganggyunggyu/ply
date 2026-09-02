import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { SecretCrypto } from './accounts';
import { DEFAULT_ENDPOINTS, type ServiceEndpoints } from './hub';
import { DEFAULT_AGENT_MODEL, DEFAULT_WRITER_MODEL } from './models';
import { ERRORS } from './messages';

export type PublicSettings = {
  hasApiKey: boolean;
  hasSchedulerToken: boolean;
  schedulerLabel: string;
  agentModel: string;
  writerModel: string;
  endpoints: ServiceEndpoints;
};

type StoredSettings = {
  apiKeyCipher?: string;
  schedulerTokenCipher?: string;
  schedulerLabel?: string;
  agentModel?: string;
  writerModel?: string;
  endpoints?: Partial<ServiceEndpoints>;
};

type SettingsStoreOptions = {
  filePath: string;
  crypto: SecretCrypto;
};

export const toPublicSettings = ({
  apiKeyCipher,
  schedulerTokenCipher,
  schedulerLabel,
  agentModel,
  writerModel,
  endpoints,
}: StoredSettings): PublicSettings => ({
  hasApiKey: Boolean(apiKeyCipher),
  hasSchedulerToken: Boolean(schedulerTokenCipher),
  schedulerLabel: schedulerLabel ?? '',
  agentModel: agentModel ?? DEFAULT_AGENT_MODEL,
  writerModel: writerModel ?? DEFAULT_WRITER_MODEL,
  endpoints: { ...DEFAULT_ENDPOINTS, ...(endpoints ?? {}) },
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
    setSchedulerToken,
    readEndpoints,
    readApiKey,
    readSchedulerToken,
  };
};

export type SettingsStore = ReturnType<typeof createSettingsStore>;
