import { EMPTY_USAGE, type UsageTotal } from '../usage';
import type { ChatMessage, ModelPreset } from './types';
import type { ServiceCatalogItemView } from '../bridge';

/** panel.ts 가 원래 모듈 스코프 let 으로 들고 있던 실행 상태. 여러 파일이 함께 읽고 쓴다. */
export const panelState = {
  history: [] as ChatMessage[],
  running: false,
  hasApiKey: false,
  pendingMessage: null as string | null,
  /** 렌더러는 카탈로그를 빌드타임에 모른다. 설정 IPC 로 받아 여기에 담는다. */
  serviceCatalog: [] as ServiceCatalogItemView[],
  /** 단가를 알아야 비용을 매긴다. 목록은 init 에서 한 번 받는다. */
  agentPresets: [] as ModelPreset[],
  usageTotal: EMPTY_USAGE as UsageTotal,
  /** 고르개가 열려 있으면 닫는 함수를 들고 있다. 칩을 다시 누르면 이걸로 닫는다. */
  closeModelPicker: null as (() => void) | null,
};


