import { renderMarkdown } from './markdown';
import { formatToolOutput } from './tool-output';
import { connectionStates, cookieLoginServices } from './service-form';
import { CHAT, EMPTY_STATE, ONBOARDING, PANEL, SETTINGS } from './messages';
import { QUESTION_FORM_CANCEL } from './constants';
import {
  addUsage,
  EMPTY_USAGE,
  formatCost,
  formatTokenCount,
  totalTokens,
  usageCost,
  type UsageTotal,
} from './usage';
import { buildChoiceOptions, buildFormEchoLines, findInvalidField } from './question-form';
import type {
  AgentEventView,
  AgentQuestion,
  ChatMessageView,
  ModelPresetView,
  NaverAccount,
  PublicSettings,
  QuestionField,
  ServiceCatalogItemView,
} from './bridge';

type ModelPreset = ModelPresetView;
type AgentEvent = AgentEventView;
type ChatMessage = ChatMessageView;

const api = window.gngBrowser;

const settingsEl = document.getElementById('settings') as HTMLElement;
const settingsToggleEl = document.getElementById('settings-toggle') as HTMLButtonElement;
const apiKeyEl = document.getElementById('api-key') as HTMLInputElement;
const saveKeyEl = document.getElementById('save-key') as HTMLButtonElement;
const keyStatusEl = document.getElementById('key-status') as HTMLElement;
const agentModelEl = document.getElementById('agent-model') as HTMLSelectElement;
const writerModelEl = document.getElementById('writer-model') as HTMLSelectElement;
const accountListEl = document.getElementById('account-list') as HTMLUListElement;
const accountLabelEl = document.getElementById('account-label') as HTMLInputElement;
const accountIdEl = document.getElementById('account-id') as HTMLInputElement;
const accountPwEl = document.getElementById('account-pw') as HTMLInputElement;
const addAccountEl = document.getElementById('add-account') as HTMLButtonElement;
const epDabutEl = document.getElementById('ep-dabut') as HTMLInputElement;
const epSchedulerEl = document.getElementById('ep-scheduler') as HTMLInputElement;
const epExposureEl = document.getElementById('ep-exposure') as HTMLInputElement;
const saveEndpointsEl = document.getElementById('save-endpoints') as HTMLButtonElement;
const endpointStatusEl = document.getElementById('endpoint-status') as HTMLElement;
const chipModelEl = document.getElementById('chip-model') as HTMLButtonElement;
const chipServicesEl = document.getElementById('chip-services') as HTMLButtonElement;
const chipUsageEl = document.getElementById('chip-usage') as HTMLElement;
const schUserEl = document.getElementById('sch-user') as HTMLInputElement;
const schPassEl = document.getElementById('sch-pass') as HTMLInputElement;
const schLoginEl = document.getElementById('sch-login') as HTMLButtonElement;
const schStatusEl = document.getElementById('sch-status') as HTMLElement;
const logEl = document.getElementById('log') as HTMLElement;
const composerEl = document.getElementById('composer') as HTMLFormElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const sendEl = document.getElementById('send') as HTMLButtonElement;
const stopEl = document.getElementById('stop') as HTMLButtonElement;

const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys';

let history: ChatMessage[] = [];
let running = false;
let hasApiKey = false;
let pendingMessage: string | null = null;
/** 렌더러는 카탈로그를 빌드타임에 모른다. 설정 IPC 로 받아 여기에 담는다. */
let serviceCatalog: ServiceCatalogItemView[] = [];
/** 단가를 알아야 비용을 매긴다. 목록은 init 에서 한 번 받는다. */
let agentPresets: ModelPreset[] = [];
let usageTotal: UsageTotal = EMPTY_USAGE;

/** Electron IPC 가 붙이는 "Error invoking remote method 'x': Error: " 접두사를 걷어낸다. */
const readableError = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);

  return raw
    .replace(/^Error invoking remote method '[^']*':\s*/, '')
    .replace(/^(Error|AxiosError):\s*/, '')
    .trim();
};


type CardField = { placeholder: string; type?: 'text' | 'password' };

type CardOptions = {
  lead: string;
  fields: CardField[];
  submitLabel: string;
  skipLabel?: string;
  hint?: string;
  chips?: { label: string; onPick: () => void }[];
  onSubmit: (values: string[], setError: (message: string) => void) => Promise<boolean>;
  onSkip?: () => void;
};

/** 키·계정·로그인 카드가 전부 이 모양을 쓴다. 문구와 칸만 바뀐다. */
const appendCard = ({
  lead,
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

  const inputs: HTMLInputElement[] = [];

  if (fields.length > 0) {
    const form = document.createElement('div');
    form.className = 'card-form';

    fields.forEach((field) => {
      const input = document.createElement('input');
      input.type = field.type ?? 'text';
      input.placeholder = field.placeholder;
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

const clearEmptyState = () => {
  logEl.querySelector('.log-empty')?.remove();
};

const renderEmptyState = () => {
  const box = document.createElement('div');
  box.className = 'log-empty';

  const title = document.createElement('strong');
  title.textContent = EMPTY_STATE.title;

  const list = document.createElement('ul');
  EMPTY_STATE.samples.forEach((sample) => {
    const item = document.createElement('li');
    item.textContent = sample;

    const handlePick = () => {
      promptEl.value = sample;
      promptEl.focus();
    };

    item.addEventListener('click', handlePick);
    list.append(item);
  });

  box.append(title, list);
  logEl.append(box);
};

const isDefaultVoice = (role: string) => role === CHAT.roleAgent;

const appendEntry = (role: string, body: string, variant = '') => {
  clearEmptyState();
  const entry = document.createElement('div');
  entry.className = `entry ${variant}`.trim();

  const roleEl = document.createElement('div');
  roleEl.className = 'entry-role';
  roleEl.textContent = role;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'entry-body';

  if (variant === '' || variant === 'ask') {
    bodyEl.classList.add('rich');
    bodyEl.innerHTML = renderMarkdown(body);
  } else {
    bodyEl.textContent = body;
  }

  // 에이전트는 이 화면의 기본 목소리다. 말풍선마다 이름을 다시 붙이면 소음만 된다.
  // 도구 이름은 접기/펴기 손잡이를 겸하므로 남긴다.
  entry.append(...(isDefaultVoice(role) ? [bodyEl] : [roleEl, bodyEl]));

  if (variant === 'tool') {
    const handleToggle = () => entry.classList.toggle('open');
    roleEl.addEventListener('click', handleToggle);
    bodyEl.addEventListener('click', handleToggle);
    requestAnimationFrame(() => {
      if (bodyEl.scrollHeight > bodyEl.clientHeight) bodyEl.classList.add('clipped');
    });
  }

  logEl.append(entry);
  logEl.scrollTop = logEl.scrollHeight;
};

const renderModelOptions = (select: HTMLSelectElement, presets: ModelPreset[], selected: string) => {
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

const renderAccounts = (accounts: NaverAccount[]) => {
  accountListEl.replaceChildren(
    ...accounts.map((account) => {
      const item = document.createElement('li');

      const meta = document.createElement('div');
      meta.innerHTML = '';
      meta.textContent = account.label;

      const sub = document.createElement('span');
      sub.className = 'account-meta';
      sub.textContent = ` ${account.naverId} · ${account.hasPassword ? SETTINGS.accountPasswordSaved : SETTINGS.accountManualLogin}`;
      meta.append(sub);

      const remove = document.createElement('button');
      remove.className = 'ghost';
      remove.textContent = SETTINGS.accountRemoveLabel;

      const handleRemove = async () => {
        renderAccounts(await api.removeAccount(account.id));
      };
      remove.addEventListener('click', handleRemove);

      item.append(meta, remove);
      return item;
    }),
  );

  if (accounts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'account-meta';
    empty.textContent = SETTINGS.accountsEmpty;
    accountListEl.append(empty);
  }
};

/**
 * 설정에서 서비스 주소 칸을 뺐다(그냥 탭으로 여는 화면이라 배포 주소 기본값으로 충분하다).
 * 카탈로그 자체는 계속 받는다. 쿠키 로그인 카드와 연동 칩이 이 목록으로 그려진다.
 */
const applySettings = (settings: PublicSettings) => {
  serviceCatalog = settings.services;
};

const setRunning = (next: boolean) => {
  running = next;
  sendEl.disabled = next;
  sendEl.textContent = next ? CHAT.sendRunningLabel : CHAT.sendLabel;
  // 정지 버튼은 돌고 있을 때만 보인다. 새 실행마다 다시 누를 수 있어야 한다.
  stopEl.hidden = !next;
  if (next) stopEl.disabled = false;
  document.body.dataset.running = String(next);
};

/** 대화 안에서 살아 움직이는 실행 단계 한 줄. 시작할 때 만들고 끝날 때 그 자리를 고친다. */
const addStep = (name: string, detail: string) => {
  clearEmptyState();
  removeThinking();

  const step = document.createElement('div');
  step.className = 'step';
  step.dataset.state = 'running';
  step.dataset.name = name;

  const mark = document.createElement('span');
  mark.className = 'step-mark';

  const label = document.createElement('span');
  label.className = 'step-name shimmer';
  label.textContent = name;

  const detailEl = document.createElement('span');
  detailEl.className = 'step-detail';
  detailEl.textContent = detail;

  step.append(mark, label, detailEl);
  logEl.append(step);
  logEl.scrollTop = logEl.scrollHeight;

  return step;
};

const findRunningStep = (name: string) =>
  Array.from(logEl.querySelectorAll('.step[data-state="running"]'))
    .reverse()
    .find((el) => (el as HTMLElement).dataset.name === name) as HTMLElement | undefined ?? null;

const settleStep = (name: string, state: 'done' | 'error', detail: string) => {
  const step = findRunningStep(name) ?? addStep(name, '');

  step.dataset.state = state;
  step.querySelector('.step-name')?.classList.remove('shimmer');

  const detailEl = step.querySelector('.step-detail') as HTMLElement | null;
  if (!detailEl) return;

  const view = state === 'error' ? { summary: detail.replace(/\s+/g, ' ').trim() } : formatToolOutput(detail);
  detailEl.textContent = view.summary;

  if (view.html) {
    step.dataset.expandable = 'true';
    const handleToggle = () => {
      const opening = !detailEl.classList.contains('open');
      detailEl.classList.toggle('open', opening);

      if (opening) detailEl.innerHTML = view.html ?? '';
      else detailEl.textContent = view.summary;
    };
    step.addEventListener('click', handleToggle);
  }

  logEl.scrollTop = logEl.scrollHeight;
};

const addThinking = () => {
  if (logEl.querySelector('.step.thinking')) return;

  const step = document.createElement('div');
  step.className = 'step thinking';
  step.dataset.state = 'running';

  const mark = document.createElement('span');
  mark.className = 'step-mark';

  const label = document.createElement('span');
  label.className = 'step-name shimmer';
  label.textContent = CHAT.thinking;

  step.append(mark, label);
  logEl.append(step);
  logEl.scrollTop = logEl.scrollHeight;
};

const removeThinking = () => {
  logEl.querySelector('.step.thinking')?.remove();
};

const QUIET_INPUT_KEYS = new Set(['reason', 'question', 'body']);

const summarizeInput = (input: Record<string, unknown>) => {
  const entries = Object.entries(input).filter(
    ([k, v]) => v !== undefined && v !== '' && !QUIET_INPUT_KEYS.has(k),
  );
  if (entries.length === 0) return '';

  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')
    .slice(0, 240);
};

/** 누적 토큰과 대략적인 비용. 단가를 모르면 토큰만 보여준다. */
const renderUsageChip = () => {
  const tokens = totalTokens(usageTotal);

  if (tokens === 0) {
    chipUsageEl.hidden = true;
    return;
  }

  const price = agentPresets.find(({ id }) => id === agentModelEl.value);
  const cost = usageCost(usageTotal, price);
  const label = formatTokenCount(tokens);

  chipUsageEl.hidden = false;
  chipUsageEl.title = CHAT.usageChipTitle;
  chipUsageEl.textContent =
    cost === null ? CHAT.usageChip(label) : CHAT.usageChipWithCost(label, formatCost(cost));
};

const handleAgentEvent = (event: AgentEvent) => {
  if (event.type === 'assistant' && event.text.trim()) {
    removeThinking();
    appendEntry(CHAT.roleAgent, event.text);
  }
  if (event.type === 'tool_start') addStep(event.name, summarizeInput(event.input));
  if (event.type === 'tool_end') settleStep(event.name, 'done', event.output);
  if (event.type === 'tool_error') settleStep(event.name, 'error', event.message);
  if (event.type === 'usage') {
    usageTotal = addUsage(usageTotal, event);
    renderUsageChip();
  }
  if (event.type === 'done') {
    removeThinking();

    if (event.reason === 'max_iterations') appendEntry(CHAT.roleAgent, CHAT.stoppedTooLong, 'error');
    else if (event.reason === 'cancelled') appendEntry(CHAT.roleSystem, CHAT.cancelled);
    // 모델이 content 없이 툴콜도 없이 끝내면 화면에 아무것도 안 남는다. 그때만 폴백을 찍는다.
    else if (!event.hadOutput) appendEntry(CHAT.roleAgent, CHAT.noOutput, 'error');
  }
};

const renderQuestionAsk = ({ id, question, choices }: AgentQuestion) => {
  clearEmptyState();
  removeThinking();

  const entry = document.createElement('div');
  entry.className = 'entry question';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'entry-body';
  bodyEl.textContent = question;

  const answerRow = document.createElement('div');
  answerRow.className = 'row answer-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = CHAT.answerPlaceholder;

  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.textContent = CHAT.answerSubmitLabel;

  const settle = async (answer: string) => {
    if (!answer.trim()) return;

    answerRow.remove();
    appendEntry(CHAT.roleUser, answer, 'user');

    // 만료된 질문은 메인이 false 를 준다. 삭제 확인 카드에서 이걸 삼키면 승인했다고 오해한다.
    const accepted = await api.answerAgent(id, answer);
    if (!accepted) appendEntry(CHAT.roleSystem, CHAT.answerExpired, 'error');
  };

  const handleSubmitAnswer = () => {
    void settle(input.value);
  };
  const handleAnswerKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') handleSubmitAnswer();
  };

  submit.addEventListener('click', handleSubmitAnswer);
  input.addEventListener('keydown', handleAnswerKeydown);

  entry.append(bodyEl);

  if (choices?.length) {
    const choiceRow = document.createElement('div');
    choiceRow.className = 'choices';

    choices.forEach((choice) => {
      const button = document.createElement('button');
      button.className = 'ghost';
      button.textContent = choice;

      const handleChoice = () => {
        void settle(choice);
      };
      button.addEventListener('click', handleChoice);
      choiceRow.append(button);
    });

    answerRow.append(choiceRow);
  }

  answerRow.append(input, submit);
  entry.append(answerRow);
  logEl.append(entry);
  logEl.scrollTop = logEl.scrollHeight;
  input.focus();
};

type FormControl = HTMLInputElement | HTMLSelectElement;

const buildFormControl = (field: QuestionField): FormControl => {
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

const renderQuestionForm = ({ id, question, fields = [] }: AgentQuestion) => {
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

const renderQuestion = (payload: AgentQuestion) => {
  if (payload.fields?.length) renderQuestionForm(payload);
  else renderQuestionAsk(payload);
};

const requestApiKey = (lead: string) => {
  appendCard({
    lead,
    fields: [{ placeholder: ONBOARDING.apiKeyPlaceholder, type: 'password' }],
    submitLabel: ONBOARDING.apiKeySaveLabel,
    skipLabel: ONBOARDING.apiKeyIssueLabel,
    hint: ONBOARDING.apiKeyHint,
    onSubmit: async ([value], setError) => {
      if (!value?.trim()) return false;

      try {
        const settings = await api.setApiKey(value.trim());
        hasApiKey = settings.hasApiKey;
        appendEntry(CHAT.roleAgent, ONBOARDING.apiKeySaved);

        if (pendingMessage) {
          const next = pendingMessage;
          pendingMessage = null;
          void runMessage(next);
          return true;
        }

        const accounts = await api.listAccounts();
        if (accounts.length === 0) {
          requestAccount(ONBOARDING.askAccountAfterKey);
        } else {
          appendEntry(CHAT.roleAgent, ONBOARDING.ready);
        }

        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      void api.createTab({ url: OPENROUTER_KEYS_URL });
    },
  });
};

const requestAccount = (lead: string) => {
  appendCard({
    lead,
    fields: [
      { placeholder: ONBOARDING.accountIdPlaceholder },
      { placeholder: ONBOARDING.accountPwPlaceholder, type: 'password' },
    ],
    submitLabel: ONBOARDING.accountSaveLabel,
    hint: ONBOARDING.accountHint,
    onSubmit: async ([naverId, password], setError) => {
      if (!naverId?.trim()) return false;

      try {
        const accounts = await api.addAccount({
          label: naverId.trim(),
          naverId: naverId.trim(),
          password: password || undefined,
        });

        renderAccounts(accounts);
        appendEntry(CHAT.roleAgent, ONBOARDING.accountSaved(naverId.trim()));

        const settings = await api.getSettings();
        if (!settings.hasSchedulerToken) requestServiceLogin(ONBOARDING.askServiceLogin);

        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      appendEntry(CHAT.roleAgent, ONBOARDING.accountSkipped);
      void api.getSettings().then((settings) => {
        if (!settings.hasSchedulerToken) requestServiceLogin(ONBOARDING.askServiceLogin);
      });
    },
  });
};

/** 에이전트가 dabut_login 을 부르면 이 카드가 뜬다. 끝나면 결과를 메인으로 돌려준다. */
const requestAgentDabutLogin = ({ id, reason }: { id: number; reason: string }) => {
  // 대기가 10분을 넘기면 메인이 false 를 준다. 그대로 삼키면 사용자는 눌렀는데 아무 일도
  // 안 일어난 것처럼 보이고, 스피너만 계속 돈다.
  const finish = async (result: string) => {
    const accepted = await api.answerDabutLogin(id, result);

    if (accepted) {
      addThinking();
      return;
    }

    appendEntry(CHAT.roleSystem, CHAT.answerExpired, 'error');
  };

  appendCard({
    lead: reason.trim() || ONBOARDING.askServiceLogin,
    fields: [
      { placeholder: SETTINGS.serviceUserPlaceholder },
      { placeholder: SETTINGS.servicePassPlaceholder, type: 'password' },
    ],
    submitLabel: SETTINGS.serviceLoginLabel,
    hint: SETTINGS.serviceLoginHint,
    onSubmit: async ([username, password], setError) => {
      if (!username?.trim() || !password) return false;

      try {
        const settings = await api.loginDabut({ username: username.trim(), password });
        renderSchedulerStatus(settings);
        void refreshServiceChip();
        appendEntry(CHAT.roleAgent, ONBOARDING.serviceLoginSaved(settings.schedulerLabel));
        await finish(`로그인 성공: ${settings.schedulerLabel}`);
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      void finish('사용자가 로그인을 건너뛰었다');
    },
  });
};

const requestServiceLogin = (lead: string) => {
  appendCard({
    lead,
    fields: [
      { placeholder: SETTINGS.serviceUserPlaceholder },
      { placeholder: SETTINGS.servicePassPlaceholder, type: 'password' },
    ],
    submitLabel: SETTINGS.serviceLoginLabel,
    hint: SETTINGS.serviceLoginHint,
    onSubmit: async ([username, password], setError) => {
      if (!username?.trim() || !password) return false;

      try {
        const settings = await api.loginDabut({ username: username.trim(), password });
        appendEntry(CHAT.roleAgent, ONBOARDING.serviceLoginSaved(settings.schedulerLabel));
        renderSchedulerStatus(settings);
        void refreshServiceChip();
        requestCookieLogin();
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: requestCookieLogin,
  });
};

const requestCookieLogin = () => {
  const services = cookieLoginServices(serviceCatalog);

  if (services.length === 0) {
    appendEntry(CHAT.roleAgent, ONBOARDING.ready);
    return;
  }

  appendCard({
    lead: ONBOARDING.askCookieLogin,
    fields: [],
    submitLabel: ONBOARDING.accountSkipLabel,
    skipLabel: '',
    hint: ONBOARDING.cookieLoginDone,
    chips: services.map(({ name, url }) => ({
      label: name,
      onPick: () => {
        void api.createTab({ url });
      },
    })),
    onSubmit: async () => {
      appendEntry(CHAT.roleAgent, ONBOARDING.ready);
      return true;
    },
  });
};

const runMessage = async (message: string) => {
  setRunning(true);
  addThinking();

  try {
    history = await api.runAgent(message, history);
  } catch (error) {
    appendEntry(CHAT.roleSystem, readableError(error), 'error');
  } finally {
    removeThinking();
    setRunning(false);
  }
};

const handleSettingsToggle = () => {
  settingsEl.hidden = !settingsEl.hidden;
};

const handleModelChipClick = () => {
  settingsEl.hidden = false;
  agentModelEl.focus();
};

/** 칩이 곧 설정으로 가는 문이다. 남은 연동 값은 노출지기 저장소 경로와 다붓 계정이다. */
const handleServiceChipClick = () => {
  settingsEl.hidden = false;
  epExposureEl.scrollIntoView({ block: 'nearest' });
  epExposureEl.focus();
};

const handleSchedulerPassKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') void handleSchedulerLogin();
};

const handleSaveKey = async () => {
  try {
    const settings = await api.setApiKey(apiKeyEl.value);
    apiKeyEl.value = '';
    keyStatusEl.textContent = settings.hasApiKey ? SETTINGS.keyStatusSaved : SETTINGS.keyStatusMissing;
  } catch (error) {
    keyStatusEl.textContent = error instanceof Error ? error.message : String(error);
  }
};

const handleAgentModelChange = () => {
  chipModelEl.textContent = shortModel(agentModelEl.value);
  void api.setModels({ agentModel: agentModelEl.value });
};

const handleWriterModelChange = () => {
  void api.setModels({ writerModel: writerModelEl.value });
};

const handleSaveEndpoints = async () => {
  try {
    const settings = await api.setEndpoints({
      dabutBaseUrl: epDabutEl.value.trim(),
      schedulerBaseUrl: epSchedulerEl.value.trim(),
      exposureBotDir: epExposureEl.value.trim(),
    });

    endpointStatusEl.textContent = settings.endpoints.exposureBotDir
      ? SETTINGS.endpointsSaved
      : SETTINGS.exposurePathMissing;
    void refreshServiceChip();
  } catch (error) {
    endpointStatusEl.textContent = readableError(error);
  }
};

const renderSchedulerStatus = (settings: PublicSettings) => {
  schStatusEl.textContent = settings.hasSchedulerToken
    ? SETTINGS.serviceLoggedIn(settings.schedulerLabel)
    : SETTINGS.serviceLoginHint;
};

const handleSchedulerLogin = async () => {
  const username = schUserEl.value.trim();
  if (!username || !schPassEl.value) return;

  schLoginEl.disabled = true;

  try {
    const settings = await api.loginDabut({ username, password: schPassEl.value });
    schPassEl.value = '';
    renderSchedulerStatus(settings);
    void refreshServiceChip();
  } catch (error) {
    schStatusEl.textContent = readableError(error);
  } finally {
    schLoginEl.disabled = false;
  }
};

const handleAddAccount = async () => {
  try {
    const accounts = await api.addAccount({
      label: accountLabelEl.value,
      naverId: accountIdEl.value,
      password: accountPwEl.value || undefined,
    });

    accountLabelEl.value = '';
    accountIdEl.value = '';
    accountPwEl.value = '';
    renderAccounts(accounts);

    if (accounts.length === 1) {
      clearEmptyState();
      appendEntry(CHAT.roleAgent, ONBOARDING.accountSaved(accounts[0]?.naverId ?? ''));
    }
  } catch (error) {
    appendEntry(CHAT.roleSystem, readableError(error), 'error');
  }
};

const handleSubmit = async (event: Event) => {
  event.preventDefault();

  const message = promptEl.value.trim();
  if (!message || running) return;

  promptEl.value = '';
  appendEntry(CHAT.roleUser, message, 'user');

  if (!hasApiKey) {
    pendingMessage = message;
    requestApiKey(ONBOARDING.askApiKeyMidTask);
    return;
  }

  await runMessage(message);
};

const handlePromptKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void handleSubmit(event);
  }
};

/** 한 번만 누를 수 있게 잠근다. 실제 정지는 다음 반복에서 일어난다. */
const handleStopClick = () => {
  stopEl.disabled = true;
  appendEntry(CHAT.roleSystem, CHAT.cancelRequested);
  void api.cancelAgent();
};

const PLACEHOLDERS: Record<string, string> = {
  apiKeyPlaceholder: ONBOARDING.apiKeyPlaceholder,
  accountIdPlaceholder: ONBOARDING.accountIdPlaceholder,
  accountPwPlaceholder: ONBOARDING.accountPwPlaceholder,
  accountLabelPlaceholder: PANEL.accountLabelPlaceholder,
  dabutPlaceholder: PANEL.dabutPlaceholder,
  schedulerPlaceholder: PANEL.schedulerPlaceholder,
  exposurePlaceholder: PANEL.exposurePlaceholder,
  composerPlaceholder: CHAT.composerPlaceholder,
  serviceUserPlaceholder: SETTINGS.serviceUserPlaceholder,
  servicePassPlaceholder: SETTINGS.servicePassPlaceholder,
};

const shortModel = (id: string) => id.split('/').pop() ?? id;

const renderChips = (settings: PublicSettings) => {
  chipModelEl.textContent = shortModel(settings.agentModel);
  chipModelEl.title = CHAT.modelChipTitle;
};

/** 칩만 다시 그린다. 설정 화면의 다른 입력칸은 건드리지 않는다. */
const refreshServiceChip = async () => {
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

const applyStaticLabels = () => {
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('panel-title', PANEL.title);
  set('settings-toggle', PANEL.settingsToggle);
  set('lbl-apikey', PANEL.apiKeyField);
  set('save-key', ONBOARDING.apiKeySaveLabel);
  set('lbl-agent-model', PANEL.agentModelField);
  set('lbl-writer-model', PANEL.writerModelField);
  set('lbl-endpoints', PANEL.endpointsField);
  set('save-endpoints', PANEL.endpointsSaveLabel);
  set('endpoint-hint', SETTINGS.endpointsHint);
  set('lbl-scheduler', SETTINGS.serviceLoginField);
  set('sch-login', SETTINGS.serviceLoginLabel);
  set('lbl-accounts', PANEL.accountsField);
  set('add-account', PANEL.accountAddLabel);
  set('account-hint', ONBOARDING.accountHint);
  set('composer-hint', CHAT.composerHint);
  set('send', CHAT.sendLabel);
  set('stop', CHAT.stopLabel);

  sendEl.setAttribute('aria-label', CHAT.composerPlaceholder);
  stopEl.setAttribute('aria-label', CHAT.stopTitle);
  stopEl.title = CHAT.stopTitle;

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-ph]').forEach((el) => {
    const key = el.dataset.ph ?? '';
    if (PLACEHOLDERS[key]) el.placeholder = PLACEHOLDERS[key];
  });
};

const init = async () => {
  applyStaticLabels();
  // 실행 중에 패널이 리로드되면 여기서만 상태를 되찾을 수 있다. 안 물어보면 정지 버튼도 안 뜨고
  // 메시지를 보내면 agentBusy 로 튕긴다.
  const [settings, models, accounts, status] = await Promise.all([
    api.getSettings(),
    api.listModels(),
    api.listAccounts(),
    api.getAgentStatus(),
  ]);

  hasApiKey = settings.hasApiKey;
  agentPresets = models.agent;
  keyStatusEl.textContent = settings.hasApiKey ? SETTINGS.keyStatusSaved : SETTINGS.keyStatusMissing;
  renderModelOptions(agentModelEl, models.agent, settings.agentModel);
  renderModelOptions(writerModelEl, models.writer, settings.writerModel);
  renderAccounts(accounts);

  epDabutEl.value = settings.endpoints.dabutBaseUrl;
  epSchedulerEl.value = settings.endpoints.schedulerBaseUrl;
  epExposureEl.value = settings.endpoints.exposureBotDir;
  endpointStatusEl.textContent = settings.endpoints.exposureBotDir
    ? SETTINGS.endpointsSaved
    : SETTINGS.exposurePathMissing;
  applySettings(settings);

  renderChips(settings);
  renderSchedulerStatus(settings);
  void refreshServiceChip();

  settingsEl.hidden = true;

  if (!hasApiKey) {
    requestApiKey(ONBOARDING.askApiKeyFirst);
  } else if (accounts.length === 0) {
    requestAccount(ONBOARDING.askAccountOnStart);
  } else {
    appendEntry(CHAT.roleAgent, ONBOARDING.readyShort);
  }

  if (hasApiKey && accounts.length > 0) renderEmptyState();

  setRunning(status.running);

  api.onAgentRunning(setRunning);
  api.onAgentEvent(handleAgentEvent);
  api.onAgentProgress((message) => {
    const running = logEl.querySelector('.step[data-state="running"]:not(.thinking)');
    const detail = running?.querySelector('.step-detail') as HTMLElement | null | undefined;
    if (detail) detail.textContent = message;
    else addStep(CHAT.roleProgress, message);
  });
  api.onAgentQuestion(renderQuestion);
  api.onDabutLoginRequest(requestAgentDabutLogin);
};

settingsToggleEl.addEventListener('click', handleSettingsToggle);
chipModelEl.addEventListener('click', handleModelChipClick);
chipServicesEl.addEventListener('click', handleServiceChipClick);
saveKeyEl.addEventListener('click', handleSaveKey);
agentModelEl.addEventListener('change', handleAgentModelChange);
writerModelEl.addEventListener('change', handleWriterModelChange);
saveEndpointsEl.addEventListener('click', handleSaveEndpoints);
schLoginEl.addEventListener('click', handleSchedulerLogin);
schPassEl.addEventListener('keydown', handleSchedulerPassKeydown);
addAccountEl.addEventListener('click', handleAddAccount);
composerEl.addEventListener('submit', handleSubmit);
promptEl.addEventListener('keydown', handlePromptKeydown);
stopEl.addEventListener('click', handleStopClick);

void init();

export {};
