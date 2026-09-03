/**
 * 생성된 API 참조 문서를 읽는 얇은 층.
 *
 * 문서를 두는 이유는 도구를 대체하려는 것이 아니라 **읽기 도구를 안 만들려는 것**이다.
 * 쓰기는 여전히 도구가 한다. 도구는 HTTP 래퍼가 아니라 서버에 없는 안전장치를 들고 있다.
 *
 * 목차는 손으로 쓰지 않는다. 프롬프트에 박으면 그게 첫 번째 드리프트 지점이 된다.
 */
import { API_DOCS, API_DOC_TOPICS, type ApiDocPage, type ApiDocTopic } from './api-docs.generated';
import { apiDocIndexLines, DOC as D } from './prompts';

/*
 * import 방향에 순환이 없다.
 *   api-docs.generated (아무것도 import 하지 않는다)
 *     <- prompts (목차 문장을 만든다)
 *       <- api-docs (도구가 부르는 층)
 * 목차를 여기서 따로 만들지 않는 이유는 프롬프트에 실리는 목차와 도구가 돌려주는 목차가
 * 반드시 같아야 하기 때문이다. 구현이 둘이면 어긋난다.
 */

export { API_DOCS, API_DOC_TOPICS };
export type { ApiDocPage, ApiDocTopic };

export const isApiDocTopic = (value: unknown): value is ApiDocTopic =>
  typeof value === 'string' && (API_DOC_TOPICS as readonly string[]).includes(value);

/** 시스템 프롬프트와 topic 생략 시의 목차. 둘이 같은 함수에서 나온다. */
export const apiDocIndex = (): string[] => apiDocIndexLines();

/** 절 제목 목록. 전문을 다 싣기 전에 무엇이 있는지만 보여줄 때 쓴다. */
export const apiDocSections = (topic: ApiDocTopic): string[] => Object.keys(API_DOCS[topic].sections);

/**
 * 절 이름을 찾는다. 모델이 '## ' 를 붙여 보내거나 대소문자·공백이 어긋나도 받는다.
 * 못 찾으면 null 이고, 부르는 쪽이 있는 절 목록을 돌려준다.
 */
export const findApiDocSection = (topic: ApiDocTopic, wanted: string): string | null => {
  const needle = wanted.replace(/^#+\s*/, '').trim().toLowerCase();
  if (!needle) return null;

  const { sections } = API_DOCS[topic];

  return (
    Object.keys(sections).find((title) => title.toLowerCase() === needle) ??
    Object.keys(sections).find((title) => title.toLowerCase().includes(needle)) ??
    null
  );
};

export const readApiDoc = (rawTopic?: string, rawSection?: string): string => {
  if (!rawTopic) return [D.indexLead, ...apiDocIndex(), D.indexTail].join('\n');

  if (!isApiDocTopic(rawTopic)) return D.unknownTopic(rawTopic, [...API_DOC_TOPICS]);

  const page = API_DOCS[rawTopic];

  if (!rawSection) return [`# ${page.title}`, '', page.body].join('\n');

  const title = findApiDocSection(rawTopic, rawSection);
  if (!title) return D.unknownSection(rawSection, apiDocSections(rawTopic));

  return [`# ${page.title} — ${title}`, '', page.sections[title] ?? ''].join('\n');
};
