import type { ToolSpec } from '../../openrouter';
import {
  TOOL_RESULTS as RESULT,
  RESULT_PRESET,
  TOOL_DESCRIPTIONS as DESC,
  PARAM_DESCRIPTIONS as PARAM,
} from '../../prompts';
import { PROGRESS } from '../../messages';
import { describeExposureError, readPreset, writePreset } from '../../exposure-api';
import {
  applyPresetAction,
  describeSavedPreset,
  isPresetActionName,
  PRESET_ACTIONS,
  readTenantPreset,
} from '../../exposure-preset';
import { requestPresetSaveApproval } from '../approval';
import { createExposureSessionHelpers } from './exposure-session';
import type { ToolRuntime } from '../runtime';

export const createUpdateExposurePresetTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { onProgress, askUser, signal } = runtime;

  const { exposureSession, describeExposureFailure } = createExposureSessionHelpers(runtime);

  const updateExposurePreset: ToolSpec = {
    name: 'update_exposure_preset',
    description: DESC.updateExposurePreset,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: [...PRESET_ACTIONS], description: PARAM.presetAction },
        label: { type: 'string', description: PARAM.presetLabel },
        sheetUrl: { type: 'string', description: PARAM.presetSheetUrl },
        tabTitle: { type: 'string', description: PARAM.presetTabTitle },
        targets: { type: 'array', items: { type: 'string' }, description: PARAM.presetCafeTargets },
        checkId: { type: 'string', description: PARAM.presetCheckId },
        targetId: { type: 'string', description: PARAM.presetTargetId },
        blogIds: { type: 'array', items: { type: 'string' }, description: PARAM.presetBlogIds },
        url: { type: 'string', description: PARAM.presetDoorayUrl },
      },
      required: ['action'],
      additionalProperties: false,
    },
    run: async (input) => {
      const action = String(input.action ?? '');
      if (!isPresetActionName(action)) return RESULT_PRESET.unknownPresetAction(action);

      const session = exposureSession();
      if (!session.ok) return session.result;

      const { baseUrl, cookie } = session;

      onProgress(PROGRESS.exposurePresetLoading);

      let current: unknown;

      try {
        ({ preset: current } = await readPreset({ baseUrl, cookie }));
      } catch (error) {
        return describeExposureFailure(error);
      }

      const parsed = readTenantPreset(current);
      if (!parsed.ok) return parsed.result;

      // 병합은 반드시 코드가 한다. PUT 이 전체 교체라서 모델이 JSON 을 다시 쓰면
      // 안 건드린 항목이 조용히 사라지고 그 실패에는 에러가 없다.
      const applied = applyPresetAction(parsed.preset, action, input);
      if (!applied.ok) return applied.result;

      const { change } = applied;

      onProgress(PROGRESS.exposurePresetConfirmWaiting);

      const { approved, answer, answered } = await requestPresetSaveApproval({ askUser, change });

      if (!approved) {
        return answered ? RESULT.presetNotApproved(answer) : RESULT.presetNoAnswer;
      }

      if (signal?.aborted) return RESULT.runStopped;

      onProgress(PROGRESS.exposurePresetSaving);

      // PUT 은 전체 교체다. 카드를 읽는 동안 대시보드에서 누가 뭘 고쳤으면 그게 조용히 덮인다.
      // 버전 헤더가 없으니 승인 직후에 한 번 더 읽어 비교하는 것이 우리가 할 수 있는 검사다.
      // 문자열 비교라 키 순서가 흔들리면 헛짚을 수 있는데, 헛짚는 쪽은 "저장을 안 한다" 이다.
      // 놓치는 쪽이 덮어쓰기라서 이 방향으로 틀리는 편이 맞다.
      let latest: unknown;

      try {
        ({ preset: latest } = await readPreset({ baseUrl, cookie }));
      } catch (error) {
        return describeExposureFailure(error);
      }

      if (JSON.stringify(latest) !== JSON.stringify(current)) {
        return RESULT.presetChangedWhileWaiting;
      }

      let saved: unknown;

      try {
        ({ preset: saved } = await writePreset({ baseUrl, cookie, preset: change.preset }));
      } catch (error) {
        // 400 의 문구는 노출지기가 사용자에게 보여주려고 쓴 한국어다. 고쳐 쓰지 않는다.
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        if (status === 400 || status === 404) {
          return RESULT.presetRejected(describeExposureError(error));
        }

        return describeExposureFailure(error);
      }

      // 보내기 전 요약이 아니라 서버가 되돌려준 값을 보고한다.
      // 노출지기는 저장 직전에 blogIds 를 정규화하고 못 쓰는 값을 조용히 버린다.
      return RESULT.presetSaved(describeSavedPreset(change.verify, saved));
    },
  };

  return [updateExposurePreset];
};
