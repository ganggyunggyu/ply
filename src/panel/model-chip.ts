import { SETTINGS } from '../messages';
import { openModelPicker } from './model-picker';
import { agentModelEl, composerFootEl, settingsEl } from './dom';
import { panelState } from './state';
import { handleAgentModelChange } from './model-select-handlers';

/**
 * 칩이 곧 모델 고르개다. 예전에는 설정 패널을 열어 `<select>` 로 보냈는데,
 * 모델을 바꾸는 일이 대화 중에 제일 잦아서 그 자리에서 끝나게 했다.
 */
export const handleModelChipClick = () => {
  if (panelState.closeModelPicker) {
    panelState.closeModelPicker();
    panelState.closeModelPicker = null;
    return;
  }

  panelState.closeModelPicker = openModelPicker({
    anchor: composerFootEl,
    models: panelState.agentPresets.map(({ id, label, inputPerMillion, outputPerMillion, note }) => ({
      id,
      label,
      note,
      detail: `$${inputPerMillion}/$${outputPerMillion}`,
    })),
    selectedId: agentModelEl.value,
    searchPlaceholder: SETTINGS.modelSearchPlaceholder,
    settingsLabel: SETTINGS.modelPickerSettings,
    emptyLabel: SETTINGS.modelPickerEmpty,
    onPick: (id) => {
      panelState.closeModelPicker = null;
      agentModelEl.value = id;
      handleAgentModelChange();
    },
    onSettings: () => {
      panelState.closeModelPicker = null;
      settingsEl.hidden = false;
      agentModelEl.focus();
    },
  });
};
