import { catalogSummary } from '../services';

/**
 * 주소가 설정된 서비스만 모델에게 보여준다.
 * 코드 기본값은 example.com 이고 그 도메인은 실제로 응답한다.
 * 미설정 항목을 그대로 실으면 모델이 그 주소를 진짜로 믿고 열어 "열었어요" 라고 보고한다.
 */
export const serviceSection = () => {
  const summary = catalogSummary();

  if (!summary) {
    return `## 사용자가 쓰는 서비스

아직 주소가 있는 서비스가 없다. open_service 로 열 수 있는 화면이 하나도 없다.
서비스 이름이 나오면 주소를 추측하거나 지어내지 말고, 그 화면 주소를 몰라서 열지 못한다고 한 줄로 알린다.`;
  }

  return `## 사용자가 쓰는 서비스 (아래 주소는 이 앱이 알고 있는 값이다. 사용자에게 다시 묻지 마라)

${summary}

여기 있는 서비스 이름이 나오면 open_service 로 바로 연다. "주소를 알려주시면" 같은 말을 하지 않는다.
여기 없는 이름은 주소를 모르는 것이다. 지어내지 말고 설정에서 넣어달라고 알린다.`;
};
