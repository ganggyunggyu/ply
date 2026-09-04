import type { ScheduleJobDetail, ScheduleSummary } from '../hub';
import { CONFIRM } from '../messages';
import { describeScheduleAccount, type OwnedAccount } from './owned-accounts';
import { countPublishedJobs, countStoppableJobs } from './schedule-job-status';
import { isCancelApproved } from './known-schedules';
import { jobStatusLabel } from './schedule-format';
import type { ToolContext } from './tool-context';

export type ScheduleCancelApproval = {
  approved: boolean;
  answer: string;
  /**
   * 사용자가 실제로 답했는지. 10분 타임아웃도 승인이 아니지만 거절도 아니다.
   * 둘을 뭉뚱그리면 사용자가 하지 않은 답변("그대로 둘게요")을 지어내 보고하게 된다.
   */
  answered: boolean;
};

/**
 * 확인 문안은 코드가 서버에서 방금 읽은 값으로 만든다. 모델은 질문 텍스트를 만들 수 없다.
 * 목록에는 키워드도 시각도 없으므로 이 문안은 반드시 get_schedule 결과로 조립한다.
 * 답이 없어 askUser 가 던지는 경우도 승인이 아니다.
 *
 * 계정은 마스킹한 로그인 id 가 아니라 사용자가 붙여 둔 이름으로 적는다. 마스킹은 프라이버시용인데,
 * 확인 카드에서는 그게 "누구 예약인지" 를 판단할 마지막 단서를 지워 버린다.
 */
export const requestScheduleCancelApproval = async ({
  askUser,
  schedule,
  jobs,
  owned,
}: {
  askUser: ToolContext['askUser'];
  schedule: ScheduleSummary;
  jobs: ScheduleJobDetail[];
  owned: ReadonlyMap<string, OwnedAccount>;
}): Promise<ScheduleCancelApproval> => {
  const lines = jobs.map(({ keyword, scheduledAt, status }, index) =>
    CONFIRM.cancelScheduleLine(index + 1, keyword, scheduledAt, jobStatusLabel(status)),
  );

  // 이미 발행된 건은 취소해도 네이버에서 내려가지 않는다. DB 기록만 취소로 덮인다.
  const published = countPublishedJobs(jobs);

  try {
    const answer = await askUser(
      CONFIRM.cancelScheduleQuestion({
        scheduleId: schedule.id,
        scheduleDate: schedule.scheduleDate,
        account: describeScheduleAccount(schedule.accountId, owned),
        lines,
        stoppable: countStoppableJobs(jobs),
        published,
      }),
      [CONFIRM.cancelScheduleYes, CONFIRM.cancelScheduleNo],
    );

    return { approved: isCancelApproved(answer), answer, answered: true };
  } catch {
    return { approved: false, answer: '', answered: false };
  }
};
