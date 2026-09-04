import { CHAT } from '../messages';
import { formatCost, formatTokenCount, totalTokens, usageCost } from '../usage';
import { agentModelEl, chipUsageEl } from './dom';
import { panelState } from './state';

/** 누적 토큰과 대략적인 비용. 단가를 모르면 토큰만 보여준다. */
export const renderUsageChip = () => {
  const tokens = totalTokens(panelState.usageTotal);

  if (tokens === 0) {
    chipUsageEl.hidden = true;
    return;
  }

  const price = panelState.agentPresets.find(({ id }) => id === agentModelEl.value);
  const cost = usageCost(panelState.usageTotal, price);
  const label = formatTokenCount(tokens);

  chipUsageEl.hidden = false;
  chipUsageEl.title = CHAT.usageChipTitle;
  chipUsageEl.textContent =
    cost === null ? CHAT.usageChip(label) : CHAT.usageChipWithCost(label, formatCost(cost));
};
