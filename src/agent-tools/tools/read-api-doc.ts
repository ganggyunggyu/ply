import type { ToolSpec } from '../../openrouter';
import { TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { API_DOC_TOPICS, isApiDocTopic, readApiDoc } from '../../api-docs';
import type { ToolRuntime } from '../runtime';

export const createReadApiDocTools = (runtime: ToolRuntime): [ToolSpec] => {
  const readApiDocTool: ToolSpec = {
    name: 'read_api_doc',
    description: DESC.readApiDoc,
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', enum: [...API_DOC_TOPICS], description: PARAM.apiDocTopic },
        section: { type: 'string', description: PARAM.apiDocSection },
      },
      additionalProperties: false,
    },
    run: async ({ topic, section }) => {
      const wanted = topic === undefined || topic === null ? '' : String(topic).trim();
      const part = section === undefined || section === null ? '' : String(section).trim();

      if (wanted && !isApiDocTopic(wanted)) return readApiDoc(wanted);

      return readApiDoc(wanted || undefined, part || undefined);
    },
  };

  return [readApiDocTool];
};
