import { formatToolOutput } from '../tool-output';
import { logEl } from './dom';
import { clearEmptyState } from './chat-log';
import { removeThinking } from './thinking';

/** 대화 안에서 살아 움직이는 실행 단계 한 줄. 시작할 때 만들고 끝날 때 그 자리를 고친다. */
export const addStep = (name: string, detail: string) => {
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

export const findRunningStep = (name: string) =>
  Array.from(logEl.querySelectorAll('.step[data-state="running"]'))
    .reverse()
    .find((el) => (el as HTMLElement).dataset.name === name) as HTMLElement | undefined ?? null;

export const settleStep = (name: string, state: 'done' | 'error', detail: string) => {
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
