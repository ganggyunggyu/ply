import { CONFIRM } from '../messages';
import type { KnownPost } from './post-limits';
import { isDeleteApproved } from './approval';
import type { ToolContext } from './tool-context';

/** 질문 문안은 코드가 knownPosts 값으로 만든다. 모델은 질문 텍스트를 만들 수 없다.
 *  답이 없어 askUser 가 던지는 경우도 승인이 아니라 취소다. */
export const requestDeleteApproval = async ({
  askUser,
  blogId,
  targets,
}: {
  askUser: ToolContext['askUser'];
  blogId: string;
  targets: KnownPost[];
}): Promise<{ approved: boolean; answer: string }> => {
  const lines = targets.map(({ title, addDate, logNo }, index) =>
    CONFIRM.deleteLine(index + 1, title, addDate, logNo),
  );

  try {
    const answer = await askUser(CONFIRM.deleteQuestion(blogId, lines), [
      CONFIRM.deleteYes,
      CONFIRM.deleteNo,
    ]);

    return { approved: isDeleteApproved(answer), answer };
  } catch {
    return { approved: false, answer: CONFIRM.deleteNo };
  }
};
