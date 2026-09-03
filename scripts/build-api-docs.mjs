/**
 * docs/api/*.md -> src/api-docs.generated.ts
 *
 * 문서에 실행 가능한 값(주소, enum, 도구 이름)을 타이핑하지 않는다. 자리표시자로 쓰고
 * 여기서 코드의 실제 값으로 채운다. 값이 코드에서 바뀌면 문서가 자동으로 따라간다.
 *
 * 목록에 없는 자리표시자가 하나라도 있으면 빌드가 죽는다. 조용히 `{{...}}` 를 남기면
 * 모델이 그 문자열을 값으로 읽는다.
 *
 * 생성물은 커밋한다. 커밋해야 `tsx --test` 가 로더 없이 import 한다.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const docsDir = join(root, 'docs', 'api');
const outFile = join(root, 'src', 'api-docs.generated.ts');

const readSource = (relative) => readFileSync(join(root, 'src', relative), 'utf-8');

/** `export const NAME = [ 'a', 'b' ] as const;` 에서 문자열만 뽑는다. */
const readStringArray = (source, name) => {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`[api-docs] ${name} 을(를) 찾지 못했다`);

  return [...match[1].matchAll(/'([^']*)'/g)].map(([, value]) => value);
};

/** 객체 리터럴 안의 `key: 'value'` 하나. */
const readStringField = (source, name) => {
  const match = source.match(new RegExp(`${name}:\\s*'([^']*)'`));
  if (!match) throw new Error(`[api-docs] ${name} 값을 찾지 못했다`);

  return match[1];
};

/** `export const NAME = 'value';` 하나. */
const readStringConst = (source, name) => {
  const match = source.match(new RegExp(`export const ${name} = '([^']*)';`));
  if (!match) throw new Error(`[api-docs] ${name} 값을 찾지 못했다`);

  return match[1];
};

const hub = readSource('hub.ts');
const constants = readSource('constants.ts');
const enums = readSource('scheduler-enums.ts');
const presets = readSource('exposure-preset.ts');
const access = readSource('api-access.ts');

const list = (values) => values.join(', ');

const PLACEHOLDERS = {
  dabutBaseUrl: readStringField(hub, 'dabutBaseUrl'),
  schedulerBaseUrl: readStringField(hub, 'schedulerBaseUrl'),
  exposureDashboardUrl: readStringConst(constants, 'EXPOSURE_DASHBOARD_URL'),
  manuscriptTypes: list(readStringArray(enums, 'MANUSCRIPT_TYPES')),
  imageSources: list(readStringArray(enums, 'IMAGE_SOURCES')),
  scheduleStatuses: list(readStringArray(enums, 'SCHEDULE_STATUSES')),
  scheduleJobStatuses: list(readStringArray(enums, 'SCHEDULE_JOB_STATUSES')),
  presetActions: list(readStringArray(presets, 'PRESET_ACTIONS')),
  apiServices: list(readStringArray(access, 'API_SERVICES')),
};

const fillPlaceholders = (text, file) =>
  text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = PLACEHOLDERS[key];
    if (value === undefined) {
      throw new Error(`[api-docs] ${file}: 모르는 자리표시자 {{${key}}}`);
    }

    return value;
  });

/** `---` 로 감싼 아주 작은 frontmatter. 값은 스칼라와 `- ` 목록뿐이다. */
const parseFrontmatter = (raw, file) => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`[api-docs] ${file}: frontmatter 가 없다`);

  const meta = {};
  let currentKey = null;

  match[1].split('\n').forEach((line) => {
    if (!line.trim()) return;

    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && currentKey) {
      meta[currentKey].push(item[1].trim());
      return;
    }

    const pair = line.match(/^(\w+):\s*(.*)$/);
    if (!pair) throw new Error(`[api-docs] ${file}: frontmatter 줄을 읽지 못했다 -> ${line}`);

    const [, key, value] = pair;
    currentKey = key;

    if (value === '') {
      meta[key] = [];
      return;
    }

    const inline = value.match(/^\[(.*)\]$/);
    meta[key] = inline
      ? inline[1]
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : value;
  });

  return { meta, body: match[2].trim() };
};

/** `## 제목` 단위로 쪼갠다. 에이전트가 필요한 절만 읽는다. */
const splitSections = (body) => {
  const sections = {};
  let title = null;
  let lines = [];

  const flush = () => {
    if (title !== null) sections[title] = lines.join('\n').trim();
  };

  body.split('\n').forEach((line) => {
    const heading = line.match(/^##\s+(.*)$/);
    if (!heading) {
      lines.push(line);
      return;
    }

    flush();
    title = heading[1].trim();
    lines = [];
  });

  flush();

  return sections;
};

const files = readdirSync(docsDir)
  .filter((name) => name.endsWith('.md'))
  .sort();

const docs = files.map((file) => {
  // 윈도우 체크아웃은 md 를 CRLF 로 받는다. 그대로 넣으면 생성물이 플랫폼마다 달라져서
  // "다시 만든 것과 같다" 검사가 CI 윈도우에서만 깨진다.
  const raw = readFileSync(join(docsDir, file), 'utf-8').replace(/\r\n/g, '\n');
  const { meta, body } = parseFrontmatter(fillPlaceholders(raw, file), file);

  ['topic', 'title', 'triggers', 'routes', 'tools'].forEach((key) => {
    if (meta[key] === undefined) throw new Error(`[api-docs] ${file}: frontmatter 에 ${key} 가 없다`);
  });

  if (`${meta.topic}.md` !== file) {
    throw new Error(`[api-docs] ${file}: topic(${meta.topic}) 과 파일 이름이 다르다`);
  }

  return { ...meta, body, sections: splitSections(body) };
});

const json = (value) => JSON.stringify(value, null, 2);

const generated = `/**
 * 이 파일은 생성물이다. 손으로 고치지 않는다.
 * 원본은 docs/api/*.md 이고 scripts/build-api-docs.mjs 가 만든다. 고칠 곳은 md 쪽이다.
 */

export const API_DOC_TOPICS = ${json(docs.map(({ topic }) => topic))} as const;

export type ApiDocTopic = (typeof API_DOC_TOPICS)[number];

export type ApiDocPage = {
  title: string;
  triggers: string[];
  routes: string[];
  tools: string[];
  /** '## 제목' 단위로 쪼갠 본문 */
  sections: Record<string, string>;
  body: string;
};

export const API_DOCS: Record<ApiDocTopic, ApiDocPage> = ${json(
  Object.fromEntries(
    docs.map(({ topic, title, triggers, routes, tools, sections, body }) => [
      topic,
      { title, triggers, routes, tools, sections, body },
    ]),
  ),
)};
`;

writeFileSync(outFile, generated, 'utf-8');
console.log(`[api-docs] ${docs.length}개 주제 -> src/api-docs.generated.ts`);
