export type PickerModel = {
  id: string;
  label: string;
  note?: string;
  detail?: string;
};

export type ModelPickerOptions = {
  anchor: HTMLElement;
  models: PickerModel[];
  selectedId: string;
  searchPlaceholder: string;
  settingsLabel: string;
  emptyLabel: string;
  onPick: (id: string) => void;
  onSettings: () => void;
};

/** 검색은 이름과 모델 id 둘 다 본다. 사용자는 "glm" 처럼 id 조각으로도 찾는다. */
export const filterModels = (models: PickerModel[], query: string): PickerModel[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return models;

  return models.filter(({ id, label }) => `${label} ${id}`.toLowerCase().includes(needle));
};

export const buildRow = (model: PickerModel, selected: boolean, onPick: (id: string) => void) => {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'picker-row';
  row.dataset.selected = String(selected);
  row.title = model.note ?? '';

  const name = document.createElement('span');
  name.className = 'picker-name';
  name.textContent = model.label;

  const meta = document.createElement('span');
  meta.className = 'picker-meta';
  meta.textContent = selected ? '✓' : model.detail ?? '';

  row.append(name, meta);

  const handlePick = () => onPick(model.id);
  row.addEventListener('click', handlePick);

  return row;
};
