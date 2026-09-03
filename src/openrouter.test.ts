import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AxiosInstance } from 'axios';
import {
  completeToolReplies,
  parseToolArguments,
  runAgentLoop,
  toOpenAiTools,
  type AgentEvent,
  type ChatMessage,
  type ToolSpec,
} from './openrouter';
import { TOOL_RESULTS as RESULT } from './prompts';

/** assistant 의 tool_calls 마다 짝이 되는 tool 메시지가 있는지. 없으면 다음 요청이 400 이다. */
const orphanToolCallIds = (messages: ChatMessage[]) => {
  const answered = new Set(
    messages.flatMap((message) => (message.role === 'tool' ? [message.tool_call_id] : [])),
  );

  return messages.flatMap((message) =>
    message.role === 'assistant'
      ? (message.tool_calls ?? []).map(({ id }) => id).filter((id) => !answered.has(id))
      : [],
  );
};

const echoTool = (calls: string[]): ToolSpec => ({
  name: 'echo',
  description: '받은 값을 그대로 돌려준다',
  parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
  run: async (input) => {
    calls.push(String(input.value));
    return `echo:${input.value}`;
  },
});

const failingTool: ToolSpec = {
  name: 'boom',
  description: '항상 실패한다',
  parameters: { type: 'object', properties: {} },
  run: async () => {
    throw new Error('터졌다');
  },
};

const stubClient = (responses: unknown[]) => {
  let index = 0;
  const seen: unknown[] = [];

  const client = {
    post: async (_path: string, body: unknown) => {
      seen.push(body);
      const data = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return { data };
    },
  } as unknown as AxiosInstance;

  return { client, seen, calls: () => index };
};

const textResponse = (content: string) => ({
  choices: [{ message: { content, tool_calls: undefined }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 4 },
});

const toolResponse = (name: string, args: string, id = 'call_1') => ({
  choices: [
    {
      message: { content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: args } }] },
      finish_reason: 'tool_calls',
    },
  ],
  usage: {},
});

test('도구를 OpenAI 형식으로 바꾼다', () => {
  const [converted] = toOpenAiTools([echoTool([])]);

  assert.equal(converted?.type, 'function');
  assert.equal(converted?.function.name, 'echo');
});

test('도구 인자를 파싱한다', () => {
  assert.deepEqual(parseToolArguments('{"a":1}'), { a: 1 });
  assert.deepEqual(parseToolArguments(''), {});
  assert.deepEqual(parseToolArguments('"문자열"'), {});
  assert.throws(() => parseToolArguments('{깨진'), /JSON/);
});

test('도구 호출 없이 끝나면 한 번만 요청한다', async () => {
  const { client, calls } = stubClient([textResponse('끝')]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: '안녕' }],
    onEvent: (event) => events.push(event),
  });

  assert.equal(calls(), 1);
  assert.deepEqual(
    events.map((event) => event.type),
    ['usage', 'assistant', 'done'],
  );
});

test('도구를 실행하고 결과를 대화에 넣는다', async () => {
  const calls: string[] = [];
  const { client } = stubClient([toolResponse('echo', '{"value":"하이"}'), textResponse('완료')]);
  const events: AgentEvent[] = [];

  const messages = await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool(calls)],
    history: [{ role: 'user', content: '실행해' }],
    onEvent: (event) => events.push(event),
  });

  assert.deepEqual(calls, ['하이']);

  const toolMessage = messages.find((message) => message.role === 'tool');
  assert.equal(toolMessage?.role === 'tool' && toolMessage.content, 'echo:하이');
  assert.ok(events.some((event) => event.type === 'tool_end'));
});

test('도구가 실패해도 루프가 멈추지 않는다', async () => {
  const { client } = stubClient([toolResponse('boom', '{}'), textResponse('실패했음')]);
  const events: AgentEvent[] = [];

  const messages = await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [failingTool],
    history: [{ role: 'user', content: '해봐' }],
    onEvent: (event) => events.push(event),
  });

  const toolMessage = messages.find((message) => message.role === 'tool');
  assert.match(toolMessage?.role === 'tool' ? toolMessage.content : '', /터졌다/);
  assert.ok(events.some((event) => event.type === 'tool_error'));
});

test('없는 도구를 부르면 에러를 돌려준다', async () => {
  const { client } = stubClient([toolResponse('nope', '{}'), textResponse('끝')]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
  });

  const error = events.find((event) => event.type === 'tool_error');
  assert.equal(error?.type === 'tool_error' && error.name, 'nope');
});

/** 툴콜 모델이 흔히 내는 모양. 할 말도 부를 도구도 없이 끝낸다. */
const silentResponse = () => ({
  choices: [{ message: { content: null, tool_calls: [] }, finish_reason: 'stop' }],
  usage: {},
});

test('아무 말 없이 끝나면 done 에 hadOutput: false 가 실린다', async () => {
  const { client } = stubClient([silentResponse()]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
  });

  const done = events.at(-1);

  assert.equal(done?.type === 'done' && done.reason, 'end');
  assert.equal(done?.type === 'done' && done.hadOutput, false);
  assert.equal(events.some((event) => event.type === 'assistant'), false);
});

test('텍스트로 답하면 hadOutput: true 다', async () => {
  const { client } = stubClient([textResponse('끝났어요')]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
  });

  const done = events.at(-1);
  assert.equal(done?.type === 'done' && done.hadOutput, true);
});

test('공백만 있는 답은 출력으로 세지 않는다', async () => {
  // 패널이 공백 카드를 그리지 않으므로, 출력으로 세면 화면이 빈 채 폴백도 안 뜬다.
  const { client } = stubClient([textResponse('   ')]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
  });

  const done = events.at(-1);
  assert.equal(done?.type === 'done' && done.hadOutput, false);
});

test('도구를 부른 뒤 말없이 끝나도 앞서 낸 텍스트는 출력으로 센다', async () => {
  const withText = {
    choices: [
      {
        message: {
          content: '먼저 확인할게요',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{"value":"x"}' } },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: {},
  };
  const { client } = stubClient([withText, silentResponse()]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
  });

  const done = events.at(-1);
  assert.equal(done?.type === 'done' && done.hadOutput, true);
});

test('이미 멈춘 신호를 주면 도구를 한 번도 부르지 않는다', async () => {
  const calls: string[] = [];
  const { client, calls: requests } = stubClient([toolResponse('echo', '{"value":"하이"}')]);
  const events: AgentEvent[] = [];
  const controller = new AbortController();
  controller.abort();

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool(calls)],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
    signal: controller.signal,
  });

  assert.deepEqual(calls, []);
  assert.equal(requests(), 0);
  const done = events.at(-1);
  assert.equal(done?.type === 'done' && done.reason, 'cancelled');
});

test('첫 도구가 끝난 뒤 멈추면 다음 도구를 부르지 않는다', async () => {
  const calls: string[] = [];
  const controller = new AbortController();

  // 한 턴에 도구 두 개가 붙어 왔다. 첫 도구가 도는 동안 사용자가 정지를 눌렀다고 본다.
  const twoCalls = {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{"value":"첫째"}' } },
            { id: 'call_2', type: 'function', function: { name: 'echo', arguments: '{"value":"둘째"}' } },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: {},
  };
  const { client } = stubClient([twoCalls, textResponse('끝')]);
  const events: AgentEvent[] = [];

  const stoppingTool: ToolSpec = {
    ...echoTool(calls),
    run: async (input) => {
      calls.push(String(input.value));
      controller.abort();
      return `echo:${input.value}`;
    },
  };

  const messages = await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [stoppingTool],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
    signal: controller.signal,
  });

  // 진행 중이던 도구는 끝까지 돈다. 반쯤 실행된 발행·삭제를 남기지 않으려는 결정이다.
  assert.deepEqual(calls, ['첫째']);

  const toolMessage = messages.find((message) => message.role === 'tool');
  assert.equal(toolMessage?.role === 'tool' && toolMessage.content, 'echo:첫째');
  const done = events.at(-1);
  assert.equal(done?.type === 'done' && done.reason, 'cancelled');
});

test('짝 없는 tool_call 에 취소 응답을 채워 넣는다', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'x' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{}' } },
        { id: 'call_2', type: 'function', function: { name: 'echo', arguments: '{}' } },
      ],
    },
    { role: 'tool', tool_call_id: 'call_1', content: 'echo:첫째' },
  ];

  const filled = completeToolReplies(messages, RESULT.toolSkippedByStop);

  assert.deepEqual(orphanToolCallIds(filled), []);
  assert.equal(filled.at(-1)?.role === 'tool' && filled.at(-1)?.content, RESULT.toolSkippedByStop);
});

test('짝이 다 있으면 대화를 그대로 둔다', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'x' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: 'call_1', content: 'echo' },
    { role: 'assistant', content: '끝' },
  ];

  assert.deepEqual(completeToolReplies(messages, RESULT.toolSkippedByStop), messages);
});

test('정지한 실행의 대화를 다시 실어도 tool_call 이 비지 않는다', async () => {
  const controller = new AbortController();

  const twoCalls = {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{"value":"첫째"}' } },
            { id: 'call_2', type: 'function', function: { name: 'echo', arguments: '{"value":"둘째"}' } },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: {},
  };
  const { client } = stubClient([twoCalls, textResponse('끝')]);

  const messages = await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [
      {
        ...echoTool([]),
        run: async () => {
          controller.abort();
          return 'echo:첫째';
        },
      },
    ],
    history: [{ role: 'user', content: 'x' }],
    onEvent: () => undefined,
    signal: controller.signal,
  });

  // 짝이 빠진 채로 히스토리에 남으면 그 세션의 다음 메시지부터 전부 400 이 난다.
  assert.deepEqual(orphanToolCallIds(messages), []);
  assert.equal(messages.filter((message) => message.role === 'tool').length, 2);
});

test('말없이 끝난 턴은 빈 assistant 메시지를 남기지 않는다', async () => {
  const { client } = stubClient([silentResponse()]);

  const messages = await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: () => undefined,
  });

  assert.equal(
    messages.some((message) => message.role === 'assistant' && message.content === ''),
    false,
  );
});

test('멈춘 실행도 그때까지의 대화를 그대로 돌려준다', async () => {
  const controller = new AbortController();
  const { client } = stubClient([toolResponse('echo', '{"value":"하이"}'), textResponse('끝')]);

  const messages = await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [
      {
        ...echoTool([]),
        run: async () => {
          controller.abort();
          return 'echo:하이';
        },
      },
    ],
    history: [{ role: 'user', content: 'x' }],
    onEvent: () => undefined,
    signal: controller.signal,
  });

  assert.equal(messages[0]?.role, 'system');
  assert.ok(messages.some((message) => message.role === 'tool'));
});

test('반복 한도에 걸리면 max_iterations 로 끝난다', async () => {
  const { client } = stubClient([toolResponse('echo', '{"value":"루프"}')]);
  const events: AgentEvent[] = [];

  await runAgentLoop({
    client,
    model: 'test/model',
    system: 'sys',
    tools: [echoTool([])],
    history: [{ role: 'user', content: 'x' }],
    onEvent: (event) => events.push(event),
    maxIterations: 3,
  });

  const done = events.at(-1);
  assert.equal(done?.type === 'done' && done.reason, 'max_iterations');
});
