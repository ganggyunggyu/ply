import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { hasNaverSession } from '../session';
import type { ToolRuntime } from '../runtime';

export const createAccountQueryTools = (runtime: ToolRuntime): [ToolSpec, ToolSpec] => {
  const { accountStore, knownAccountIds, getCookieNames } = runtime;

  const listAccounts: ToolSpec = {
    name: 'list_accounts',
    description: DESC.listAccounts,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const accounts = accountStore.list();
      if (accounts.length === 0) return RESULT.noAccounts;

      // 계정을 고치는 도구가 받을 수 있는 id 를 여기서 확정한다. 목록에 없던 id 는 이후에 거부된다.
      accounts.forEach(({ id }) => knownAccountIds.add(id));

      return JSON.stringify(accounts);
    },
  };

  const checkLogin: ToolSpec = {
    name: 'check_login',
    description: DESC.checkLogin,
    parameters: {
      type: 'object',
      properties: { accountId: { type: 'string', description: PARAM.accountId } },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId }) => {
      const id = String(accountId);
      if (!accountStore.find(id)) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      return hasNaverSession(names) ? RESULT.sessionAlive : RESULT.sessionMissing;
    },
  };

  return [listAccounts, checkLogin];
};
