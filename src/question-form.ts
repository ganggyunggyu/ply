import type { QuestionField } from './bridge';

/**
 * 폼형 질문의 판정 로직. DOM 을 만지지 않는다.
 *
 * 패널(panel.ts)은 브라우저 번들이라 테스트가 붙지 않는다. 그래서 "무엇이 골라졌는가",
 * "무엇이 비었는가", "화면에 뭐라고 되비출 것인가" 는 전부 여기로 빼서 순수 함수로 둔다.
 * panel.ts 에는 이 결과를 element 로 옮기는 일만 남긴다.
 */

export type ChoiceOption = { label: string; value: string; selected: boolean };

/**
 * select 에 그릴 보기 목록. 맨 앞은 항상 값이 빈 자리표시자다.
 *
 * 자리표시자가 없으면 첫 보기가 기본 답이 되어, 사용자가 드롭다운을 열어보지도 않고
 * 확인을 눌러도 "첫 번째 프로젝트를 골랐다" 로 넘어간다. 되돌리기 어려운 예약 발행에서
 * "고르지 않음" 과 "첫 번째" 는 구분되어야 한다.
 *
 * 모델이 준 value 가 보기에 없으면 아무것도 고르지 않은 상태로 둔다.
 * (도구 단계에서 이미 거르지만, 여기서도 -1 selectedIndex 로 새지 않게 막는다.)
 */
export const buildChoiceOptions = (
  { choices = [], value }: QuestionField,
  placeholderLabel: string,
): ChoiceOption[] => {
  const picked = choices.some((choice) => choice.value === value) ? value : '';

  return [
    { label: placeholderLabel, value: '', selected: picked === '' },
    ...choices.map(({ label, value: choiceValue }) => ({
      label,
      value: choiceValue,
      selected: choiceValue === picked,
    })),
  ];
};

export type InvalidField = { key: string; label: string; reason: 'badInput' | 'required' };

/**
 * 첫 번째로 막히는 칸을 돌려준다. 판정 순서를 바꾸지 않는다.
 * number/date/time 은 반쯤 입력하면 Chromium 이 value 를 '' 로 준다. badInput 을 먼저 봐야
 * "채워주세요" 대신 "값을 확인해 주세요" 가 뜬다.
 */
export const findInvalidField = (
  fields: QuestionField[],
  values: Record<string, string>,
  badInputKeys: ReadonlySet<string>,
): InvalidField | null => {
  for (const { key, label, optional } of fields) {
    if (badInputKeys.has(key)) return { key, label, reason: 'badInput' };
    if (!optional && (values[key] ?? '').trim() === '') return { key, label, reason: 'required' };
  }

  return null;
};

/**
 * 화면에 되비출 줄. 보기 칸은 사용자가 실제로 본 라벨로 적는다.
 * value 가 프로젝트 id 라서 그대로 적으면 사용자는 자기가 뭘 골랐는지 알아볼 수 없다.
 */
export const buildFormEchoLines = (
  fields: QuestionField[],
  values: Record<string, string>,
): string[] =>
  fields.flatMap(({ key, label, choices }) => {
    const value = (values[key] ?? '').trim();
    if (!value) return [];

    const picked = choices?.find((choice) => choice.value === value)?.label ?? value;

    return [`${label}: ${picked}`];
  });
