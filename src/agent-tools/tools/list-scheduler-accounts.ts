import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC } from '../../prompts';
import { listSchedulerAccounts } from '../../hub';
import { indexOwnedAccounts } from '../owned-accounts';
import type { ToolRuntime } from '../runtime';

export const createListSchedulerAccountsTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getEndpoints, getSchedulerToken } = runtime;

  const listSchedulerAccountsTool: ToolSpec = {
    name: 'list_scheduler_accounts',
    description:
      DESC.listSchedulerAccounts,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      try {
        const accounts = await listSchedulerAccounts(getEndpoints().schedulerBaseUrl, getSchedulerToken());
        if (accounts.length === 0) return RESULT.noSchedulerAccounts;

        // 예약 도구들이 소유 판정에 쓰는 표를 여기서 미리 채운다. 같은 응답을 두 번 받지 않는다.
        const owned = indexOwnedAccounts(accounts);
        if (owned.size > 0) runtime.setOwnedAccountsCache(owned);

        // loginId 는 네이버 로그인 id 원문이라 소유 판정에만 쓰고 모델에게는 내보내지 않는다.
        return JSON.stringify(
          accounts.map(({ id, name, blogId }) => ({ id, name, blogId })),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return RESULT.schedulerUnreachable(message);
      }
    },
  };

  return [listSchedulerAccountsTool];
};
