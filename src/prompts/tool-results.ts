import { coreResults } from './results-core';
import { dabutScheduleValidateResults } from './results-dabut-schedule-validate';
import { scheduleResults } from './results-schedule';
import { serviceDeleteResults } from './results-service-delete';
import { accountResults } from './results-account';
import { exposureResults } from './results-exposure';
import { docResults } from './results-doc';

/**
 * 도구가 모델에게 돌려주는 문장 전부. 원래 하나의 큰 객체 리터럴이었던 것을
 * 도메인별 조각으로 나눠 여기서 다시 합친다. 키와 값은 조각 파일에서 그대로 옮겼다.
 */
export const TOOL_RESULTS = {
  ...coreResults,
  ...dabutScheduleValidateResults,
  ...scheduleResults,
  ...serviceDeleteResults,
  ...accountResults,
  ...exposureResults,
  ...docResults,
} as const;
