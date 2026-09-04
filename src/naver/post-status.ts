import { parsePostListResponse } from './post-list-parse';

/** _deletePost 부재는 "글이 없다" 가 아니라 "이 응답에 소유자용 버튼이 없다" 일 뿐이다.
 *  비로그인 상태로 나간 요청은 살아 있는 공개글을 200 으로 돌려주므로 그걸로 판정하지 않는다.
 *  긍정 근거인 404/410 만 본다. */
export const isPostGone = (status: number): boolean => status === 404 || status === 410;

export type DeletionVerdict = 'deleted' | 'alive' | 'unknown';

/** 삭제 판정의 1차 근거. 인증된 목록 응답에서 logNo 가 사라졌는지를 본다.
 *  목록이 비었거나 응답이 200 이 아니면 세션이 끊겼을 수 있으므로 판정하지 않는다. */
export const judgePostListVerdict = (status: number, body: string, logNo: string): DeletionVerdict => {
  if (status !== 200) return 'unknown';

  const posts = parsePostListResponse(body);
  if (posts.length === 0) return 'unknown';

  return posts.some((post) => post.logNo === logNo) ? 'alive' : 'deleted';
};
