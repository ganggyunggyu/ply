import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { parseCardOutcome } from '../card-outcome';
import type { ToolRuntime } from '../runtime';

export const createExposureLoginTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { declinedCards, onProgress, requestExposureLogin, signal } = runtime;

  const exposureLogin: ToolSpec = {
    name: 'exposure_login',
    description: DESC.exposureLogin,
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', description: PARAM.loginReason } },
      additionalProperties: false,
    },
    run: async ({ reason }) => {
      if (declinedCards.has('exposure_login')) return RESULT.exposureLoginAlreadyDeclined;

      onProgress(PROGRESS.exposureLoginWaiting);

      const answer = await requestExposureLogin(String(reason ?? '')).catch(() => '');

      if (!answer) {
        declinedCards.add('exposure_login');

        return signal?.aborted ? RESULT.runStopped : RESULT.exposureLoginNoAnswer;
      }

      const outcome = parseCardOutcome(answer);

      if (outcome.status !== 'exposure_login') {
        declinedCards.add('exposure_login');

        return RESULT.exposureLoginSkipped;
      }

      return RESULT.exposureLoginDone(outcome.name);
    },
  };

  return [exposureLogin];
};
