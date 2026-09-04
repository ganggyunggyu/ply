import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { MY_BLOG_URL, WRITE_URL, fetchRecentPosts, resolveBlogId, writeBlogPost } from '../../naver';
import { hasNaverSession } from '../session';
import { clampListLimit } from '../post-limits';
import { toKnownPosts } from '../delete-targets';
import type { ToolRuntime } from '../runtime';

export const createBlogBasicTools = (runtime: ToolRuntime): [ToolSpec, ToolSpec] => {
  const { accountStore, getCookieNames, onProgress, withAgentTab, knownPosts } = runtime;

  const publishBlogPost: ToolSpec = {
    name: 'publish_blog_post',
    description:
      DESC.publishBlogPost,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['accountId', 'title', 'body'],
      additionalProperties: false,
    },
    run: async ({ accountId, title, body }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      onProgress(PROGRESS.publishStarting(account.label, String(title)));

      // 남는 건 에디터 탭이지 발행된 글이 아니다. 사용자가 볼 주소는 결과 문장에 링크로 나가므로
      // 여기서는 닫는다.
      return withAgentTab({ url: WRITE_URL, profileId: id }, async ({ page }) => {
        const url = await writeBlogPost(page, { title: String(title), body: String(body), onProgress });

        return RESULT.published(url);
      });
    },
  };

  const listMyPosts: ToolSpec = {
    name: 'list_my_posts',
    description: DESC.listMyPosts,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.accountId },
        limit: { type: 'number', description: PARAM.postLimit },
      },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId, limit }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      const count = clampListLimit(limit);
      onProgress(PROGRESS.postListLoading(account.label));

      return withAgentTab({ url: MY_BLOG_URL, profileId: id }, async ({ page }) => {
        const blogId = await resolveBlogId(page);
        const posts = await fetchRecentPosts(page, { blogId, limit: count });

        if (posts.length === 0) return RESULT.noPosts(blogId);

        toKnownPosts(posts, blogId, id).forEach((post) => knownPosts.set(post.logNo, post));

        // 키가 url 이면 tool-output 의 NOISY_KEYS 가 표에서 지운다. postUrl 이어야 사용자가 본다.
        return JSON.stringify(
          posts.map(({ logNo, title, addDate, postUrl }) => ({ blogId, logNo, title, addDate, postUrl })),
        );
      });
    },
  };

  return [publishBlogPost, listMyPosts];
};
