import assert from 'node:assert/strict';
import test from 'node:test';
import { filterModels, type PickerModel } from './model-list';

const MODELS: PickerModel[] = [
  { id: 'z-ai/glm-5.3-flash', label: 'GLM 5.3 Flash' },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'minimax/minimax-m3', label: 'MiniMax M3' },
];

test('빈 검색어는 전부 돌려준다', () => {
  assert.equal(filterModels(MODELS, '').length, 3);
  assert.equal(filterModels(MODELS, '   ').length, 3);
});

test('이름으로 찾는다', () => {
  assert.deepEqual(filterModels(MODELS, 'minimax').map((m) => m.id), ['minimax/minimax-m3']);
});

test('모델 id 조각으로도 찾는다', () => {
  // 사용자는 "glm" 처럼 화면에 보이는 이름이 아니라 id 로도 친다.
  assert.deepEqual(filterModels(MODELS, 'z-ai').map((m) => m.id), ['z-ai/glm-5.3-flash']);
});

test('대소문자를 가리지 않는다', () => {
  assert.equal(filterModels(MODELS, 'DEEPSEEK').length, 1);
});

test('여러 개가 걸리면 다 돌려준다', () => {
  assert.equal(filterModels(MODELS, 'flash').length, 2);
});

test('안 맞으면 빈 배열이다', () => {
  assert.deepEqual(filterModels(MODELS, 'gpt'), []);
});
