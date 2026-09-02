import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderMarkdown } from './markdown';

test('HTML 을 먼저 이스케이프한다', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');

  assert.equal(html.includes('<img'), false);
  assert.match(html, /&lt;img/);
});

test('볼드와 인라인 코드', () => {
  assert.match(renderMarkdown('**계정**: sampleid'), /<strong>계정<\/strong>/);
  assert.match(renderMarkdown('`npm run dev` 실행'), /<code>npm run dev<\/code>/);
});

test('불릿과 번호 목록', () => {
  assert.match(renderMarkdown('- 하나\n- 둘'), /<ul><li>하나<\/li><li>둘<\/li><\/ul>/);
  assert.match(renderMarkdown('1. 먼저\n2. 다음'), /<ol><li>먼저<\/li><li>다음<\/li><\/ol>/);
});

test('표를 그린다', () => {
  const html = renderMarkdown('| ID | 저장 |\n|---|---|\n| sampleid | 됨 |');

  assert.match(html, /<table>/);
  assert.match(html, /<th>ID<\/th>/);
  assert.match(html, /<td>sampleid<\/td>/);
  assert.equal(html.includes('---'), false);
});

test('http 링크만 클릭 가능하게 만든다', () => {
  assert.match(renderMarkdown('https://blog.naver.com/a/1'), /<a href="https:\/\/blog\.naver\.com\/a\/1"/);
  assert.equal(renderMarkdown('javascript:alert(1)').includes('<a '), false);
  assert.equal(renderMarkdown('[클릭](javascript:alert(1))').includes('<a '), false);
});

test('문단 안 줄바꿈은 br 로 유지한다', () => {
  assert.match(renderMarkdown('첫 줄\n둘째 줄'), /첫 줄<br>둘째 줄/);
});

test('헤딩을 h3~h4 로 낮춘다', () => {
  assert.match(renderMarkdown('## 등록된 계정'), /<h4>등록된 계정<\/h4>/);
  assert.match(renderMarkdown('# 제목'), /<h3>제목<\/h3>/);
  assert.equal(renderMarkdown('### 소제목').includes('###'), false);
});

test('빈 입력은 빈 문자열', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown('   \n  '), '');
});
