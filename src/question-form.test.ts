import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { QuestionField } from './bridge';
import { buildChoiceOptions, buildFormEchoLines, findInvalidField } from './question-form';

const PLACEHOLDER = '고르기';

const projectField: QuestionField = {
  key: 'projectId',
  label: '원고 스타일',
  choices: [
    { label: '펫 프로젝트', value: '68f1a2b3' },
    { label: '맛집 프로젝트', value: '68f1a2c4' },
  ],
};

test('필수 보기 칸도 아무것도 안 골라진 상태로 시작한다', () => {
  // 자리표시자가 없으면 첫 보기가 기본 답이 되어, 드롭다운을 열어보지도 않은 사용자가
  // 확인만 눌러도 첫 번째 프로젝트가 골라진 것처럼 넘어간다.
  const options = buildChoiceOptions(projectField, PLACEHOLDER);

  assert.deepEqual(options, [
    { label: PLACEHOLDER, value: '', selected: true },
    { label: '펫 프로젝트', value: '68f1a2b3', selected: false },
    { label: '맛집 프로젝트', value: '68f1a2c4', selected: false },
  ]);
});

test('미리 채운 값이 있으면 그 보기가 골라진다', () => {
  const options = buildChoiceOptions({ ...projectField, value: '68f1a2c4' }, PLACEHOLDER);

  assert.deepEqual(
    options.filter(({ selected }) => selected),
    [{ label: '맛집 프로젝트', value: '68f1a2c4', selected: true }],
  );
});

test('보기에 없는 값을 미리 채우면 자리표시자로 남는다', () => {
  const options = buildChoiceOptions({ ...projectField, value: '없는id' }, PLACEHOLDER);

  assert.equal(options[0]?.selected, true);
  assert.equal(options.filter(({ selected }) => selected).length, 1);
});

test('선택 칸이 아니면 보기가 자리표시자 하나뿐이다', () => {
  assert.deepEqual(buildChoiceOptions({ key: 'a', label: '가' }, PLACEHOLDER), [
    { label: PLACEHOLDER, value: '', selected: true },
  ]);
});

const scheduleFields: QuestionField[] = [
  { key: 'scheduleDate', label: '발행 날짜', type: 'date' },
  { key: 'postsPerDay', label: '하루 건수', type: 'number' },
  { key: 'memo', label: '메모', optional: true },
];

test('비어 있는 필수 칸을 위에서부터 하나 찾는다', () => {
  const invalid = findInvalidField(
    scheduleFields,
    { scheduleDate: '2026-09-10', postsPerDay: '  ', memo: '' },
    new Set(),
  );

  assert.deepEqual(invalid, { key: 'postsPerDay', label: '하루 건수', reason: 'required' });
});

test('반쯤 입력한 숫자는 빈 칸이 아니라 잘못된 값으로 잡는다', () => {
  // Chromium 은 1e 같은 입력에 value 를 '' 로 준다. 같은 칸에서 badInput 을 먼저 봐야 문구가 맞다.
  const invalid = findInvalidField(
    scheduleFields,
    { scheduleDate: '2026-09-10', postsPerDay: '', memo: '' },
    new Set(['postsPerDay']),
  );

  assert.deepEqual(invalid, { key: 'postsPerDay', label: '하루 건수', reason: 'badInput' });
});

test('막힌 칸은 필드 순서대로 위에서부터 알린다', () => {
  // 아래 칸이 잘못됐어도 위의 빈 칸을 먼저 알린다. 사용자는 위에서부터 채운다.
  const invalid = findInvalidField(
    scheduleFields,
    { scheduleDate: '', postsPerDay: '', memo: '' },
    new Set(['postsPerDay']),
  );

  assert.deepEqual(invalid, { key: 'scheduleDate', label: '발행 날짜', reason: 'required' });
});

test('선택 칸은 비어도 막지 않는다', () => {
  const invalid = findInvalidField(
    scheduleFields,
    { scheduleDate: '2026-09-10', postsPerDay: '3', memo: '' },
    new Set(),
  );

  assert.equal(invalid, null);
});

test('되비추는 줄은 id 가 아니라 사용자가 본 라벨로 적는다', () => {
  const lines = buildFormEchoLines(
    [projectField, { key: 'scheduleDate', label: '발행 날짜' }, { key: 'memo', label: '메모', optional: true }],
    { projectId: '68f1a2b3', scheduleDate: '2026-09-10', memo: '   ' },
  );

  assert.deepEqual(lines, ['원고 스타일: 펫 프로젝트', '발행 날짜: 2026-09-10']);
});
