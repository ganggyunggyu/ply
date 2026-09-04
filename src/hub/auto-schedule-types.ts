import type { ImageSource, ManuscriptType } from '../scheduler-enums';

/**
 * 항목별 override. keywords 와 길이가 같아야 하고, 다르면 스케줄러가
 * HTTP 200 + { success: false } 로 조용히 실패한다.
 * projectId 는 최상위 project_id 를 이긴다 (schedule.route.ts 의 applyItemOptions).
 */
export type AutoScheduleItemOption = {
  businessName?: string;
  manuscriptType?: ManuscriptType;
  projectId?: string;
};

/**
 * 스케줄러는 account.id 를 네이버 로그인 id 로만 취급한다 (findAccountById).
 * /api/blog-accounts 가 준 값은 Mongo ObjectId 라서 id 로 보내면
 * "Account credentials not provided" 로 떨어진다. dabutAccountId 로 보내야
 * 다붓 크리덴셜 복호화 경로를 탄다 (resolveQueueAccount).
 */
export type AutoScheduleQueue = {
  account: { dabutAccountId?: string; id?: string; blogId?: string };
  keywords: string[];
  blog_name?: string;
  item_options?: AutoScheduleItemOption[];
};

export type AutoScheduleInput = {
  scheduleDate: string;
  queues: AutoScheduleQueue[];
  postsPerDay?: number;
  startHour?: number;
  intervalMinutes?: number;
  manuscriptType?: ManuscriptType;
  imageSource?: ImageSource;
  keywordCategory?: string;
  projectId?: string;
};
