import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { describeSchedulerError, getDabutProject, updateDabutProject } from '../../hub';
import type { ToolRuntime } from '../runtime';

/** 다붓은 snake_case 로 받고 우리 타입은 camelCase 다. 바뀐 항목을 되짚을 때만 쓴다. */
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_match, c: string) => c.toUpperCase());

export const createUpdateDabutProjectTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getSchedulerToken, knownProjectIds, getEndpoints } = runtime;

  /*
    다붓 프로젝트를 고치는 유일한 쓰기 도구. 읽기는 api_get 이 /projects* 를 이미 허용한다.
    AGENT.md 가 도구 수 상한을 못박아 뒀으므로 읽기용 도구를 새로 만들지 않는다.
  */
  const updateDabutProjectTool: ToolSpec = {
    name: 'update_dabut_project',
    description: DESC.updateDabutProject,
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: PARAM.projectId },
        changes: { type: 'object', description: PARAM.projectChanges, additionalProperties: true },
      },
      required: ['projectId', 'changes'],
      additionalProperties: false,
    },
    run: async (input) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      const id = String(input.projectId);
      // 이번 실행에서 실제로 본 적 없는 id 는 받지 않는다. 지어낸 번호로 남의 프로젝트를 덮지 않게 한다.
      if (!knownProjectIds.has(id)) return RESULT.projectNotFound(id);

      const changes = input.changes;
      if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        return RESULT.projectChangesEmpty;
      }

      const body = changes as Record<string, unknown>;
      if (Object.keys(body).length === 0) return RESULT.projectChangesEmpty;

      try {
        const baseUrl = getEndpoints().dabutBaseUrl;
        const before = await getDabutProject(baseUrl, id, getSchedulerToken());
        const after = await updateDabutProject({
          baseUrl,
          projectId: id,
          token: getSchedulerToken(),
          changes: body,
        });

        // 바뀐 항목만 전후로 싣는다. 무엇이 실제로 달라졌는지 사용자에게 말할 수 있어야 한다.
        const changed = Object.keys(body).map((key) => {
          const field = toCamel(key);
          return {
            key,
            before: (before as unknown as Record<string, unknown>)[field] ?? null,
            after: (after as unknown as Record<string, unknown>)[field] ?? null,
          };
        });

        return JSON.stringify({ id, label: after.label, changed });
      } catch (error) {
        return describeSchedulerError(error);
      }
    },
  };

  return [updateDabutProjectTool];
};
