export const splitManuscript = (raw: string) => {
  const lines = raw.trim().split('\n');
  const title = (lines[0] ?? '').trim().replace(/^제목\s*[:：]\s*/, '');
  const body = lines.slice(1).join('\n').trim();

  return { title, body: body || raw.trim() };
};
