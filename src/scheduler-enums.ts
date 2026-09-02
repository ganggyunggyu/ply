/**
 * 블로그 스케줄러가 받는 고정 enum.
 *
 * 진짜 주인은 스케줄러 저장소다.
 *   src/routes/schedule.route.ts 의 manuscriptTypeSchema / imageSourceSchema / scheduleModeSchema
 *   src/schemas/dto.ts 의 createScheduleSchema
 * 여기 값이 그쪽과 어긋나면 /bot/auto-schedule 이 400 으로 튕긴다.
 * 스케줄러에서 스타일을 추가하면 이 파일도 같이 고친다.
 */

export const MANUSCRIPT_TYPES = [
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
] as const;

export type ManuscriptType = (typeof MANUSCRIPT_TYPES)[number];

export const IMAGE_SOURCES = ['ai', 'google', 'keyword', 'product', 'local'] as const;

export type ImageSource = (typeof IMAGE_SOURCES)[number];

export const SCHEDULE_MODES = ['1', '2', '3', '2121'] as const;

export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

/**
 * 예약 묶음(Schedule 문서)의 status. GET /schedules 의 status 필터가 받는 값도 이 다섯 개다.
 * schedule.schema.ts 의 ScheduleSchema.status enum.
 */
export const SCHEDULE_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

/**
 * 예약 안의 글 하나(ScheduleJob 문서)의 status. 묶음과 값이 다르다.
 * job 에는 processing 이 없고 대신 생성·발행 단계가 나뉘어 있다. 둘을 섞으면 필터가 조용히 빈 결과를 준다.
 */
export const SCHEDULE_JOB_STATUSES = [
  'pending',
  'generating',
  'generated',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;

export type ScheduleJobStatus = (typeof SCHEDULE_JOB_STATUSES)[number];

export const isScheduleStatus = (value: unknown): value is ScheduleStatus =>
  typeof value === 'string' && (SCHEDULE_STATUSES as readonly string[]).includes(value);

/** 범위를 벗어나면 zod 가 400 을 던진다. 도구 스키마에 그대로 실어 모델이 보게 한다. */
export const SCHEDULE_LIMITS = {
  startHourMin: 0,
  startHourMax: 23,
  intervalMinutesMin: 10,
  intervalMinutesMax: 720,
  postsPerDayMin: 1,
  postsPerDayMax: 10,
} as const;

export const isManuscriptType = (value: unknown): value is ManuscriptType =>
  typeof value === 'string' && (MANUSCRIPT_TYPES as readonly string[]).includes(value);

export const isImageSource = (value: unknown): value is ImageSource =>
  typeof value === 'string' && (IMAGE_SOURCES as readonly string[]).includes(value);
