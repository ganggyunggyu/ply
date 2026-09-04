import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { generateManuscriptViaProject } from '../../hub';
import { splitManuscript } from '../manuscript';
import type { ToolRuntime } from '../runtime';

export const createGenerateManuscriptDabutTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { getSchedulerToken, onProgress, getEndpoints, signal } = runtime;

  const generateViaDabut: ToolSpec = {
    name: 'generate_manuscript_dabut',
    description: DESC.generateManuscriptDabut,
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: PARAM.projectId },
        keyword: { type: 'string', description: PARAM.keyword },
        ref: { type: 'string', description: PARAM.ref },
        businessName: { type: 'string', description: PARAM.businessName },
        withImages: { type: 'boolean', description: PARAM.withImages },
      },
      required: ['projectId', 'keyword'],
      additionalProperties: false,
    },
    run: async ({ projectId, keyword, ref, businessName, withImages }) => {
      if (!getSchedulerToken()) return RESULT.dabutNotLoggedIn;

      onProgress(PROGRESS.dabutGenerating(String(keyword)));

      // 최대 10분 걸리는 호출이다. 네이버에 쓰는 게 아니라 끊어도 반쯤 남는 것이 없어서 신호를 넣는다.
      const result = await generateManuscriptViaProject({
        baseUrl: getEndpoints().dabutBaseUrl,
        token: getSchedulerToken() ?? '',
        projectId: String(projectId),
        keyword: String(keyword),
        ref: ref ? String(ref) : undefined,
        businessName: businessName ? String(businessName) : undefined,
        withImages: withImages === true,
        signal,
      });

      if (!result.content) return RESULT.dabutEmpty;

      const { title, body } = splitManuscript(result.content);
      return JSON.stringify({
        title,
        body,
        project: result.projectLabel,
        images: result.imageCount,
      });
    },
  };

  return [generateViaDabut];
};
