import type { AgentQuestion } from '../bridge';
import { renderQuestionAsk } from './question-ask';
import { renderQuestionForm } from './question-form-render';

export const renderQuestion = (payload: AgentQuestion) => {
  if (payload.fields?.length) renderQuestionForm(payload);
  else renderQuestionAsk(payload);
};
