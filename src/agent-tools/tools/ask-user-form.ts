import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { QUESTION_FIELD_TYPES } from '../../constants';
import { normalizeQuestionFields } from '../question-fields';
import { parseFormAnswer, formatFormAnswer } from '../form-answer';
import type { ToolRuntime } from '../runtime';

export const createAskUserFormTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { askUserForm } = runtime;

  const askUserFormTool: ToolSpec = {
    name: 'ask_user_form',
    description: DESC.askUserForm,
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: PARAM.question },
        fields: {
          type: 'array',
          description: PARAM.formFields,
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              placeholder: { type: 'string' },
              type: { type: 'string', enum: [...QUESTION_FIELD_TYPES] },
              choices: {
                type: 'array',
                description: PARAM.formChoiceItems,
                items: {
                  type: 'object',
                  properties: { label: { type: 'string' }, value: { type: 'string' } },
                  required: ['label', 'value'],
                  additionalProperties: false,
                },
              },
              value: { type: 'string' },
              optional: { type: 'boolean' },
            },
            required: ['key', 'label'],
            additionalProperties: false,
          },
        },
      },
      required: ['question', 'fields'],
      additionalProperties: false,
    },
    run: async ({ question, fields }) => {
      if (!Array.isArray(fields) || fields.length === 0) return RESULT.formNoFields;

      const checked = normalizeQuestionFields(fields);
      if (!checked.ok) {
        return checked.reason === 'prefill'
          ? RESULT.formPrefillNotInChoices(checked.key)
          : RESULT.formBadFields;
      }

      try {
        const answer = parseFormAnswer(await askUserForm(String(question), checked.fields));
        if (answer.cancelled) return RESULT.formCancelled;

        const lines = formatFormAnswer(checked.fields, answer.values);
        // 전부 비운 채 확인을 누른 것은 답이 아니다. 빈 줄을 답변으로 넘기면 모델이 추측으로 잇는다.
        if (lines.length === 0) return RESULT.formEmptyAnswer;

        return RESULT.userAnsweredForm(lines);
      } catch {
        return RESULT.userDidNotAnswer;
      }
    },
  };


  return [askUserFormTool];
};
