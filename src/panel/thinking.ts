import { CHAT } from '../messages';
import { logEl } from './dom';

export const addThinking = () => {
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

export const removeThinking = () => {
  logEl.querySelector('.step.thinking')?.remove();
};
