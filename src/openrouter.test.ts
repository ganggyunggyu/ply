import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AxiosInstance } from 'axios';
import {
  parseToolArguments,
  runAgentLoop,
  toOpenAiTools,
  type AgentEvent,
  type ToolSpec,
} from './openrouter';

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
