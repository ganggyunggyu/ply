import type { QuestionChoice, QuestionField, QuestionFieldType } from '../bridge';
import { QUESTION_FIELD_TYPES } from '../constants';

const isQuestionFieldType = (value: unknown): value is QuestionFieldType =>
  typeof value === 'string' && (QUESTION_FIELD_TYPES as readonly string[]).includes(value);

/**
 * 보기 하나를 { label, value } 로 좁힌다.
 * 모델이 문자열만 줄 수도 있어서 그때는 label 과 value 를 같은 값으로 둔다.
 */
const toQuestionChoice = (raw: unknown): QuestionChoice | null => {
  if (typeof raw === 'string') {
    const label = raw.trim();

    return label ? { label, value: label } : null;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const { label, value } = raw as Record<string, unknown>;
  const text = typeof label === 'string' ? label.trim() : '';
  if (!text) return null;

  const picked = value === undefined || value === null ? text : String(value).trim();

  return picked ? { label: text, value: picked } : null;
};

export type QuestionFieldsCheck =
  | { ok: true; fields: QuestionField[] }
  | { ok: false; reason: 'shape' | 'prefill'; key: string };

/**
 * 모델이 준 fields 를 패널이 그릴 수 있는 모양으로 좁힌다.
 * 하나라도 어긋나면 폼을 띄우지 않고 이유를 돌려준다. 반쪽짜리 폼은 사용자가 뭘 넣어야 할지 모른다.
 *
 * 미리 채운 value 가 choices 에 없으면 거부한다. 그대로 그리면 아무것도 안 골라진 빈 칸이 되는데,
 * 모델은 자기가 채운 값이 사라진 줄 모르고 그 값으로 진행했다고 믿는다.
 */
export const normalizeQuestionFields = (raw: unknown): QuestionFieldsCheck => {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'shape', key: '' };

  const fields: QuestionField[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, reason: 'shape', key: '' };

    const { key, label, placeholder, type, choices, value, optional } = item as Record<string, unknown>;

    if (typeof key !== 'string' || !key.trim()) return { ok: false, reason: 'shape', key: '' };
    if (typeof label !== 'string' || !label.trim()) return { ok: false, reason: 'shape', key };
    if (type !== undefined && !isQuestionFieldType(type)) return { ok: false, reason: 'shape', key };
    if (fields.some((field) => field.key === key)) return { ok: false, reason: 'shape', key };

    const options = Array.isArray(choices)
      ? choices
          .map(toQuestionChoice)
          .filter((choice): choice is QuestionChoice => choice !== null)
      : [];
    const prefill = value === undefined || value === null ? undefined : String(value);

    if (prefill && options.length > 0 && !options.some((choice) => choice.value === prefill)) {
      return { ok: false, reason: 'prefill', key };
    }

    fields.push({
      key,
      label,
      placeholder: typeof placeholder === 'string' && placeholder ? placeholder : undefined,
      type: isQuestionFieldType(type) ? type : undefined,
      choices: options.length > 0 ? options : undefined,
      value: prefill,
      optional: optional === true,
    });
  }

  return { ok: true, fields };
};
