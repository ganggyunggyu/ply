/**
 * 탭이 다른 탭을 열었을 때의 부모-자식 관계를 다룬다.
 *
 * setWindowOpenHandler 가 만드는 팝업 탭은 자기를 연 탭의 openedByAgent 를 그대로 물려받는다.
 * 그런데 작업이 끝나고 닫히는 것은 에이전트가 직접 만든 탭 하나뿐이라, 발행이나 로그인 중에
 * 뜬 팝업은 아무도 닫지 않는다. 부모를 닫을 때 그 아래 딸린 탭까지 같이 걷어내려고 관계를 남긴다.
 */

export type TabLink = { id: number; openerId?: number };

/**
 * id 를 닫을 때 같이 닫아야 하는 탭. 자기 자신은 넣지 않는다.
 *
 * 사용자가 연 탭은 대상이 아니다. 사용자가 링크를 눌러 띄운 창을 에이전트 작업이 끝났다고
 * 같이 닫으면 보고 있던 화면이 사라진다.
 */
export const descendantTabIds = (tabs: readonly TabLink[], id: number): number[] => {
  const found: number[] = [];
  const frontier = [id];

  while (frontier.length > 0) {
    const parent = frontier.pop();

    tabs.forEach((tab) => {
      if (tab.openerId !== parent || tab.id === id || found.includes(tab.id)) return;

      found.push(tab.id);
      frontier.push(tab.id);
    });
  }

  return found;
};
