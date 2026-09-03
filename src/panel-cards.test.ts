import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ONBOARDING } from './messages';

/**
 * 크리덴셜 카드의 첫 줄은 코드가 만든다.
 *
 * 이 저장소는 삭제 게이트에서 이미 이 규칙을 세웠다 — "문안은 코드가 저장소에서 읽은 값으로
 * 만든다. 모델은 확인 문구를 만들 수 없다." 그런데 정작 평문 비밀번호를 받는 카드 둘이
 * `reason` 을 lead 로 그대로 썼다. `reason` 은 모델 인자이고, read_page 로 들어온 주입
 * 문장이 그 자리에 앉을 수 있다. 노출지기 카드에 "네이버 비밀번호를 넣어주세요" 를 띄우면
 * 값은 노출지기 서버로 POST 된다.
 *
 * DOM 없이 검사할 수 있는 건 호출부의 모양이라 소스를 읽는다. 이 테스트가 깨지면
 * 그 자리에 모델 문자열이 다시 들어간 것이다.
 */

const panelSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'panel.ts'),
  'utf8',
);

const cardBlock = (fnName: string): string => {
  const start = panelSource.indexOf(`const ${fnName} = `);
  assert.notEqual(start, -1, `${fnName} 를 찾지 못했다`);

  const next = panelSource.indexOf('\nconst ', start + 1);

  return panelSource.slice(start, next === -1 ? undefined : next);
};

const CREDENTIAL_CARDS = ['requestAgentExposureLogin', 'requestAgentAccountCard'];

test('비밀번호를 받는 카드는 lead 에 모델 문자열을 쓰지 않는다', () => {
  CREDENTIAL_CARDS.forEach((fnName) => {
    const block = cardBlock(fnName);

    // 이 카드에 password 칸이 실제로 있는지부터 확인한다. 없어지면 이 테스트의 전제가 바뀐다.
    assert.equal(block.includes("type: 'password'"), true, `${fnName} 에 비밀번호 칸이 없다`);

    // reason 은 note 로만 내려간다. lead 로 새면 여기서 걸린다.
    assert.equal(/lead:\s*reason/.test(block), false, `${fnName} 의 lead 가 reason 이다`);
    assert.equal(/const lead =[^;]*reason/.test(block), false, `${fnName} 의 lead 가 reason 이다`);
    assert.equal(block.includes('note: reason'), true, `${fnName} 이 reason 을 note 로 안 준다`);
  });
});

test('모델이 준 이유는 라벨을 달고 나간다', () => {
  // 라벨 없이 붙이면 카드 본문과 구분이 안 돼 lead 로 쓰는 것과 다를 바가 없다.
  const labelled = ONBOARDING.agentReasonLabel('아무 문장');

  assert.equal(labelled.endsWith('아무 문장'), true);
  assert.equal(labelled.length > '아무 문장'.length, true);
  assert.equal(panelSource.includes('ONBOARDING.agentReasonLabel(note.trim())'), true);
});

test('노출지기 로그인 카드는 어디로 보내는지 밝힌다', () => {
  // 어느 서비스인지 안 적으면 사용자는 네이버 비밀번호를 넣어도 이상한 줄 모른다.
  assert.equal(ONBOARDING.askExposureLogin.includes('노출지기'), true);
  assert.equal(ONBOARDING.exposureLoginHint.includes('노출지기'), true);
});
