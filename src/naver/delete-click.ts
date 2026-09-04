import type { Frame } from 'playwright-core';
import { ERRORS } from '../messages';
import { clickFirstAvailable } from './click-helpers';

/** 에디터 세대마다 다르다. 구형 스킨은 pcol1 과 itemSubjectBoldfont 가 같은 엘리먼트에 붙기도 한다. */
const POST_TITLE_SELECTORS = [
  '.se-documentTitle .se-text-paragraph',
  '.se_title .se_textarea',
  '.pcol1 .itemSubjectBoldfont',
  '.pcol1.itemSubjectBoldfont',
  '.htitle',
];

export const readPostTitle = async (frame: Frame): Promise<string | null> => {
  for (const selector of POST_TITLE_SELECTORS) {
    try {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) === 0) continue;

      const text = (await locator.innerText({ timeout: 3000 })).trim();
      if (text) return text;
    } catch {
      continue;
    }
  }

  return null;
};

/** 소유자에게만 렌더된다. 배포 JS 의 클릭 라우터가 _deletePost -> postView.deletePost 로 연결한다. */
export const POST_DELETE_SELECTORS = [
  'a._deletePost',
  'a.btn_del._deletePost',
  '.post_btn_area a._deletePost',
];

/** 렌더된 그 글의 버튼을 누르는 쪽이 제목 재확인이 실제로 보호하는 경로다.
 *  클릭이 페이지를 넘겨 컨텍스트가 날아가도 삭제 요청은 이미 나갔을 수 있으므로 검증 단계로 흘려보낸다. */
/** 한 글에도 삭제 링크가 위아래로 두 개 붙는다. 둘은 같은 버튼이 아니다.
 *  하나는 클래스에 _param(<logNo>|...) 로 대상 글 번호를 박고 있고,
 *  다른 하나는 _param(1|...) 처럼 화면 안의 순번을 쓴다. 순번 쪽을 누르면
 *  화면 구성이 달라졌을 때 엉뚱한 글이 지워진다. 그래서 번호가 박힌 쪽만 고른다. */
export const clickDeleteButton = async (frame: Frame, logNo: string): Promise<boolean> => {
  const seen = await frame
    .evaluate((target) => {
      const links = Array.from(document.querySelectorAll<HTMLElement>('a._deletePost'));
      const exact = links.filter((link) => link.className.includes(`_param(${target}|`));
      const [only] = exact;

      if (only && exact.length === 1) {
        only.click();
        return { clicked: true, exact: exact.length, links: links.length, rendered: 0 };
      }

      return {
        clicked: false,
        exact: exact.length,
        links: links.length,
        rendered: document.querySelectorAll('.se-main-container').length,
      };
    }, logNo)
    .catch(() => null);

  // evaluate 가 죽는 건 클릭이 폼을 보내며 실행 컨텍스트를 날린 경우다. 실패가 아니라 진행 신호다.
  if (!seen || seen.clicked) return true;

  // 번호가 박힌 링크가 없으면 화면에 글이 정확히 하나일 때만 눈에 보이는 링크를 쓴다.
  if (seen.rendered !== 1) {
    throw new Error(ERRORS.deleteAmbiguousDetail(seen.exact, seen.links, seen.rendered));
  }

  try {
    return await clickFirstAvailable(frame, POST_DELETE_SELECTORS);
  } catch {
    return true;
  }
};
