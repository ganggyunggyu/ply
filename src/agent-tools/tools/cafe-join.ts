import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { joinCafe, solveCaptcha, toMobileCafeHomeUrl, type CafeTarget } from '../../cafe';
import { hasNaverSession } from '../session';
import type { ToolRuntime } from '../runtime';

/**
 * cafeUrl 과 cafeId 중 하나만 있어도 된다.
 * 슬러그 주소가 더 안정적이라 그쪽을 먼저 쓰고, 없을 때만 숫자 id 경로로 간다.
 */
export const toCafeTarget = (cafeUrl: unknown, cafeId: unknown, name: unknown): CafeTarget | null => {
  const url = typeof cafeUrl === 'string' ? cafeUrl.trim() : '';
  const id = typeof cafeId === 'string' || typeof cafeId === 'number' ? String(cafeId).trim() : '';
  if (!url && !id) return null;

  return { cafeId: id, ...(url && { cafeUrl: url }), ...(typeof name === 'string' && { name }) };
};

export const createCafeJoinTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { accountStore, getCookieNames, onProgress, withAgentTab, client, getEndpoints, getSchedulerToken } = runtime;

  /** 보안문자는 스케줄러가 푼다. 이 앱에는 캡차용 모델 키가 없다. */
  const cafeCaptchaSolver = (kind: 'cafe-join') => (image: string) =>
    solveCaptcha({
      client,
      schedulerBaseUrl: getEndpoints().schedulerBaseUrl,
      token: getSchedulerToken(),
      image,
      kind,
    });

  const joinNaverCafe: ToolSpec = {
    name: 'join_naver_cafe',
    description: DESC.joinNaverCafe,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: PARAM.accountId },
        cafeUrl: { type: 'string', description: PARAM.cafeUrl },
        cafeId: { type: 'string', description: PARAM.cafeId },
        nickname: { type: 'string', description: PARAM.cafeNickname },
      },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId, cafeUrl, cafeId, nickname }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      const names = await getCookieNames(id);
      if (!hasNaverSession(names)) return RESULT.notLoggedIn;

      const target = toCafeTarget(cafeUrl, cafeId, undefined);
      if (!target) return RESULT.cafeTargetMissing;

      const label = target.cafeUrl ?? target.cafeId;
      onProgress(PROGRESS.cafeJoinStarting(label));

      return withAgentTab({ url: toMobileCafeHomeUrl(target), profileId: id }, async ({ page }) => {
        const { status, detail } = await joinCafe(page, target, {
          nickname: String(nickname ?? account.naverId),
          solveCaptcha: cafeCaptchaSolver('cafe-join'),
          onProgress: (step) => onProgress(PROGRESS.cafeStep(step)),
        });

        if (status === 'joined') return RESULT.cafeJoined(label);
        if (status === 'pending') return RESULT.cafeJoinPending(label);
        if (status === 'alreadyMember') return RESULT.cafeAlreadyMember(label);

        return RESULT.cafeJoinFailed(label, detail);
      });
    },
  };

  return [joinNaverCafe];
};
