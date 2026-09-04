import { renderMarkdown } from '../markdown';
import { CHAT, EMPTY_STATE } from '../messages';
import { logEl, promptEl } from './dom';

export const clearEmptyState = () => {
  logEl.querySelector('.log-empty')?.remove();
};

export const renderEmptyState = () => {
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

export const appendEntry = (role: string, body: string, variant = '') => {
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
