import type { AxiosInstance } from 'axios';

export type CaptchaKind = 'login' | 'cafe-join' | 'cafe-create';

type SolveOptions = {
  client: AxiosInstance;
  schedulerBaseUrl: string;
  token?: string;
  image: string;
  kind: CaptchaKind;
  /** 로그인 캡차만 질문이 있다. 카페 보안문자는 이미지뿐이다. */
  question?: string;
};

/**
 * 보안문자 풀이는 스케줄러 한 곳에서만 한다.
 *
 * 이 앱에는 모델 키가 OpenRouter 하나뿐이고 캡차 프롬프트는 스케줄러가 들고 있다.
 * 여기서 따로 풀면 프롬프트가 두 벌이 되고 한쪽만 고쳐지는 일이 생긴다.
 */
export const solveCaptcha = async ({
  client,
  schedulerBaseUrl,
  token,
  image,
  kind,
  question,
}: SolveOptions): Promise<string> => {
  const { data } = await client.post<{ answer?: string }>(
    `${schedulerBaseUrl}/api/captcha/solve`,
    { image, kind, ...(question ? { question } : {}) },
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
  );

  return data.answer?.trim() ?? '';
};
