import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { BLOG_HOST, deleteSinglePost, resolveBlogId, type DeleteOutcome } from '../../naver';
import { hasNaverSession } from '../session';
import { planDeletion } from '../delete-plan';
import { requestDeleteApproval } from '../delete-approval';
import { describeToolError, stoppedDeleteRows, type DeleteRow } from '../tool-errors';
import type { ToolRuntime } from '../runtime';

export const createDeleteBlogPostsTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { accountStore, getCookieNames, onProgress, withAgentTab, knownPosts, attemptedLogNos, refusedLogNos, askUser, signal } = runtime;

  const deleteBlogPosts: ToolSpec = {
    name: 'delete_blog_posts',
    description: DESC.deleteBlogPosts,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.accountId },
        logNos: { type: 'array', items: { type: 'string' }, description: PARAM.logNos },
      },
      required: ['accountId', 'logNos'],
      additionalProperties: false,
    },
    run: async (input) => {
      const id = String(input.accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      const plan = planDeletion({
        raw: input.logNos,
        known: knownPosts,
        attempted: attemptedLogNos,
        refused: refusedLogNos,
        accountId: id,
      });

      if (!plan.ok) return plan.result;

      const { blogId, targets } = plan;

      onProgress(PROGRESS.deleteConfirmWaiting(targets.length));

      const { approved, answer } = await requestDeleteApproval({ askUser, blogId, targets });

      if (!approved) {
        targets.forEach(({ logNo }) => refusedLogNos.add(logNo));

        return RESULT.deleteCancelled(answer);
      }

      // 확인 카드에 답한 직후 정지를 눌렀을 수 있다. 브라우저를 열기 전에 확인한다.
      if (signal?.aborted) return RESULT.deleteStoppedBeforeStart;

      const rows: DeleteRow[] = [];

      const early = await withAgentTab(
        { url: `https://${BLOG_HOST}/${blogId}`, profileId: id },
        async ({ page }) => {
          // 목록을 읽은 뒤 사용자가 이 프로필에서 다른 계정으로 갈아탔을 수 있다.
          const activeBlogId = await resolveBlogId(page);
          if (activeBlogId !== blogId) return RESULT.deleteBlogChanged(blogId, activeBlogId);

          for (const [index, { logNo, title }] of targets.entries()) {
            /*
             * 여기가 이 도구 안에서 안전하게 멈출 수 있는 유일한 자리다.
             *
             * deleteSinglePost 한 건은 이동 → 확인 → 클릭 → 검증까지 닫힌 사이클이라 글과 글
             * 사이는 원자적 경계다. 반쯤 지워진 상태가 생기지 않으므로, 진행 중인 한 건만 끝내고
             * 나머지는 손대지 않는다. 승인한 10건 중 1건을 보고 "저건 아닌데" 하고 정지를 눌렀을 때
             * 나머지 9건이 그대로 지워지면 정지 버튼이 있으나 마나다.
             */
            if (signal?.aborted) {
              rows.push(...stoppedDeleteRows(targets.slice(index)));
              break;
            }

            attemptedLogNos.add(logNo);
            onProgress(PROGRESS.deleting(title));

            let outcome: DeleteOutcome;

            try {
              outcome = await deleteSinglePost(page, { blogId, logNo, expectedTitle: title, onProgress });
            } catch (error) {
              console.error(error);
              outcome = { logNo, status: 'unknown', message: describeToolError(error) };
            }

            if (outcome.status === 'deleted') knownPosts.delete(logNo);

            rows.push({
              logNo,
              title,
              status: RESULT.deleteStatus[outcome.status],
              note: outcome.message ?? outcome.actualTitle ?? '',
            });
          }

          return null;
        },
      );

      return early ?? JSON.stringify(rows);
    },
  };

  return [deleteBlogPosts];
};
