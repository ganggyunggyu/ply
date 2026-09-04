import { EXPOSURE_DASHBOARD_URL } from '../constants';

export type ServiceEndpoints = {
  dabutBaseUrl: string;
  schedulerBaseUrl: string;
  exposureBotDir: string;
  /**
   * 노출지기 대시보드. 도구가 HTTP 로 부르는 곳이라 카탈로그가 아니라 여기 있다.
   * 주소 리터럴은 constants.ts 하나뿐이고 카탈로그도 같은 값을 본다.
   */
  exposureDashboardUrl: string;
  /** 바이로. 서비스 목록에 없고 api_get 으로만 다룬다. */
  viroBaseUrl: string;
};

/**
 * 배포된 서비스가 기본값이다. 설치만 하면 어느 컴퓨터에서든 바로 돌아야 하므로
 * 로컬 주소를 기본으로 두지 않는다. 자기 서버를 쓰려면 패널 설정에서 바꾸고,
 * 바꾼 값은 settings.json 에만 저장된다.
 *
 * exposureBotDir 만 비워 둔다. 저장소 경로는 컴퓨터마다 다르다.
 */
export const DEFAULT_ENDPOINTS: ServiceEndpoints = {
  dabutBaseUrl: 'https://blog-analyzer.fly.dev',
  schedulerBaseUrl: 'https://21lab-scheduler.fly.dev',
  exposureBotDir: '',
  exposureDashboardUrl: EXPOSURE_DASHBOARD_URL,
  viroBaseUrl: 'https://cafe-bot-two.vercel.app',
};
