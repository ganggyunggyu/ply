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
  /**
   * 건너뛰기 자리 버튼을 '시간이 걸리는 동작' 으로 쓸 때. 카드를 바로 지우지 않고 끝날 때까지 두며,
   * 진행 상황은 setHint 로, 실패는 setError 로 카드 안에 보인다. true 를 돌려주면 카드를 지운다.
   */
  onSkipAsync?: (setError: (message: string) => void, setHint: (message: string) => void) => Promise<boolean>;
  /** 건너뛰기 자리 버튼이 주된 행동일 때 강조 스타일로 바꾼다(제출 버튼은 링크 스타일로). */
  skipPrimary?: boolean;
};

export type FormControl = HTMLInputElement | HTMLSelectElement;
