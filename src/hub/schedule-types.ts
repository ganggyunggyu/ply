export type ScheduleSummary = {
  id: string;
  accountId: string;
  scheduleDate: string;
  status: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  /** 계정별로 나눠 받은 목록을 다시 최신순으로 합칠 때만 쓴다. 모델에게는 내보내지 않는다. */
  createdAt: string;
};

export type ScheduleJobDetail = {
  id: string;
  keyword: string;
  scheduledAt: string;
  status: string;
  projectId: string;
  manuscriptType: string;
  businessName: string;
  postUrl: string;
  error: string;
};

export type ScheduleDetail = {
  schedule: ScheduleSummary | null;
  jobs: ScheduleJobDetail[];
};
