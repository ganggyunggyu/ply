import type {
  AccountCardRequest,
  AgentCardOutcome,
  AgentEventView,
  ChatMessageView,
  ModelPresetView,
  QuestionField,
} from '../bridge';

export type ModelPreset = ModelPresetView;
export type AgentEvent = AgentEventView;
export type ChatMessage = ChatMessageView;
export type { AccountCardRequest, AgentCardOutcome, QuestionField };

export type CardField = { placeholder: string; type?: 'text' | 'password'; value?: string };

export type CardOptions = {
  /** 코드가 쓴 문장만 온다. 모델이 준 문자열을 여기에 넣지 않는다. */
  lead: string;
  /** 모델이 준 이유. 라벨을 달고 lead 아래에 따로 붙는다. */
  note?: string;
  fields: CardField[];
  submitLabel: string;
  skipLabel?: string;
  hint?: string;
  chips?: { label: string; onPick: () => void }[];
  onSubmit: (values: string[], setError: (message: string) => void) => Promise<boolean>;
  onSkip?: () => void;
};

export type FormControl = HTMLInputElement | HTMLSelectElement;
