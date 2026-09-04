import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import {
  API_SERVICES,
  clampApiBody,
  isAllowedApiPath,
  isApiService,
  normalizeApiQuery,
  redactSecrets,
  type ApiService,
} from '../../api-access';
import { apiGet, describeExposureError } from '../../exposure-api';
import { createExposureSessionHelpers } from './exposure-session';
import type { ToolRuntime } from '../runtime';

export const createApiGetTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getEndpoints, getViroToken, getSchedulerToken, onProgress, clearExposureCookie } = runtime;

  const { exposureSession } = createExposureSessionHelpers(runtime);

  const apiGetTool: ToolSpec = {
    name: 'api_get',
    description: DESC.apiGet,
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', enum: [...API_SERVICES], description: PARAM.apiService },
        path: { type: 'string', description: PARAM.apiPath },
        // 자유 형식이라 properties 는 비운다. 값 종류는 normalizeApiQuery 가 좁힌다.
        query: { type: 'object', description: PARAM.apiQuery, properties: {}, additionalProperties: true },
      },
      required: ['service', 'path'],
      additionalProperties: false,
    },
    run: async ({ service, path, query }) => {
      const name = String(service ?? '');
      if (!isApiService(name)) return RESULT.apiGetUnknownService(name, [...API_SERVICES]);

      const route = path === undefined || path === null ? '' : String(path).trim();
      if (!route) return RESULT.apiGetPathRequired;
      if (!isAllowedApiPath(name as ApiService, route)) {
        return RESULT.apiGetPathNotAllowed(name, route);
      }

      // 인증은 코드가 붙인다. 도구는 헤더 파라미터를 받지 않는다.
      const endpoints = getEndpoints();
      let baseUrl: string;
      let auth: { kind: 'bearer'; token: string } | { kind: 'cookie'; cookie: string };

      if (name === 'exposure') {
        const session = exposureSession();
        if (!session.ok) return session.result;

        baseUrl = session.baseUrl;
        auth = { kind: 'cookie', cookie: session.cookie };
      } else if (name === 'viro') {
        // 바이로는 자기가 발급한 에이전트 토큰을 쓴다. 다붓 JWT 로는 통하지 않는다.
        const token = getViroToken();
        if (!token) return RESULT.apiGetNoAuth(name);

        baseUrl = endpoints.viroBaseUrl;
        auth = { kind: 'bearer', token };
      } else {
        const token = getSchedulerToken();
        if (!token) return RESULT.apiGetNoAuth(name);

        baseUrl = name === 'dabut' ? endpoints.dabutBaseUrl : endpoints.schedulerBaseUrl;
        auth = { kind: 'bearer', token };
      }

      onProgress(PROGRESS.apiGetLoading(name, route));

      let status: number;
      let data: unknown;

      try {
        ({ status, data } = await apiGet({ baseUrl, auth, path: route, query: normalizeApiQuery(query) }));
      } catch (error) {
        return RESULT.apiGetFailed(0, describeExposureError(error));
      }

      // 비밀 키는 성공/실패를 가리지 않고 지운다. 400 본문에도 요청 필드가 되돌아 실린다.
      const body = typeof data === 'string' ? data : JSON.stringify(redactSecrets(data ?? null));

      if (status === 401 && name === 'exposure') {
        clearExposureCookie();

        return RESULT.exposureSessionExpired;
      }
      // 문서가 실제 서버와 어긋났을 때의 마지막 백스톱. 값을 지어내지 말라고 못박는다.
      if (status === 404) return RESULT.apiGetNotFound(name, route);
      if (status >= 400) return RESULT.apiGetFailed(status, clampApiBody(body).text);

      const { text, truncated } = clampApiBody(body);

      return truncated ? RESULT.apiGetTruncated(text) : text;
    },
  };

  return [apiGetTool];
};
