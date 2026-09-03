import axios, { type AxiosInstance } from 'axios';
import { APP_NAME } from './constants';
import { ERRORS } from './messages';
import { TOOL_RESULTS as RESULT } from './prompts';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const APP_REFERER = 'https://github.com/ganggyunggyu/ply';
const APP_TITLE = APP_NAME;

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
  /** hadOutput 은 이번 실행에서 assistant 텍스트를 한 번이라도 냈는지다. 화면이 빈 채 끝나는 걸 막는다. */
  | { type: 'done'; reason: 'end' | 'max_iterations' | 'cancelled'; hadOutput: boolean };

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
  if (status === 400) return detail ? `${ERRORS.requestRejected} (${detail})` : ERRORS.requestRejected;
  if (status && status >= 500) return ERRORS.openRouterDown;
  if (!error.response) return ERRORS.networkUnreachable;

  return detail ? `${ERRORS.openRouterDown} (${detail})` : ERRORS.openRouterDown;
};

export const requestCompletion = async ({
  client,
  model,
  messages,
  tools,
  signal,
}: {
  client: AxiosInstance;
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  signal?: AbortSignal;
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
    // 대기 중인 completion 은 즉시 끊는다. 아직 아무 도구도 안 부른 상태라 남는 게 없다.
    ({ data } = await client.post('/chat/completions', body, { signal }));
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
  signal,
}: {
  client: AxiosInstance;
  model: string;
  system: string;
  prompt: string;
  signal?: AbortSignal;
}) => {
  const { message } = await requestCompletion({
    client,
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    signal,
  });

  return message.content ?? '';
};

/**
 * 짝이 없는 tool_call 을 메운다.
 *
 * 정지가 도구와 도구 사이에서 걸리면 tool_calls 를 실은 assistant 메시지는 남는데 그중 일부는
 * 대응하는 tool 메시지가 없다. OpenAI 호환 엔드포인트는 그런 대화를 400 으로 거부하므로,
 * 이 히스토리를 다음 메시지에 다시 실으면 그 세션의 모든 요청이 실패한다. 패널에는 대화를
 * 초기화할 수단이 없어서 앱을 다시 켜야 풀린다. 정지 버튼이 고착을 다시 만드는 셈이라 여기서 막는다.
 */
export const completeToolReplies = (messages: ChatMessage[], notice: string): ChatMessage[] => {
  const result: ChatMessage[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    index += 1;
    if (!message) continue;

    result.push(message);
    if (message.role !== 'assistant' || !message.tool_calls?.length) continue;

    const answered = new Set<string>();

    while (index < messages.length) {
      const reply = messages[index];
      if (!reply || reply.role !== 'tool') break;

      answered.add(reply.tool_call_id);
      result.push(reply);
      index += 1;
    }

    message.tool_calls.forEach(({ id }) => {
      if (answered.has(id)) return;

      result.push({ role: 'tool', tool_call_id: id, content: notice });
    });
  }

  return result;
};

/**
 * 정지는 "다음 도구를 부르지 않는다" 는 뜻으로만 구현한다.
 *
 * 진행 중인 도구 호출은 끝까지 둔다. publish_blog_post 나 delete_blog_posts 를 중간에 끊으면
 * 네이버에 반쯤 쓰인 글이나 지워졌는지 알 수 없는 글이 남는데, 그건 멈추지 못하는 것보다 나쁘다.
 * 그래서 확인 지점은 반복 시작과 각 도구 호출 직전 두 곳뿐이고, tool.run() 안으로는 신호를 넣지 않는다.
 */
export const runAgentLoop = async ({
  client,
  model,
  system,
  tools,
  history,
  onEvent,
  signal,
  maxIterations = 24,
}: {
  client: AxiosInstance;
  model: string;
  system: string;
  tools: ToolSpec[];
  history: ChatMessage[];
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  maxIterations?: number;
}) => {
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history];
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

  // 툴콜 모델은 content: null + tool_calls 없음으로 답하는 일이 흔하다. 그대로 끝내면
  // 스피너만 사라지고 화면에 아무것도 안 남는다. 패널이 폴백 문구를 띄울 근거를 여기서 만든다.
  let hadOutput = false;

  const finishCancelled = () => {
    onEvent({ type: 'done', reason: 'cancelled', hadOutput });

    return completeToolReplies(messages, RESULT.toolSkippedByStop);
  };

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (signal?.aborted) return finishCancelled();

    let message: { content: string | null; tool_calls?: ToolCall[] };
    let usage: Usage;

    try {
      ({ message, usage } = await requestCompletion({ client, model, messages, tools, signal }));
    } catch (error) {
      // 정지가 끊은 요청은 실패가 아니다. 취소로 끝낸다.
      if (signal?.aborted) return finishCancelled();
      throw error;
    }

    if (usage.prompt_tokens || usage.completion_tokens) {
      onEvent({
        type: 'usage',
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
      });
    }

    const text = message.content ?? '';

    // 공백만 있는 답은 패널이 카드로 그리지 않는다. 출력했다고 세면 폴백이 안 뜬다.
    if (text.trim()) {
      hadOutput = true;
      onEvent({ type: 'assistant', text });
    }

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      // 빈 문자열 assistant 메시지는 다음 요청 히스토리에 그대로 실려 프로바이더에 따라 거절된다.
      // 남길 내용이 없으면 아예 넣지 않는다.
      if (text) messages.push({ role: 'assistant', content: text });
      onEvent({ type: 'done', reason: 'end', hadOutput });
      return messages;
    }

    messages.push({ role: 'assistant', content: message.content, tool_calls: toolCalls });

    for (const call of toolCalls) {
      // 한 턴에 도구 여러 개가 붙어 오면 남은 것부터 멈춘다. 앞선 결과는 messages 에 그대로 남는다.
      if (signal?.aborted) return finishCancelled();

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

  onEvent({ type: 'done', reason: 'max_iterations', hadOutput });

  return messages;
};
