import type { PublicSettings } from '../bridge';
import { panelState } from './state';

/**
 * 설정에서 서비스 주소 칸을 뺐다(그냥 탭으로 여는 화면이라 배포 주소 기본값으로 충분하다).
 * 카탈로그 자체는 계속 받는다. 쿠키 로그인 카드와 연동 칩이 이 목록으로 그려진다.
 */
export const applySettings = (settings: PublicSettings) => {
  panelState.serviceCatalog = settings.services;
};
