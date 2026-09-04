import { buildFormEchoLines, findInvalidField } from '../question-form';
import { QUESTION_FORM_CANCEL } from '../constants';
import { CHAT } from '../messages';
import type { AgentQuestion } from '../bridge';
import type { FormControl } from './types';
import { api, logEl } from './dom';
import { appendEntry, clearEmptyState } from './chat-log';
import { removeThinking } from './thinking';
import { buildFormControl } from './question-form-control';

export const renderQuestionForm = ({ id, question, fields = [] }: AgentQuestion) => {
  clearEmptyState();
  removeThinking();

  const entry = document.createElement('div');
  entry.className = 'entry card question-form';

  const box = document.createElement('div');
  box.className = 'card-box';

  const leadEl = document.createElement('div');
  leadEl.className = 'card-lead';
  leadEl.textContent = question;

  const form = document.createElement('div');
  form.className = 'card-form';

  const rows: HTMLLabelElement[] = [];
  const controls: FormControl[] = [];

  const errorEl = document.createElement('div');
  errorEl.className = 'card-error';

  const setError = (message: string) => {
    errorEl.textContent = message;
  };

  const handleFieldInput = ({ currentTarget }: Event) => {
    (currentTarget as FormControl).closest('.card-field')?.classList.remove('invalid');
    setError('');
  };

  fields.forEach((field) => {
    const row = document.createElement('label');
    row.className = 'card-field';

    const labelEl = document.createElement('span');
    labelEl.textContent = field.label;

    const control = buildFormControl(field);
    control.addEventListener('input', handleFieldInput);

    row.append(labelEl, control);
    form.append(row);
    rows.push(row);
    controls.push(control);
  });

  const foot = document.createElement('div');
  foot.className = 'card-foot';

  const hintEl = document.createElement('div');
  hintEl.className = 'card-hint';
  hintEl.textContent = CHAT.formHint;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'link';
  cancel.textContent = CHAT.formCancelLabel;

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'go';
  go.textContent = CHAT.formSubmitLabel;

  actions.append(cancel, go);
  foot.append(hintEl, actions);
  box.append(leadEl, form, errorEl, foot);
  entry.append(box);
  logEl.append(entry);
  logEl.scrollTop = logEl.scrollHeight;
  controls[0]?.focus();

  // 답을 보내는 동안(busy)과 질문이 닫힌 뒤(closed)는 다르다.
  // busy 는 잠깐 잠그고 풀지만, closed 는 죽은 id 라 다시 열지 않는다.
  let busy = false;
  let closed = false;

  const setBusy = (value: boolean) => {
    busy = value;
    go.disabled = value || closed;
    cancel.disabled = value || closed;
  };

  const closeForm = () => {
    closed = true;
    controls.forEach((control) => {
      control.disabled = true;
    });
    go.disabled = true;
    cancel.disabled = true;
  };

  const collectValues = () => {
    const values: Record<string, string> = {};

    fields.forEach((field, index) => {
      values[field.key] = controls[index]?.value ?? '';
    });

    return values;
  };

  const badInputKeys = () =>
    new Set(
      fields
        .filter((_, index) => {
          const control = controls[index];

          return control instanceof HTMLInputElement && control.validity.badInput;
        })
        .map(({ key }) => key),
    );

  const findInvalid = () => {
    const invalid = findInvalidField(fields, collectValues(), badInputKeys());
    if (!invalid) return null;

    const index = fields.findIndex(({ key }) => key === invalid.key);
    const row = rows[index];
    const control = controls[index];
    if (!row || !control) return null;

    const message =
      invalid.reason === 'badInput' ? CHAT.formBadInput(invalid.label) : CHAT.formFieldRequired(invalid.label);

    return { message, row, control };
  };

  const submit = async () => {
    if (busy || closed) return;

    const invalid = findInvalid();

    if (invalid) {
      invalid.row.classList.add('invalid');
      setError(invalid.message);
      invalid.control.focus();
      return;
    }

    const values = collectValues();
    setBusy(true);
    setError('');

    try {
      // 만료된 질문은 메인이 false 를 준다. 폼을 먼저 지우면 다 채운 값이 같이 날아간다.
      const accepted = await api.answerAgent(id, JSON.stringify(values));

      if (!accepted) {
        setError(CHAT.answerExpired);
        // 죽은 id 라 몇 번을 눌러도 같은 문구만 반복된다. 값은 남기고 조작만 막는다.
        closeForm();
        return;
      }

      entry.remove();
      appendEntry(CHAT.roleUser, buildFormEchoLines(fields, values).join('\n'), 'user');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForm = () => {
    void submit();
  };

  const handleCancelForm = async () => {
    // 제출이 날아가는 중에 취소가 먼저 도착하면 다 채운 값이 버려진다.
    if (busy || closed) return;

    setBusy(true);

    try {
      const accepted = await api.answerAgent(id, JSON.stringify({ [QUESTION_FORM_CANCEL]: true }));

      if (!accepted) {
        setError(CHAT.answerExpired);
        closeForm();
        return;
      }

      entry.remove();
      appendEntry(CHAT.roleSystem, CHAT.formCancelled);
    } finally {
      setBusy(false);
    }
  };

  // 칸이 여러 개라 Enter 는 제출이 아니라 다음 칸이다. 마지막 칸에서만 보낸다.
  // controls 가 input|select 유니온이라 리스너 타입이 Event 로 넓어진다.
  const handleFieldKeydown = (event: Event) => {
    if ((event as KeyboardEvent).key !== 'Enter') return;

    const index = controls.indexOf(event.currentTarget as FormControl);
    const next = controls[index + 1];

    event.preventDefault();
    if (next) next.focus();
    else handleSubmitForm();
  };

  const handleCancelClick = () => {
    void handleCancelForm();
  };

  controls.forEach((control) => control.addEventListener('keydown', handleFieldKeydown));
  go.addEventListener('click', handleSubmitForm);
  cancel.addEventListener('click', handleCancelClick);
};
