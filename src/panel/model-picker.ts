import { buildRow, filterModels, type ModelPickerOptions } from './model-list';

/**
 * 칩에 붙는 모델 고르개.
 *
 * `<select>` 는 목록이 길어지면 단가도 메모도 못 보여주고, 검색도 안 된다.
 * 열려 있는 동안만 문서에 붙고 닫으면 지운다 — 상태를 DOM 밖에 두지 않기 위해서다.
 */
export const openModelPicker = ({
  anchor,
  models,
  selectedId,
  searchPlaceholder,
  settingsLabel,
  emptyLabel,
  onPick,
  onSettings,
}: ModelPickerOptions) => {
  const panel = document.createElement('div');
  panel.className = 'model-picker';

  const search = document.createElement('input');
  search.className = 'picker-search';
  search.type = 'search';
  search.placeholder = searchPlaceholder;
  search.autocomplete = 'off';

  const list = document.createElement('div');
  list.className = 'picker-list';

  const settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'picker-settings';
  settings.textContent = settingsLabel;

  panel.append(search, list, settings);

  const close = () => {
    panel.remove();
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleOutside);
  };

  const handlePick = (id: string) => {
    close();
    onPick(id);
  };

  const renderList = () => {
    const matched = filterModels(models, search.value);

    if (matched.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'picker-empty';
      empty.textContent = emptyLabel;
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(...matched.map((model) => buildRow(model, model.id === selectedId, handlePick)));
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };

  // 칩 자신을 누른 것은 바깥이 아니다. 그걸 닫기로 치면 다시 열리면서 깜빡인다.
  const handleOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!panel.contains(target) && !anchor.contains(target)) close();
  };

  const handleSettings = () => {
    close();
    onSettings();
  };

  const handleSearchInput = () => renderList();

  search.addEventListener('input', handleSearchInput);
  settings.addEventListener('click', handleSettings);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleOutside);

  renderList();
  // 자식으로 넣어야 position:relative 인 anchor 가 offsetParent 가 된다.
  anchor.appendChild(panel);
  search.focus();

  return close;
};
