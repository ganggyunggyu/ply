import { ONBOARDING } from '../messages';
import { logEl } from './dom';
import { clearEmptyState } from './chat-log';
import { removeThinking } from './thinking';
import type { CardOptions } from './types';

/** 키·계정·로그인 카드가 전부 이 모양을 쓴다. 문구와 칸만 바뀐다. */
export const appendCard = ({
  lead,
  note,
  fields,
  submitLabel,
  skipLabel,
  hint,
  chips,
  onSubmit,
  onSkip,
}: CardOptions) => {
  clearEmptyState();
  removeThinking();

  const entry = document.createElement('div');
  entry.className = 'entry card';

  const box = document.createElement('div');
  box.className = 'card-box';

  const leadEl = document.createElement('div');
  leadEl.className = 'card-lead';
  leadEl.textContent = lead;
  box.append(leadEl);

  if (note?.trim()) {
    const noteEl = document.createElement('div');
    noteEl.className = 'card-note';
    noteEl.textContent = ONBOARDING.agentReasonLabel(note.trim());
    box.append(noteEl);
  }

  const inputs: HTMLInputElement[] = [];

  if (fields.length > 0) {
    const form = document.createElement('div');
    form.className = 'card-form';

    fields.forEach((field) => {
      const input = document.createElement('input');
      input.type = field.type ?? 'text';
      input.placeholder = field.placeholder;
      input.value = field.value ?? '';
      input.autocomplete = 'off';
      form.append(input);
      inputs.push(input);
    });

    box.append(form);
  }

  if (chips?.length) {
    const row = document.createElement('div');
    row.className = 'card-chips';

    chips.forEach(({ label, onPick }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        onPick();
        button.disabled = true;
      });
      row.append(button);
    });

    box.append(row);
  }

  const errorEl = document.createElement('div');
  errorEl.className = 'card-error';

  const foot = document.createElement('div');
  foot.className = 'card-foot';

  const hintEl = document.createElement('div');
  hintEl.className = 'card-hint';
  hintEl.textContent = hint ?? '';

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'link';
  skip.textContent = skipLabel ?? ONBOARDING.accountSkipLabel;
  if (skipLabel === '') skip.hidden = true;

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'go';
  go.textContent = submitLabel;

  actions.append(skip, go);
  foot.append(hintEl, actions);
  box.append(errorEl, foot);
  entry.append(box);
  logEl.append(entry);
  logEl.scrollTop = logEl.scrollHeight;
  inputs[0]?.focus();

  const setError = (message: string) => {
    errorEl.textContent = message;
  };

  const submit = async () => {
    go.disabled = true;
    setError('');

    try {
      const done = await onSubmit(inputs.map((i) => i.value), setError);
      if (done) entry.remove();
    } finally {
      go.disabled = false;
    }
  };

  go.addEventListener('click', () => {
    void submit();
  });
  skip.addEventListener('click', () => {
    entry.remove();
    onSkip?.();
  });
  inputs.forEach((input) =>
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void submit();
    }),
  );

  return { remove: () => entry.remove() };
};
