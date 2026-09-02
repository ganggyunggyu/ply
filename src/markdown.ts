/**
 * 에이전트가 내놓는 마크다운을 안전한 HTML 로 바꾼다.
 * 모델 출력이므로 반드시 이스케이프를 먼저 하고 그 위에 서식을 얹는다.
 * 지원: 볼드, 인라인 코드, 불릿, 번호 목록, 표, 링크(http/https 만), 줄바꿈.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SAFE_URL = /^https?:\/\/[^\s<>"']+$/i;

export const linkify = (escaped: string) =>
  escaped
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (whole, text: string, url: string) =>
      SAFE_URL.test(url) ? `<a href="${url}" target="_blank" rel="noreferrer">${text}</a>` : whole,
    )
    .replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+)/g, (whole, lead: string, url: string) =>
      SAFE_URL.test(url) ? `${lead}<a href="${url}" target="_blank" rel="noreferrer">${url}</a>` : whole,
    );

const inline = (raw: string) => {
  const escaped = escapeHtml(raw);
  const linked = linkify(escaped);

  return linked
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
};

const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
const isTableDivider = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

const splitCells = (line: string) =>
  line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());

const renderTable = (rows: string[]) => {
  const [head, ...rest] = rows;
  const body = rest.filter((row) => !isTableDivider(row));

  const headCells = splitCells(head ?? '')
    .map((cell) => `<th>${inline(cell)}</th>`)
    .join('');
  const bodyRows = body
    .map((row) => `<tr>${splitCells(row).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
};

export const renderMarkdown = (source: string): string => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min((heading[1] ?? '').length + 2, 4);
      out.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      index += 1;
      continue;
    }

    if (isTableRow(line)) {
      const rows: string[] = [];
      while (index < lines.length && isTableRow(lines[index] ?? '')) {
        rows.push(lines[index] ?? '');
        index += 1;
      }
      out.push(renderTable(rows));
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? '')) {
        items.push(`<li>${inline((lines[index] ?? '').replace(/^\s*[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? '')) {
        items.push(`<li>${inline((lines[index] ?? '').replace(/^\s*\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !isTableRow(lines[index] ?? '') &&
      !/^#{1,3}\s+/.test(lines[index] ?? '') &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[index] ?? '')
    ) {
      paragraph.push(inline(lines[index] ?? ''));
      index += 1;
    }
    out.push(`<p>${paragraph.join('<br>')}</p>`);
  }

  return out.join('');
};
