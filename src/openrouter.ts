import axios, { type AxiosInstance } from 'axios';
import { ERRORS } from './messages';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const APP_REFERER = 'https://github.com/ganggyunggyu/gng-browser';
const APP_TITLE = 'GNG Browser';

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<string>;
};

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

export type AgentEvent =
  | { type: 'assistant'; text: string }
  | { type: 'tool_start'; name: string; input: Record<string, unknown> }
  | { type: 'tool_end'; name: string; output: string }
  | { type: 'tool_error'; name: string; message: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'done'; reason: 'end' | 'max_iterations' };

export const toOpenAiTools = (tools: ToolSpec[]) =>
  tools.map(({ name, description, parameters }) => ({
    type: 'function' as const,
    function: { name, description, parameters },
  }));

export const parseToolArguments = (raw: string): Record<string, unknown> => {
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error(ERRORS.toolArgsUnparsable(raw.slice(0, 200)));
  }
};

export const createOpenRouterClient = (apiKey: string): AxiosInstance =>
  axios.create({
    baseURL: OPENROUTER_BASE_URL,
    timeout: 180_000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': APP_REFERER,
      'X-Title': APP_TITLE,
      'Content-Type': 'application/json',
    },
  });

/** OpenRouter 가 돌려주는 HTTP 오류를 사람이 읽을 문장으로 바꾼다. */
export const describeRequestError = (error: unknown, model: string): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const status = error.response?.status;
  const detail = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;

  if (status === 401 || status === 403) return ERRORS.apiKeyRejected;
  if (status === 402) return ERRORS.apiKeyNoCredit;
  if (status === 429) return ERRORS.apiKeyRateLimited;
  if (status === 404) return ERRORS.modelUnavailable(model);
  if (status && status >= 500) return ERRORS.openRouterDown;
  if (!error.response) return ERRORS.networkUnreachable;

  return detail ? `${ERRORS.openRouterDown} (${detail})` : ERRORS.openRouterDown;
};

export const requestCompletion = async ({
  client,
  model,
  messages,
  tools,
}: {
  client: AxiosInstance;
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
}) => {
  const body: Record<string, unknown> = { model, messages };

  if (tools?.length) {
    body.tools = toOpenAiTools(tools);
    body.tool_choice = 'auto';
  }

  let data: {
    choices?: { message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason: string }[];
    usage?: Usage;
  };

  try {
    ({ data } = await client.post('/chat/completions', body));
  } catch (error) {
    throw new Error(describeRequestError(error, model));
  }

  const choice = data?.choices?.[0];

  if (!choice) throw new Error(ERRORS.openRouterNoChoices);

  return {
    message: choice.message as { content: string | null; tool_calls?: ToolCall[] },
    finishReason: choice.finish_reason as string,
    usage: (data.usage ?? {}) as Usage,
  };
};

export const generateText = async ({
  client,
  model,
  system,
  prompt,
}: {
  client: AxiosInstance;
  model: string;
  system: string;
  prompt: string;
}) => {
  const { message } = await requestCompletion({
    client,
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  });

  return message.content ?? '';
};

export const runAgentLoop = async ({
  client,
  model,
  system,
  tools,
  history,
  onEvent,
  maxIterations = 24,
}: {
  client: AxiosInstance;
  model: string;
  system: string;
  tools: ToolSpec[];
  history: ChatMessage[];
  onEvent: (event: AgentEvent) => void;
  maxIterations?: number;
}) => {
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history];
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const { message, usage } = await requestCompletion({ client, model, messages, tools });

    if (usage.prompt_tokens || usage.completion_tokens) {
      onEvent({
        type: 'usage',
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
      });
    }

    if (message.content) onEvent({ type: 'assistant', text: message.content });

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      messages.push({ role: 'assistant', content: message.content ?? '' });
      onEvent({ type: 'done', reason: 'end' });
      return messages;
    }

    messages.push({ role: 'assistant', content: message.content, tool_calls: toolCalls });

    for (const call of toolCalls) {
      const tool = toolByName.get(call.function.name);

      if (!tool) {
        const errorText = `알 수 없는 도구: ${call.function.name}`;
        onEvent({ type: 'tool_error', name: call.function.name, message: errorText });
        messages.push({ role: 'tool', tool_call_id: call.id, content: errorText });
        continue;
      }

      let input: Record<string, unknown> = {};

      try {
        input = parseToolArguments(call.function.arguments);
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);
        onEvent({ type: 'tool_error', name: tool.name, message: errorText });
        messages.push({ role: 'tool', tool_call_id: call.id, content: errorText });
        continue;
      }

      onEvent({ type: 'tool_start', name: tool.name, input });

      try {
        const output = await tool.run(input);
        onEvent({ type: 'tool_end', name: tool.name, output });
        messages.push({ role: 'tool', tool_call_id: call.id, content: output });
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);
        onEvent({ type: 'tool_error', name: tool.name, message: errorText });
        messages.push({ role: 'tool', tool_call_id: call.id, content: `실패: ${errorText}` });
      }
    }
  }

  onEvent({ type: 'done', reason: 'max_iterations' });

  return messages;
};
