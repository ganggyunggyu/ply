import { contextBridge, ipcRenderer } from 'electron';
import type { AgentQuestion } from './bridge';

const browserApi = {
  getState: () => ipcRenderer.invoke('browser:state'),
  createTab: (options: { url?: string; profileId?: string; openedByAgent?: boolean } = {}) =>
    ipcRenderer.invoke('tab:create', options),
  closeTab: (id: number) => ipcRenderer.invoke('tab:close', id),
  selectTab: (id: number) => ipcRenderer.invoke('tab:select', id),
  navigate: (id: number, input: string) => ipcRenderer.invoke('tab:navigate', id, input),
  goBack: (id: number) => ipcRenderer.invoke('tab:back', id),
  goForward: (id: number) => ipcRenderer.invoke('tab:forward', id),
  reload: (id: number) => ipcRenderer.invoke('tab:reload', id),

  listProfiles: () => ipcRenderer.invoke('profile:list'),
  addProfile: (label: string) => ipcRenderer.invoke('profile:add', label),
  removeProfile: (profileId: string) => ipcRenderer.invoke('profile:remove', profileId),

  listAccounts: () => ipcRenderer.invoke('account:list'),
  addAccount: (input: { label: string; naverId: string; password?: string }) =>
    ipcRenderer.invoke('account:add', input),
  removeAccount: (id: string) => ipcRenderer.invoke('account:remove', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setApiKey', apiKey),
  setModels: (models: { agentModel?: string; writerModel?: string }) =>
    ipcRenderer.invoke('settings:setModels', models),
  listModels: () => ipcRenderer.invoke('settings:models'),

  togglePanel: () => ipcRenderer.invoke('panel:toggle'),

  runAgent: (message: string, history: unknown[]) => ipcRenderer.invoke('agent:run', message, history),
  getAgentStatus: () => ipcRenderer.invoke('agent:status'),
  cancelAgent: () => ipcRenderer.invoke('agent:cancel'),
  answerAgent: (id: number, answer: string) => ipcRenderer.invoke('agent:answer', id, answer),
  getEndpoints: () => ipcRenderer.invoke('services:endpoints'),
  setEndpoints: (next: Record<string, string>) => ipcRenderer.invoke('services:setEndpoints', next),
  setServiceUrls: (next: Record<string, string>) => ipcRenderer.invoke('services:setUrls', next),
  loginDabut: (input: { username: string; password: string }) =>
    ipcRenderer.invoke('service:login', input),
  logoutDabut: () => ipcRenderer.invoke('service:logout'),
  answerDabutLogin: (id: number, result: string) =>
    ipcRenderer.invoke('agent:dabutLoginDone', id, result),
  onDabutLoginRequest: (callback: (payload: { id: number; reason: string }) => void) =>
    ipcRenderer.on('agent:dabut-login', (_event, payload: { id: number; reason: string }) =>
      callback(payload),
    ),

  getCdpInfo: () => ipcRenderer.invoke('cdp:info'),

  onState: (callback: (state: unknown) => void) =>
    ipcRenderer.on('browser:state', (_event, state: unknown) => callback(state)),
  onAgentEvent: (callback: (event: unknown) => void) =>
    ipcRenderer.on('agent:event', (_event, payload: unknown) => callback(payload)),
  onAgentProgress: (callback: (message: string) => void) =>
    ipcRenderer.on('agent:progress', (_event, message: string) => callback(message)),
  onAgentRunning: (callback: (running: boolean) => void) =>
    ipcRenderer.on('agent:running', (_event, running: boolean) => callback(running)),
  onAgentQuestion: (callback: (payload: AgentQuestion) => void) =>
    ipcRenderer.on('agent:question', (_event, payload: AgentQuestion) => callback(payload)),
};

contextBridge.exposeInMainWorld('gngBrowser', browserApi);
