import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { toArticleUrl, writeCafeComment } from '../../cafe';
import { hasNaverSession } from '../session';
import { toCafeTarget } from './cafe-join';
import type { ToolRuntime } from '../runtime';

export const createCafeCommentTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { accountStore, getCookieNames, onProgress, withAgentTab } = runtime;

  const writeCafeCommentTool: ToolSpec = {
    name: 'write_cafe_comment',
    description: DESC.writeCafeComment,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.accountId },
        cafeUrl: { type: 'string', description: PARAM.cafeUrl },
        cafeId: { type: 'string', description: PARAM.cafeId },
        articleId: { type: 'string', description: PARAM.cafeArticleId },
        content: { type: 'string', description: PARAM.cafeCommentBody },
      },
      required: ['accountId', 'articleId', 'content'],
      additionalProperties: false,
    },
    run: async ({ accountId, cafeUrl, cafeId, articleId, content }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      const target = toCafeTarget(cafeUrl, cafeId, undefined);
      if (!target) return RESULT.cafeTargetMissing;

      onProgress(PROGRESS.cafeCommentStarting(String(articleId)));

      return withAgentTab({ url: toArticleUrl(target, String(articleId)), profileId: id }, async ({ page }) => {
        const { posted, detail, articleUrl } = await writeCafeComment(
          page,
          target,
          String(articleId),
          String(content),
          (step) => onProgress(PROGRESS.cafeStep(step)),
        );

        return posted ? RESULT.cafeCommentPosted(articleUrl) : RESULT.cafeCommentFailed(detail);
      });
    },
  };

  return [writeCafeCommentTool];
};
