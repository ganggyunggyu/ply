/**
 * 도구가 돌려준 문자열을 채팅에서 읽기 좋게 바꾼다.
 * JSON 이면 표나 목록으로, 아니면 그냥 텍스트로 둔다.
 * 도구 출력은 외부에서 온 값이므로 반드시 이스케이프한다.
 */

export type ToolView = {
  /** 접었을 때 한 줄 요약 */
  summary: string;
  /** 펼쳤을 때 보여줄 HTML. 없으면 원문을 그대로 쓴다. */
  html?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cell = (value: unknown): string => {
  if (value === true) return '<span class="yes">✓</span>';
  if (value === false) return '<span class="no">×</span>';
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return escapeHtml(JSON.stringify(value));

  return escapeHtml(String(value));
};

/** 표에서 굳이 안 보여줘도 되는 열 */
const NOISY_KEYS = new Set(['url', 'script']);

const buildTable = (rows: Record<string, unknown>[]) => {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((k) => !NOISY_KEYS.has(k));
  if (keys.length === 0) return null;

  const head = keys.map((k) => `<th>${escapeHtml(k)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${keys.map((k) => `<td>${cell(row[k])}</td>`).join('')}</tr>`)
    .join('');

  return `<table class="tool-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

const buildPairs = (obj: Record<string, unknown>) =>
  `<dl class="tool-pairs">${Object.entries(obj)
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${cell(v)}</dd>`)
    .join('')}</dl>`;

export const formatToolOutput = (raw: string): ToolView => {
  const text = raw.trim();
  if (!text) return { summary: '' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const oneLine = text.replace(/\s+/g, ' ');
    return { summary: oneLine, html: oneLine === text ? undefined : `<pre>${escapeHtml(text)}</pre>` };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { summary: '결과 없음' };

    if (parsed.every(isPlainObject)) {
      const table = buildTable(parsed as Record<string, unknown>[]);
      if (table) return { summary: `${parsed.length}개`, html: table };
    }

    const list = parsed.map((v) => cell(v)).join(', ');
    return { summary: `${parsed.length}개 · ${list}`.slice(0, 160), html: `<p>${list}</p>` };
  }

  if (isPlainObject(parsed)) {
    const keys = Object.keys(parsed);
    const preview = keys
      .slice(0, 3)
      .map((k) => `${k}: ${String(parsed[k]).slice(0, 24)}`)
      .join(' · ');

    return { summary: preview || '결과', html: buildPairs(parsed) };
  }

  return { summary: String(parsed) };
};
