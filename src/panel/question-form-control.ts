import { buildChoiceOptions } from '../question-form';
import { CHAT } from '../messages';
import type { FormControl, QuestionField } from './types';

export const buildFormControl = (field: QuestionField): FormControl => {
  const { choices, type, placeholder, value, optional } = field;

  if (choices?.length) {
    const select = document.createElement('select');

    // 자리표시자는 필수 칸에도 붙인다. 없으면 첫 보기가 기본 답이 되어, 드롭다운을 열어보지도
    // 않은 사용자가 확인만 눌러도 "첫 번째 프로젝트를 골랐다" 로 넘어간다.
    buildChoiceOptions(field, optional ? CHAT.formChoiceNone : CHAT.formChoicePick).forEach(
      ({ label, value: optionValue, selected }) => {
        const option = new Option(label, optionValue, false, selected);
        select.append(option);
      },
    );

    return select;
  }

  const input = document.createElement('input');
  input.type = type ?? 'text';
  input.autocomplete = 'off';
  if (placeholder) input.placeholder = placeholder;
  if (value) input.value = value;
  if (type === 'number') input.inputMode = 'numeric';

  return input;
};
