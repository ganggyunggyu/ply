import type { ToolSpec } from '../../openrouter';
import {
  TOOL_DESCRIPTIONS as DESC,
  PARAM_DESCRIPTIONS as PARAM,
  buildManuscriptPrompt,
  MANUSCRIPT_SYSTEM,
} from '../../prompts';
import { PROGRESS } from '../../messages';
import { generateText } from '../../openrouter';
import { splitManuscript } from '../manuscript';
import type { ToolRuntime } from '../runtime';

export const createGenerateManuscriptTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { onProgress, client, writerModel, signal } = runtime;

  const generateManuscript: ToolSpec = {
    name: 'generate_manuscript',
    description: DESC.generateManuscript,
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: PARAM.keyword },
        tone: { type: 'string', description: PARAM.tone },
        angle: { type: 'string', description: PARAM.angle },
      },
      required: ['keyword'],
      additionalProperties: false,
    },
    run: async ({ keyword, tone, angle }) => {
      onProgress(PROGRESS.manuscriptGenerating(String(keyword)));

      const prompt = buildManuscriptPrompt({
        keyword: String(keyword),
        tone: tone ? String(tone) : undefined,
        angle: angle ? String(angle) : undefined,
      });

      const raw = await generateText({
        client,
        model: writerModel,
        system: MANUSCRIPT_SYSTEM,
        prompt,
        signal,
      });
      const { title, body } = splitManuscript(raw);

      return JSON.stringify({ title, body });
    },
  };

  return [generateManuscript];
};
