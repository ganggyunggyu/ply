import { TOOL_RESULTS as RESULT } from '../../prompts';
import { describeExposureError, isExposureCookieExpired, isExposureUnauthorized } from '../../exposure-api';
import type { ToolRuntime } from '../runtime';

export const createExposureSessionHelpers = (runtime: ToolRuntime) => {
  const { getExposureCookie, clearExposureCookie, getEndpoints } = runtime;

  /**
   * 노출지기를 쓰는 도구가 공통으로 지나는 문. 쿠키가 없거나 확실히 죽었으면 여기서 끊는다.
   * 만료 판정은 문자열만 보고 하므로 네트워크를 타지 않는다. 서명 검증은 서버가 401 로 한다.
   */
  const exposureSession = ():
    | { ok: true; baseUrl: string; cookie: string }
    | { ok: false; result: string } => {
    const cookie = getExposureCookie();
    if (!cookie) return { ok: false, result: RESULT.exposureNotLoggedIn };

    if (isExposureCookieExpired(cookie, Date.now())) {
      clearExposureCookie();

      return { ok: false, result: RESULT.exposureSessionExpired };
    }

    return { ok: true, baseUrl: getEndpoints().exposureDashboardUrl, cookie };
  };

  /** 401 은 쿠키를 지우고 다시 로그인시키는 유일한 신호다. 그 밖의 실패는 원문을 그대로 올린다. */
  const describeExposureFailure = (error: unknown): string => {
    if (isExposureUnauthorized(error)) {
      clearExposureCookie();

      return RESULT.exposureSessionExpired;
    }

    return RESULT.exposureRequestFailed(describeExposureError(error));
  };

  return { exposureSession, describeExposureFailure };
};
