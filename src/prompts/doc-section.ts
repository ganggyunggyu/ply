import { API_DOCS, API_DOC_TOPICS } from '../api-docs.generated';

export const DOC = {
  indexLead:
    '아래가 읽을 수 있는 주제 목록이다. topic 을 골라 read_api_doc 을 다시 부른다. 오른쪽은 그 문서가 다루는 말들이다.',
  indexTail:
    "도구가 없어 보이는 일이면 limits 를 먼저 읽는다. 안 되는 이유와 대신 되는 방법이 거기 적혀 있다. 문서 안의 '## 제목' 을 section 으로 주면 그 절만 읽는다.",
  unknownTopic: (value: string, topics: string[]) =>
    `${value} 라는 주제는 없다. 아래 중에서 고를 것: ${topics.join(', ')}`,
  unknownSection: (value: string, sections: string[]) =>
    `${value} 라는 절이 이 문서에 없다. 이 문서의 절은 아래와 같다: ${sections.join(' / ')}. section 을 빼면 문서 전체를 준다.`,
} as const;

/**
 * 시스템 프롬프트에 실을 문서 목차. 도구가 돌려주는 목차와 같은 함수에서 나온다.
 * 프롬프트에 목차를 손으로 적으면 그게 첫 번째 드리프트 지점이 된다.
 */
export const apiDocIndexLines = (): string[] =>
  API_DOC_TOPICS.map((topic) => `- ${topic}: ${API_DOCS[topic].triggers.join(', ')}`);

export const apiDocSection = () =>
  `## API 참조 문서

사용자가 시킨 일에 맞는 도구가 없어 보이면 "제가 할 수 없어요" 라고 말하기 전에 read_api_doc 을 먼저 읽는다.

${apiDocIndexLines().join('\n')}

limits 는 코드를 고쳐야만 되는 것들이다. "안 된다" 고 말하기 전에 반드시 여기부터 읽는다.
거기에는 왜 안 되는지와, 사용자가 진짜 원하는 것이 사실 다른 것은 아닌지까지 적혀 있다.`;
