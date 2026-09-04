import type { Session } from 'electron';
import type { ImportedCookie } from './cookies';

export type CookieInjectResult = {
  set: number;
  failed: number;
};

/**
 * host_key 로 쿠키 url 을 만든다. 앞의 점(.example.com)은 도메인 전체에 걸리는 쿠키라는 뜻이라
 * url 을 만들 땐 떼어낸다. secure 쿠키는 https, 아니면 http 로 스킴을 맞춰야 set 이 거부되지 않는다.
 */
const cookieUrl = ({ hostKey, secure }: ImportedCookie): string => {
  const host = hostKey.replace(/^\./, '');
  return `${secure ? 'https' : 'http'}://${host}`;
};

/**
 * 크롬에서 읽은 쿠키를 Ply 프로필 세션에 넣는다. 이러면 그 프로필로 연 탭이 로그인 상태를 그대로
 * 이어받는다. 개별 set 실패(잘못된 도메인 등)는 그 쿠키만 세고 넘어간다 — 하나 때문에 전체가 멈추면 안 된다.
 *
 * domain 은 host_key 를 그대로 준다. 앞에 점이 있으면 서브도메인까지 걸리는 쿠키라 electron 도 그 규칙을
 * 따르므로 점을 유지한다(url 에서만 뗐다). expirationDate 는 초 단위라 저장된 ms 를 1000 으로 나눈다.
 */
export const injectCookies = async (
  session: Session,
  cookies: ImportedCookie[],
): Promise<CookieInjectResult> => {
  let set = 0;
  let failed = 0;

  for (const cookie of cookies) {
    try {
      await session.cookies.set({
        url: cookieUrl(cookie),
        name: cookie.name,
        value: cookie.value,
        domain: cookie.hostKey,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expires > 0 ? cookie.expires / 1000 : undefined,
      });
      set += 1;
    } catch {
      failed += 1;
    }
  }

  return { set, failed };
};
