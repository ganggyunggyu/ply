import type { PublicSettings } from '../bridge';
import { CHAT } from '../messages';
import { connectionStates } from '../service-form';
import { api, chipModelEl, chipServicesEl } from './dom';

export const shortModel = (id: string) => id.split('/').pop() ?? id;

export const renderChips = (settings: PublicSettings) => {
  chipModelEl.textContent = shortModel(settings.agentModel);
  chipModelEl.title = CHAT.modelChipTitle;
};

/** 칩만 다시 그린다. 설정 화면의 다른 입력칸은 건드리지 않는다. */
export const refreshServiceChip = async () => {
  try {
    const { services, endpoints } = await api.getSettings();
    const states = connectionStates(services, endpoints.exposureBotDir);

    chipServicesEl.replaceChildren();

    states.forEach(({ label, ok }) => {
      const dot = document.createElement('i');
      dot.className = ok ? 'up' : 'down';
      dot.title = label;
      chipServicesEl.append(dot);
    });

    const label = document.createElement('span');
    label.textContent = CHAT.servicesUp(states.filter(({ ok }) => ok).length, states.length);
    chipServicesEl.append(label);
    chipServicesEl.title = CHAT.servicesChipTitle;
  } catch {
    chipServicesEl.textContent = '';
  }
};
