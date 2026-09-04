import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { checkServices, listDabutProjects } from '../../hub';
import type { ToolRuntime } from '../runtime';

export const createDabutBasicTools = (runtime: ToolRuntime): [ToolSpec, ToolSpec, ToolSpec] => {
  const { getEndpoints, getSchedulerToken, requestDabutLogin, signal, knownProjectIds, projectLabels } = runtime;

  const checkServicesTool: ToolSpec = {
    name: 'check_services',
    description:
      DESC.checkServices,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const health = await checkServices(getEndpoints(), getSchedulerToken());
      return JSON.stringify(health);
    },
  };

  const dabutLogin: ToolSpec = {
    name: 'dabut_login',
    description: DESC.dabutLogin,
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', description: PARAM.loginReason } },
      additionalProperties: false,
    },
    // 대기가 만료되면 requestDabutLogin 이 던진다. 그대로 두면 도구가 아니라 실행 전체가 죽는다.
    run: async ({ reason }) => {
      try {
        return await requestDabutLogin(String(reason ?? ''));
      } catch {
        // 정지도 대기를 풀어 준다. 그걸 만료라고 적으면 사용자가 하지 않은 무응답을 지어내게 된다.
        return signal?.aborted ? RESULT.runStopped : RESULT.dabutLoginNoAnswer;
      }
    },
  };

  const listProjects: ToolSpec = {
    name: 'list_dabut_projects',
    description: DESC.listDabutProjects,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      try {
        const projects = await listDabutProjects(getEndpoints().dabutBaseUrl, getSchedulerToken());
        if (projects.length === 0) return RESULT.noDabutProjects;

        // 예약이 받을 수 있는 projectId 를 여기서 확정한다. 목록에 없던 id 는 이후에 거부된다.
        // 라벨도 같이 담아 둔다. get_schedule 이 저장된 id 를 사람이 읽을 이름으로 되돌린다.
        projects.forEach(({ id, label }) => {
          knownProjectIds.add(String(id));
          if (label) projectLabels.set(String(id), label);
        });

        return JSON.stringify(
          projects.map(({ id, label, description, model }) => ({ id, label, description, model })),
        );
      } catch (error) {
        return `프로젝트 목록을 못 가져왔다: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  return [checkServicesTool, dabutLogin, listProjects];
};
