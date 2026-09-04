import type { ModelPreset } from './types';

export const renderModelOptions = (select: HTMLSelectElement, presets: ModelPreset[], selected: string) => {
  select.replaceChildren(
    ...presets.map(({ id, label, inputPerMillion, outputPerMillion, note }) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${label} — $${inputPerMillion} / $${outputPerMillion}`;
      option.title = note;
      return option;
    }),
  );

  select.value = selected;
};
