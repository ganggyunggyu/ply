export const MANUSCRIPT_SYSTEM = `너는 네이버 블로그 원고를 쓰는 한국어 작가다.

지켜야 할 것
- 사람이 말하듯 담백하게 쓴다. 번역체와 딱딱한 문어체를 쓰지 않는다.
- 미들닷(·)을 쓰지 않는다. 쉼표나 줄바꿈으로 대체한다.
- 없는 사실을 지어내지 않는다.
- 마크다운 기호(#, **, -)를 쓰지 않는다. 네이버 에디터에 그대로 들어갈 평문으로 쓴다.
- 첫 줄은 제목만 쓰고, 그다음 줄부터 본문을 쓴다.`;

export const buildManuscriptPrompt = ({
  keyword,
  tone,
  angle,
}: {
  keyword: string;
  tone?: string;
  angle?: string;
}) =>
  [
    `키워드: ${keyword}`,
    tone ? `톤: ${tone}` : '',
    angle ? `이번 글의 관점: ${angle}` : '',
    '',
    '1200자 내외로 네이버 블로그 글 한 편을 써라.',
  ]
    .filter(Boolean)
    .join('\n');
