import { settingsEl, epExposureEl } from './dom';

export const handleSettingsToggle = () => {
  settingsEl.hidden = !settingsEl.hidden;
};

/** 칩이 곧 설정으로 가는 문이다. 남은 연동 값은 노출지기 저장소 경로와 다붓 계정이다. */
export const handleServiceChipClick = () => {
  settingsEl.hidden = false;
  epExposureEl.scrollIntoView({ block: 'nearest' });
  epExposureEl.focus();
};
