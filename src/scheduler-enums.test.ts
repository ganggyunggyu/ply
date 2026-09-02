import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IMAGE_SOURCES,
  isImageSource,
  isManuscriptType,
  MANUSCRIPT_TYPES,
  isScheduleStatus,
  SCHEDULE_JOB_STATUSES,
  SCHEDULE_LIMITS,
  SCHEDULE_MODES,
  SCHEDULE_STATUSES,
} from './scheduler-enums';

/**
 * 스케줄러 저장소는 이 저장소에 없다. 값이 어긋나면 /bot/auto-schedule 이 400 을 던지므로
 * 여기서는 목록 자체를 고정해 두고, 스케줄러를 고칠 때 이 테스트가 같이 깨지게 둔다.
 * 출처: scheduler-server/src/schemas/dto.ts 의 createScheduleSchema
 *       scheduler-server/src/routes/schedule.route.ts 의 manuscriptTypeSchema / imageSourceSchema
 */
test('원고 스타일 목록이 스케줄러 enum 과 같다', () => {
  assert.deepEqual(
    [...MANUSCRIPT_TYPES],
    [
      'default',
      'update-restaurant',
      'restaurant',
      'restaurant/v1',
      'restaurant/v2',
      'pet',
      'grok',
      'keigo',
      'hanryeodamwon',
      'nyangnyang',
      'kimdongpal',
      'alibaba',
    ],
  );
  assert.equal(new Set(MANUSCRIPT_TYPES).size, MANUSCRIPT_TYPES.length);
});

test('이미지 출처와 스케줄 모드 목록이 스케줄러 enum 과 같다', () => {
  assert.deepEqual([...IMAGE_SOURCES], ['ai', 'google', 'keyword', 'product', 'local']);
  assert.deepEqual([...SCHEDULE_MODES], ['1', '2', '3', '2121']);
});

test('목록 밖의 값은 판별 함수가 걸러낸다', () => {
  MANUSCRIPT_TYPES.forEach((type) => assert.equal(isManuscriptType(type), true, type));
  IMAGE_SOURCES.forEach((source) => assert.equal(isImageSource(source), true, source));

  ['맛집', 'restaurant/v3', 'Default', '', undefined, null, 3].forEach((value) =>
    assert.equal(isManuscriptType(value), false, String(value)),
  );
  ['unsplash', 'AI', '', undefined, null].forEach((value) =>
    assert.equal(isImageSource(value), false, String(value)),
  );
});

test('숫자 범위가 스케줄러 zod 범위와 같다', () => {
  assert.deepEqual(SCHEDULE_LIMITS, {
    startHourMin: 0,
    startHourMax: 23,
    intervalMinutesMin: 10,
    intervalMinutesMax: 720,
    postsPerDayMin: 1,
    postsPerDayMax: 10,
  });
});

/**
 * 출처: scheduler-server/src/schemas/schedule.schema.ts 의 ScheduleSchema.status / ScheduleJobSchema.status
 *       GET /schedules 의 필터는 scheduler-server/src/schemas/dto.ts 의 scheduleQuerySchema
 */
test('예약 묶음과 예약 건의 상태 목록이 스케줄러와 같다', () => {
  assert.deepEqual([...SCHEDULE_STATUSES], ['pending', 'processing', 'completed', 'failed', 'cancelled']);
  assert.deepEqual(
    [...SCHEDULE_JOB_STATUSES],
    ['pending', 'generating', 'generated', 'publishing', 'published', 'failed', 'cancelled'],
  );
});

test('묶음 상태와 건별 상태를 섞지 않는다', () => {
  // job 에는 processing 이 없고, 묶음에는 발행 단계가 없다. 섞으면 필터가 조용히 빈 결과를 준다.
  assert.equal(SCHEDULE_JOB_STATUSES.includes('processing' as never), false);
  assert.equal(SCHEDULE_STATUSES.includes('published' as never), false);

  SCHEDULE_STATUSES.forEach((status) => assert.equal(isScheduleStatus(status), true, status));
  ['published', 'generating', 'Pending', '', undefined, null].forEach((value) =>
    assert.equal(isScheduleStatus(value), false, String(value)),
  );
});
