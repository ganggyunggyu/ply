export const WINDOW_WIDTH = 1440;
export const WINDOW_HEIGHT = 920;
export const WINDOW_MIN_WIDTH = 900;
export const WINDOW_MIN_HEIGHT = 600;

export const CHROME_HEIGHT = 52;
export const SIDEBAR_WIDTH = 244;

export const HOME_URL = 'https://www.google.com';
export const SEARCH_URL = 'https://www.google.com/search?q=';

export const DEFAULT_CDP_PORT = 18830;

export const PANEL_WIDTH = 396;

/** 폼 질문을 사용자가 닫았다는 표시. 사용자가 입력한 값과 겹치지 않게 예약어로 둔다. */
export const QUESTION_FORM_CANCEL = '__cancelled__';

/**
 * 패널의 답을 기다리는 상한. 질문 카드와 다붓 로그인 카드가 같은 값을 쓴다.
 * 이 시간이 지나면 대기가 거절되고 실행 슬롯이 풀린다.
 */
export const PENDING_ANSWER_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 폼 칸에 허용하는 입력 방식. password 는 일부러 뺐다.
 * 폼 답은 answerAgent 를 타고 모델에게 그대로 간다. 비밀번호는 dabut_login 경로로만 흐른다.
 */
export const QUESTION_FIELD_TYPES = ['text', 'number', 'date', 'time'] as const;
