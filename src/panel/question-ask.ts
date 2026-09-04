import type { AgentQuestion } from '../bridge';
import { CHAT } from '../messages';
import { api, logEl } from './dom';
import { clearEmptyState } from './chat-log';
import { removeThinking } from './thinking';
import { appendEntry } from './chat-log';

export const renderQuestionAsk = ({ id, question, choices }: AgentQuestion) => {
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
