import { addUsage } from '../usage';
import { CHAT } from '../messages';
import type { AgentEvent } from './types';
import { appendEntry } from './chat-log';
import { removeThinking } from './thinking';
import { addStep, settleStep } from './steps';
import { renderUsageChip } from './usage-chip';
import { summarizeInput } from './summarize-input';
import { panelState } from './state';

export const handleAgentEvent = (event: AgentEvent) => {
  if (event.type === 'assistant' && event.text.trim()) {
    removeThinking();
    appendEntry(CHAT.roleAgent, event.text);
  }
  if (event.type === 'tool_start') addStep(event.name, summarizeInput(event.input));
  if (event.type === 'tool_end') settleStep(event.name, 'done', event.output);
  if (event.type === 'tool_error') settleStep(event.name, 'error', event.message);
  if (event.type === 'usage') {
    panelState.usageTotal = addUsage(panelState.usageTotal, event);
    renderUsageChip();
  }
  if (event.type === 'done') {
    removeThinking();

    if (event.reason === 'max_iterations') appendEntry(CHAT.roleAgent, CHAT.stoppedTooLong, 'error');
    else if (event.reason === 'cancelled') appendEntry(CHAT.roleSystem, CHAT.cancelled);
    // 모델이 content 없이 툴콜도 없이 끝내면 화면에 아무것도 안 남는다. 그때만 폴백을 찍는다.
    else if (!event.hadOutput) appendEntry(CHAT.roleAgent, CHAT.noOutput, 'error');
  }
};
