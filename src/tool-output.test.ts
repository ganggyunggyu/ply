import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatToolOutput } from './tool-output';

test('객체 배열을 표로 만든다', () => {
  const view = formatToolOutput(
    JSON.stringify([
      { key: 'package', label: '패키지 시트', description: '패키지 상품 키워드 노출체크' },
      { key: 'cafe', label: '카페', description: '카페 노출체크' },
    ]),
  );

  assert.equal(view.summary, '2개');
  assert.match(view.html ?? '', /<table class="tool-table">/);
  assert.match(view.html ?? '', /<th>label<\/th>/);
  assert.match(view.html ?? '', /<td>패키지 시트<\/td>/);
});

test('불리언은 체크 표시로 바꾼다', () => {
  const view = formatToolOutput(JSON.stringify([{ name: '다붓', ok: true }, { name: '스케줄러', ok: false }]));

  assert.match(view.html ?? '', /class="yes"/);
  assert.match(view.html ?? '', /class="no"/);
});

test('시끄러운 열은 뺀다', () => {
  const view = formatToolOutput(JSON.stringify([{ name: 'a', url: 'http://x', ok: true }]));

  assert.equal((view.html ?? '').includes('<th>url</th>'), false);
  assert.match(view.html ?? '', /<th>name<\/th>/);
});

test('단일 객체는 키-값 목록', () => {
  const view = formatToolOutput(JSON.stringify({ title: '제목', body: '본문' }));

  assert.match(view.html ?? '', /<dt>title<\/dt><dd>제목<\/dd>/);
});

test('빈 배열과 빈 문자열', () => {
  assert.equal(formatToolOutput('[]').summary, '결과 없음');
  assert.equal(formatToolOutput('   ').summary, '');
});

test('JSON 이 아니면 한 줄로 준다', () => {
  assert.equal(formatToolOutput('로그인 성공').summary, '로그인 성공');
  assert.equal(formatToolOutput('로그인 성공').html, undefined);
});

test('여러 줄 텍스트는 pre 로 펼친다', () => {
  const view = formatToolOutput('첫 줄\n둘째 줄');

  assert.equal(view.summary, '첫 줄 둘째 줄');
  assert.match(view.html ?? '', /<pre>첫 줄\n둘째 줄<\/pre>/);
});

test('HTML 을 이스케이프한다', () => {
  const view = formatToolOutput(JSON.stringify([{ name: '<img src=x onerror=alert(1)>' }]));

  assert.equal((view.html ?? '').includes('<img'), false);
  assert.match(view.html ?? '', /&lt;img/);
});
