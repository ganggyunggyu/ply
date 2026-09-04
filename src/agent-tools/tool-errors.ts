import { ERRORS } from '../messages';
import { TOOL_RESULTS as RESULT } from '../prompts';

export type DeleteRow = { logNo: string; title: string; status: string; note: string };

/**
 * 정지가 걸린 뒤 남은 삭제 대상을 결과 표의 행으로 만든다.
 *
 * 승인받은 10건 중 3건째에서 멈췄으면 나머지 7건은 손도 대지 않은 것이다. 표에서 아예 빼면
 * 모델이 "전부 지웠다" 로 읽고 사용자에게 그렇게 보고한다. 지우지 않았다는 사실을 행으로 남긴다.
 */
export const stoppedDeleteRows = (targets: readonly { logNo: string; title: string }[]): DeleteRow[] =>
  targets.map(({ logNo, title }) => ({
    logNo,
    title,
    status: RESULT.deleteStatusStopped,
    note: '',
  }));

const KNOWN_ERROR_MESSAGES = new Set<string>(
  (Object.values(ERRORS) as unknown[]).filter((value): value is string => typeof value === 'string'),
);

/** playwright 원문 에러는 영어 다중행이라 사용자 표에 그대로 넣지 않는다. */
export const describeToolError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  return KNOWN_ERROR_MESSAGES.has(message) ? message : ERRORS.deleteFailed;
};
