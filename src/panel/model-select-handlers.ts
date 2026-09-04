import { api, agentModelEl, chipModelEl, writerModelEl } from './dom';
import { shortModel } from './chips';

export const handleAgentModelChange = () => {
  chipModelEl.textContent = shortModel(agentModelEl.value);
  void api.setModels({ agentModel: agentModelEl.value });
};

export const handleWriterModelChange = () => {
  void api.setModels({ writerModel: writerModelEl.value });
};
