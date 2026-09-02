import { renderMarkdown } from './markdown';
import { formatToolOutput } from './tool-output';
import { SERVICE_CATALOG } from './services';
import { CHAT, EMPTY_STATE, ONBOARDING, PANEL, SETTINGS } from './messages';
import type {
  AgentEventView,
  AgentQuestion,
  ChatMessageView,
  ModelPresetView,
  NaverAccount,
  PublicSettings,
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
const chipServicesEl = document.getElementById('chip-services') as HTMLSpanElement;
const schUserEl = document.getElementById('sch-user') as HTMLInputElement;
const schPassEl = document.getElementById('sch-pass') as HTMLInputElement;
const schLoginEl = document.getElementById('sch-login') as HTMLButtonElement;
const schStatusEl = document.getElementById('sch-status') as HTMLElement;
const logEl = document.getElementById('log') as HTMLElement;
const composerEl = document.getElementById('composer') as HTMLFormElement;
const promptEl = document.getElementById('prompt') as HTMLTextAreaElement;
const sendEl = document.getElementById('send') as HTMLButtonElement;

const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys';

let history: ChatMessage[] = [];
let running = false;
let hasApiKey = false;
let pendingMessage: string | null = null;

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

const setRunning = (next: boolean) => {
  running = next;
  sendEl.disabled = next;
  sendEl.textContent = next ? CHAT.sendRunningLabel : CHAT.sendLabel;
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

const handleAgentEvent = (event: AgentEvent) => {
  if (event.type === 'assistant' && event.text.trim()) {
    removeThinking();
    appendEntry(CHAT.roleAgent, event.text);
  }
  if (event.type === 'tool_start') addStep(event.name, summarizeInput(event.input));
  if (event.type === 'tool_end') settleStep(event.name, 'done', event.output);
  if (event.type === 'tool_error') settleStep(event.name, 'error', event.message);
  if (event.type === 'done') {
    removeThinking();
    if (event.reason === 'max_iterations') appendEntry(CHAT.roleAgent, CHAT.stoppedTooLong, 'error');
  }
};

const renderQuestion = ({ id, question, choices }: AgentQuestion) => {
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
        if (accounts.length === 0) requestAccount(ONBOARDING.askAccountAfterKey);
        else appendEntry(CHAT.roleAgent, ONBOARDING.ready);

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
  const finish = (result: string) => {
    void api.answerDabutLogin(id, result);
    addThinking();
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
        finish(`로그인 성공: ${settings.schedulerLabel}`);
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => finish('사용자가 로그인을 건너뛰었다'),
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
  appendCard({
    lead: ONBOARDING.askCookieLogin,
    fields: [],
    submitLabel: ONBOARDING.accountSkipLabel,
    skipLabel: '',
    hint: ONBOARDING.cookieLoginDone,
    chips: SERVICE_CATALOG.filter((s) => s.auth === 'cookie' && s.kind === 'ui').map((service) => ({
      label: service.name,
      onPick: () => {
        void api.createTab({ url: service.url });
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

const refreshServiceChip = async () => {
  try {
    const endpoints = await api.getEndpoints();
    const configured = [
      endpoints.dabutBaseUrl,
      endpoints.schedulerBaseUrl,
      endpoints.exposureBotDir,
    ].filter(Boolean).length;

    chipServicesEl.replaceChildren();

    [endpoints.dabutBaseUrl, endpoints.schedulerBaseUrl, endpoints.exposureBotDir].forEach((value) => {
      const dot = document.createElement('i');
      dot.className = value ? 'up' : 'down';
      chipServicesEl.append(dot);
    });

    const label = document.createElement('span');
    label.textContent = CHAT.servicesUp(configured, 3);
    chipServicesEl.append(label);
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
  set('lbl-scheduler', SETTINGS.serviceLoginField);
  set('sch-login', SETTINGS.serviceLoginLabel);
  set('lbl-accounts', PANEL.accountsField);
  set('add-account', PANEL.accountAddLabel);
  set('account-hint', ONBOARDING.accountHint);
  set('composer-hint', CHAT.composerHint);
  set('send', CHAT.sendLabel);

  sendEl.setAttribute('aria-label', CHAT.composerPlaceholder);

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-ph]').forEach((el) => {
    const key = el.dataset.ph ?? '';
    if (PLACEHOLDERS[key]) el.placeholder = PLACEHOLDERS[key];
  });
};

const init = async () => {
  applyStaticLabels();
  const [settings, models, accounts] = await Promise.all([
    api.getSettings(),
    api.listModels(),
    api.listAccounts(),
  ]);

  hasApiKey = settings.hasApiKey;
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
chipModelEl.addEventListener('click', () => {
  settingsEl.hidden = false;
  agentModelEl.focus();
});
saveKeyEl.addEventListener('click', handleSaveKey);
agentModelEl.addEventListener('change', handleAgentModelChange);
writerModelEl.addEventListener('change', handleWriterModelChange);
saveEndpointsEl.addEventListener('click', handleSaveEndpoints);
schLoginEl.addEventListener('click', handleSchedulerLogin);
schPassEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void handleSchedulerLogin();
});
addAccountEl.addEventListener('click', handleAddAccount);
composerEl.addEventListener('submit', handleSubmit);
promptEl.addEventListener('keydown', handlePromptKeydown);

void init();

export {};
