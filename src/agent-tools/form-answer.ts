import type { QuestionField } from '../bridge';
import { QUESTION_FORM_CANCEL } from '../constants';

export type FormAnswer =
  | { cancelled: true }
  | { cancelled: false; values: Record<string, string> };

/** 패널이 JSON 문자열로 답한다. 못 읽으면 취소로 본다. 값을 지어내는 것보다 멈추는 게 낫다. */
export const parseFormAnswer = (raw: string): FormAnswer => {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { cancelled: true };
    if ((parsed as Record<string, unknown>)[QUESTION_FORM_CANCEL] === true) return { cancelled: true };

    const values: Record<string, string> = {};

    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      values[key] = String(value);
    });

    return { cancelled: false, values };
  } catch {
    return { cancelled: true };
  }
};

/** 모델에게는 원시 JSON 대신 키: 값 줄로 준다. JSON 을 보여주면 그대로 따라 쓰다가 따옴표를 섞는다. */
export const formatFormAnswer = (fields: QuestionField[], values: Record<string, string>): string[] =>
  fields.flatMap(({ key }) => {
    const value = values[key] ?? '';

    return value.trim() === '' ? [] : [`${key}: ${value}`];
  });
