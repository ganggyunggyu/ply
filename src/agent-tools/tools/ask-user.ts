import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import type { ToolRuntime } from '../runtime';

export const createAskUserTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { askUser } = runtime;

  const askUserTool: ToolSpec = {
    name: 'ask_user',
    description:
      DESC.askUser,
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: PARAM.question },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: PARAM.choices,
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
    run: async ({ question, choices }) => {
      const options = Array.isArray(choices) ? choices.map(String) : undefined;

      try {
        return RESULT.userAnswered(await askUser(String(question), options));
      } catch {
        return RESULT.userDidNotAnswer;
      }
    },
  };


  return [askUserTool];
};
