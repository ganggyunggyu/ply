import axios from 'axios';
import { existsSync } from 'fs';
import { SERVICE_LABELS } from '../messages';
import type { ServiceEndpoints } from './endpoints';

export type ServiceHealth = {
  name: string;
  url: string;
  ok: boolean;
  detail: string;
};

const probe = async (name: string, url: string): Promise<ServiceHealth> => {
  try {
    const { status } = await axios.get(url, { timeout: 3000, validateStatus: () => true });
    return { name, url, ok: status < 500, detail: `HTTP ${status}` };
  } catch (error) {
    return { name, url, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
};

export const checkServices = async (
  { dabutBaseUrl, schedulerBaseUrl, exposureBotDir }: ServiceEndpoints,
  schedulerToken?: string,
): Promise<ServiceHealth[]> => {
  const http = await Promise.all([
    probe(SERVICE_LABELS.dabut, `${dabutBaseUrl}/docs`),
    probe(SERVICE_LABELS.scheduler, `${schedulerBaseUrl}/health`),
  ]);

  const auth: ServiceHealth = {
    name: SERVICE_LABELS.schedulerAuth,
    url: schedulerBaseUrl,
    ok: Boolean(schedulerToken),
    detail: schedulerToken ? SERVICE_LABELS.schedulerAuthOk : SERVICE_LABELS.schedulerAuthMissing,
  };

  const exposure: ServiceHealth = exposureBotDir
    ? {
        name: SERVICE_LABELS.exposure,
        url: exposureBotDir,
        ok: existsSync(`${exposureBotDir}/package.json`),
        detail: existsSync(`${exposureBotDir}/package.json`)
          ? SERVICE_LABELS.exposureOk
          : SERVICE_LABELS.exposureNoPackageJson,
      }
    : {
        name: SERVICE_LABELS.exposure,
        url: SERVICE_LABELS.exposureUnset,
        ok: false,
        detail: SERVICE_LABELS.exposureNotConfigured,
      };

  return [...http, auth, exposure];
};
