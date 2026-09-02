export type ModelPreset = {
  id: string;
  label: string;
  inputPerMillion: number;
  outputPerMillion: number;
  contextLength: number;
  note: string;
};

/**
 * OpenRouter 실목록에서 확인한 값 (2026-09-01 기준).
 * 도구 호출을 지원하는 모델만 넣는다. 가격은 100만 토큰당 달러.
 */
export const AGENT_MODELS: ModelPreset[] = [
  {
    id: 'z-ai/glm-5.3-flash',
    label: 'GLM 5.3 Flash',
    inputPerMillion: 0.075,
    outputPerMillion: 0.25,
    contextLength: 1310720,
    note: '최신 GLM. 싸고 컨텍스트 131만. 기본값',
  },
  {
    id: 'z-ai/glm-5.3',
    label: 'GLM 5.3',
    inputPerMillion: 1.4,
    outputPerMillion: 4.4,
    contextLength: 1310720,
    note: '같은 세대 상위 모델. 어려운 판단이 필요할 때',
  },
  {
    id: 'minimax/minimax-m3',
    label: 'MiniMax M3',
    inputPerMillion: 0.3,
    outputPerMillion: 1.2,
    contextLength: 1048576,
    note: '에이전트 작업에 강한 계열',
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    inputPerMillion: 0.081,
    outputPerMillion: 0.162,
    contextLength: 1048576,
    note: '출력 단가 최저',
  },
  {
    id: 'qwen/qwen3.8-flash',
    label: 'Qwen3.8 Flash',
    inputPerMillion: 0.15,
    outputPerMillion: 0.47,
    contextLength: 1000000,
    note: '자료를 많이 물릴 때',
  },
];

export const WRITER_MODELS: ModelPreset[] = [
  {
    id: 'deepseek/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    inputPerMillion: 0.081,
    outputPerMillion: 0.162,
    contextLength: 1048576,
    note: '긴 원고를 제일 싸게. 기본값',
  },
  {
    id: 'z-ai/glm-5.3-flash',
    label: 'GLM 5.3 Flash',
    inputPerMillion: 0.075,
    outputPerMillion: 0.25,
    contextLength: 1310720,
    note: '한국어 문장이 자연스러움',
  },
  {
    id: 'z-ai/glm-5.3',
    label: 'GLM 5.3',
    inputPerMillion: 1.4,
    outputPerMillion: 4.4,
    contextLength: 1310720,
    note: '품질이 제일 중요할 때',
  },
  {
    id: 'qwen/qwen3.8-flash',
    label: 'Qwen3.8 Flash',
    inputPerMillion: 0.15,
    outputPerMillion: 0.47,
    contextLength: 1000000,
    note: '참고 자료를 길게 넣을 때',
  },
  {
    id: 'minimax/minimax-m3',
    label: 'MiniMax M3',
    inputPerMillion: 0.3,
    outputPerMillion: 1.2,
    contextLength: 1048576,
    note: '에이전트 모델과 통일하고 싶을 때',
  },
];

export const DEFAULT_AGENT_MODEL = 'z-ai/glm-5.3-flash';
export const DEFAULT_WRITER_MODEL = 'deepseek/deepseek-v4-flash';
