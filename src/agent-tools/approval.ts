import type { NaverAccount } from '../accounts';
import type { PresetChange } from '../exposure-preset';
import { CONFIRM } from '../messages';
import type { ToolContext } from './tool-context';

export const isDeleteApproved = (answer: string) => answer.trim() === CONFIRM.deleteYes;

/**
 * 계정 삭제 승인. delete_blog_posts 와 같은 모양이지만 토큰이 다르다.
 * 토큰이 겹치면 글 삭제 승인이 계정 삭제 승인으로 샌다.
 */
export const isAccountRemoveApproved = (answer: string) => answer.trim() === CONFIRM.accountRemoveYes;

/** 노출체크 실행 승인. 30분짜리를 잘못 시작하는 비용이 클릭 한 번보다 훨씬 크다. */
export const isExposureRunApproved = (answer: string) => answer.trim() === CONFIRM.exposureRunYes;

/** 프리셋 저장 승인. 전체 교체라는 사실을 사용자가 알고 눌러야 한다. */
export const isPresetSaveApproved = (answer: string) => answer.trim() === CONFIRM.presetSaveYes;

export type ApprovalOutcome = {
  approved: boolean;
  answer: string;
  /** 사용자가 실제로 답했는지. 만료는 승인도 거절도 아니다. */
  answered: boolean;
};

const requestApproval = async ({
  askUser,
  question,
  choices,
  isApproved,
}: {
  askUser: ToolContext['askUser'];
  question: string;
  choices: string[];
  isApproved: (answer: string) => boolean;
}): Promise<ApprovalOutcome> => {
  try {
    const answer = await askUser(question, choices);

    return { approved: isApproved(answer), answer, answered: true };
  } catch {
    return { approved: false, answer: '', answered: false };
  }
};

/** 문안은 코드가 저장소에서 읽은 값으로 만든다. 모델은 확인 문구를 만들 수 없다. */
export const requestAccountRemoveApproval = ({
  askUser,
  account,
}: {
  askUser: ToolContext['askUser'];
  account: NaverAccount;
}): Promise<ApprovalOutcome> =>
  requestApproval({
    askUser,
    question: CONFIRM.accountRemoveQuestion({
      label: account.label,
      naverId: account.naverId,
      id: account.id,
    }),
    choices: [CONFIRM.accountRemoveYes, CONFIRM.accountRemoveNo],
    isApproved: isAccountRemoveApproved,
  });

export const requestExposureRunApproval = ({
  askUser,
  label,
}: {
  askUser: ToolContext['askUser'];
  label: string;
}): Promise<ApprovalOutcome> =>
  requestApproval({
    askUser,
    question: CONFIRM.exposureRunQuestion(label),
    choices: [CONFIRM.exposureRunYes, CONFIRM.exposureRunNo],
    isApproved: isExposureRunApproved,
  });

export const requestPresetSaveApproval = ({
  askUser,
  change,
}: {
  askUser: ToolContext['askUser'];
  change: PresetChange;
}): Promise<ApprovalOutcome> =>
  requestApproval({
    askUser,
    question: CONFIRM.presetSaveQuestion({ lines: change.summary, untouched: change.untouched }),
    choices: [CONFIRM.presetSaveYes, CONFIRM.presetSaveNo],
    isApproved: isPresetSaveApproved,
  });
