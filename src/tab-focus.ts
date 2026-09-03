/**
 * 새 탭을 만들었을 때 그 탭으로 화면을 옮길지 판정한다.
 *
 * 에이전트는 로그인·발행·목록·삭제마다 탭을 연다. 그때마다 화면을 뺏으면 사용자가 보던 페이지가
 * 작업 내내 튄다. 그래서 에이전트가 연 탭은 사이드바에만 나타나고 화면은 그대로 둔다.
 * 다만 활성 탭이 하나도 없을 때는 빈 화면이 남으므로 그때만 옮긴다.
 *
 * focus 는 그 규칙의 예외다. open_service 나 open_tab 처럼 사용자가 "열어줘" 라고 시켜서 여는 탭은
 * 보여주는 것이 목적이다. 안 보여주면 화면은 그대로인데 "열었어요" 라는 보고만 나간다.
 * openedByAgent 는 계속 true 로 둔다 — 사이드바 분류와 정리 대상 판정이 그 값을 본다.
 */
export const shouldFocusNewTab = ({
  openedByAgent,
  hasActive,
  focus = false,
}: {
  openedByAgent: boolean;
  hasActive: boolean;
  focus?: boolean;
}) => focus || !openedByAgent || !hasActive;
