
const QUIET_INPUT_KEYS = new Set(['reason', 'question', 'body']);

export const summarizeInput = (input: Record<string, unknown>) => {
  const entries = Object.entries(input).filter(
    ([k, v]) => v !== undefined && v !== '' && !QUIET_INPUT_KEYS.has(k),
  );
  if (entries.length === 0) return '';

  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')
    .slice(0, 240);
};
