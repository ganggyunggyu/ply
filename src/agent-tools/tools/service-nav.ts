import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { configuredServices, findService, isServiceConfigured } from '../../services';
import type { ToolRuntime } from '../runtime';

export const createServiceNavTools = (runtime: ToolRuntime): [ToolSpec, ToolSpec, ToolSpec] => {
  const { tabManager } = runtime;

  const listServices: ToolSpec = {
    name: 'list_services',
    description: DESC.listServices,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const services = configuredServices();
      if (services.length === 0) return RESULT.noServicesConfigured;

      return JSON.stringify(
        services.map(({ key, name, url, kind, description }) => ({ key, name, url, kind, description })),
      );
    },
  };

  const openService: ToolSpec = {
    name: 'open_service',
    description: DESC.openService,
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: PARAM.serviceName },
        accountId: { type: 'string', description: PARAM.profileId },
      },
      required: ['service'],
      additionalProperties: false,
    },
    run: async ({ service, accountId }) => {
      const found = findService(String(service));
      if (!found) return RESULT.serviceNotFound(String(service));
      if (!isServiceConfigured(found.key)) return RESULT.serviceNotConfigured(found.name);

      // 사용자가 "열어줘" 라고 시킨 탭이다. 안 보여주면 화면은 그대로인데 "열었어요" 라고 보고하게 된다.
      tabManager.createTab({
        url: found.url,
        profileId: accountId ? String(accountId) : 'default',
        openedByAgent: true,
        focus: true,
      });

      return RESULT.serviceOpened(found.name, found.url);
    },
  };

  const openTab: ToolSpec = {
    name: 'open_tab',
    description: DESC.openTab,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        accountId: { type: 'string', description: PARAM.profileId },
      },
      required: ['url'],
      additionalProperties: false,
    },
    run: async ({ url, accountId }) => {
      tabManager.createTab({
        url: String(url),
        profileId: accountId ? String(accountId) : 'default',
        openedByAgent: true,
        focus: true,
      });
      return RESULT.tabOpened(String(url));
    },
  };

  return [listServices, openService, openTab];
};
