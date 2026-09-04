import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC } from '../../prompts';
import { PROGRESS } from '../../messages';
import {
  detectLoginBlock,
  fillLoginForm,
  isSessionExpired,
  LOGIN_URL,
  sleep,
} from '../../naver';
import type { ToolRuntime } from '../runtime';

export const createNaverLoginTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { accountStore, onProgress, withAgentTab } = runtime;

  const naverLogin: ToolSpec = {
    name: 'naver_login',
    description:
      DESC.naverLogin,
    parameters: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
      additionalProperties: false,
    },
    run: async ({ accountId }) => {
      const id = String(accountId);
      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      onProgress(PROGRESS.loginTabOpening(account.label));

      return withAgentTab({ url: LOGIN_URL, profileId: id }, async ({ page, keepTab }) => {
        // 비밀번호가 없으면 사용자가 이 탭에서 직접 로그인해야 한다. 닫으면 할 자리가 사라진다.
        if (!account.hasPassword) {
          keepTab();
          return RESULT.noStoredPassword;
        }

        const password = accountStore.readPassword(id);
        if (!password) {
          keepTab();
          return RESULT.decryptFailed;
        }

        onProgress(PROGRESS.loginFilling);
        await fillLoginForm(page, account.naverId, password);
        await sleep(4000);

        // 캡차와 2차 인증은 사람이 그 화면에서 풀어야 한다. 탭을 닫으면 처음부터 다시 해야 한다.
        const block = await detectLoginBlock(page);
        if (block === 'captcha') {
          keepTab();
          return RESULT.blockedByCaptcha;
        }
        if (block === 'two_factor') {
          keepTab();
          return RESULT.blockedByTwoFactor;
        }
        // 비밀번호가 틀린 것은 사람이 그 탭에서 풀 수 있는 문제가 아니다. 닫는다.
        if (block === 'error') return RESULT.wrongCredentials;

        if (isSessionExpired(page.url())) {
          keepTab();
          return RESULT.stillOnLoginPage;
        }

        return RESULT.loginSucceeded;
      });
    },
  };

  return [naverLogin];
};
