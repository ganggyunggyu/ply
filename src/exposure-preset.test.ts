import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyPresetAction,
  describeSavedPreset,
  isPresetActionName,
  normalizeBlogId,
  MAX_CAFE_CHECKS,
  nextPresetId,
  parseSheetIdFromUrl,
  PRESET_ACTIONS,
  readTenantPreset,
  type TenantPreset,
} from './exposure-preset';
import { RESULT_PRESET as R } from './prompts';

const SHEET = 'https://docs.google.com/spreadsheets/d/1AbC-dEf_gh/edit#gid=0';

const fixture = (): TenantPreset => ({
  targets: [
    {
      id: 'cafe',
      label: '카페 + 블로그',
      kind: 'basic',
      source: { sheetId: 'sheet-1', tabTitle: '카페' },
      enabled: true,
    },
    {
      id: 'pet',
      label: '애견',
      kind: 'page',
      source: { sheetId: 'sheet-2', tabTitle: '애견' },
      maxPages: 3,
      blogGroupIds: ['group-1'],
      enabled: false,
    },
  ],
  blogGroups: [{ id: 'group-1', label: '준최', blogIds: ['blog-a'] }],
  runBundles: [{ id: 'bundle-1', label: '아침', targets: ['cafe'] }],
  doorayWebhookUrl: 'https://hook.dooray.com/old',
});

const ok = (result: ReturnType<typeof applyPresetAction>) => {
  assert.equal(result.ok, true, result.ok ? '' : result.result);
  if (!result.ok) throw new Error('unreachable');

  return result.change;
};

test('시트 주소에서 id 를 뽑는다', () => {
  assert.equal(parseSheetIdFromUrl(SHEET), '1AbC-dEf_gh');
  assert.equal(parseSheetIdFromUrl('https://example.com'), '');
});

test('action 이름은 목록에 있는 것만 통과한다', () => {
  PRESET_ACTIONS.forEach((action) => assert.equal(isPresetActionName(action), true));
  assert.equal(isPresetActionName('set_target_sheet'), false);
  assert.equal(isPresetActionName(42), false);
});

test('set_target_sheet 는 일부러 없다', () => {
  // 저장은 되지만 봇이 안 읽어서 "바꿨어요" 라고 보고한 뒤 조용히 틀린 결과가 나온다.
  assert.equal((PRESET_ACTIONS as readonly string[]).includes('set_target_sheet'), false);
});

test('targets 가 배열이 아니면 읽기를 실패시킨다', () => {
  // 빈 배열로 채워 PUT 하면 사용자가 켜 둔 대상이 전부 날아간다.
  assert.deepEqual(readTenantPreset({}), { ok: false, result: R.presetUnreadable });
  assert.deepEqual(readTenantPreset(null), { ok: false, result: R.presetUnreadable });
  assert.equal(readTenantPreset({ targets: [] }).ok, true);
});

test('모르는 필드는 그대로 통과시킨다', () => {
  const raw = { targets: [], blogGroups: [], somethingNew: 1 };
  const read = readTenantPreset(raw);

  assert.equal(read.ok, true);
});

test('id 는 라벨에서 만들고 겹치면 번호를 붙인다', () => {
  assert.equal(nextPresetId('My Cafe', 'cafe', new Set()), 'my-cafe');
  assert.equal(nextPresetId('My Cafe', 'cafe', new Set(['my-cafe'])), 'my-cafe-2');
  // 한글만 있는 라벨은 ascii 슬러그가 비어서 접두사 번호로 떨어진다.
  // id 가 URL 경로(cafe-check:<id>)에 들어가므로 ascii 로만 만든다.
  assert.equal(nextPresetId('카페 체크', 'cafe', new Set()), 'cafe-1');
  assert.equal(nextPresetId('카페 체크', 'cafe', new Set(['cafe-1'])), 'cafe-2');
});

test('카페체크를 더해도 나머지가 그대로 남는다', () => {
  const preset = fixture();
  const change = ok(
    applyPresetAction(preset, 'add_cafe_check', {
      label: 'My Cafe',
      sheetUrl: SHEET,
      tabTitle: '9월',
      targets: ['https://cafe.naver.com/abc'],
    }),
  );

  assert.equal(change.preset.cafeChecks?.length, 1);
  assert.equal(change.preset.cafeChecks?.[0]?.id, 'my-cafe');
  // 이게 이 모듈의 존재 이유다. PUT 이 전체 교체라서 병합이 한 칸이라도 빠지면 조용히 사라진다.
  assert.deepEqual(change.preset.targets, preset.targets);
  assert.deepEqual(change.preset.blogGroups, preset.blogGroups);
  assert.deepEqual(change.preset.runBundles, preset.runBundles);
  assert.equal(change.preset.doorayWebhookUrl, preset.doorayWebhookUrl);
  // targets 2 + blogGroups 1 + runBundles 1
  assert.equal(change.untouched, 4);
});

test('원본 프리셋을 건드리지 않는다', () => {
  const preset = fixture();
  applyPresetAction(preset, 'add_cafe_check', {
    label: 'x',
    sheetUrl: SHEET,
    tabTitle: 't',
    targets: ['https://cafe.naver.com/abc'],
  });

  assert.equal(preset.cafeChecks, undefined);
});

test('카페체크 입력을 하나씩 검사한다', () => {
  const preset = fixture();
  const base = { label: 'x', sheetUrl: SHEET, tabTitle: 't', targets: ['https://cafe.naver.com/a'] };

  const bad = (patch: Record<string, unknown>) =>
    applyPresetAction(preset, 'add_cafe_check', { ...base, ...patch });

  assert.deepEqual(bad({ label: ' ' }), { ok: false, result: R.cafeCheckLabelRequired });
  assert.deepEqual(bad({ sheetUrl: 'https://example.com' }), {
    ok: false,
    result: R.cafeCheckSheetUrlInvalid,
  });
  assert.deepEqual(bad({ tabTitle: '' }), { ok: false, result: R.cafeCheckTabRequired });
  assert.deepEqual(bad({ targets: [] }), { ok: false, result: R.cafeCheckTargetsRequired });
  // 노출지기가 쉼표로 이어 붙여 봇에 넘기므로 값 안의 쉼표는 두 개로 쪼개진다.
  assert.deepEqual(bad({ targets: ['a,b'] }), { ok: false, result: R.cafeCheckCommaTarget });
});

test('카페체크 상한을 서버보다 먼저 막는다', () => {
  const preset: TenantPreset = {
    ...fixture(),
    cafeChecks: Array.from({ length: MAX_CAFE_CHECKS }, (_, index) => ({
      id: `c${index}`,
      label: `c${index}`,
      sheetUrl: SHEET,
      tabTitle: 't',
      targets: ['https://cafe.naver.com/a'],
    })),
  };

  assert.deepEqual(
    applyPresetAction(preset, 'add_cafe_check', {
      label: 'one more',
      sheetUrl: SHEET,
      tabTitle: 't',
      targets: ['https://cafe.naver.com/a'],
    }),
    { ok: false, result: R.cafeCheckLimit(MAX_CAFE_CHECKS) },
  );
});

test('마지막 카페체크를 지우면 키 자체를 뺀다', () => {
  const preset: TenantPreset = {
    ...fixture(),
    cafeChecks: [{ id: 'c1', label: '하나', sheetUrl: SHEET, tabTitle: 't', targets: ['x'] }],
  };

  const change = ok(applyPresetAction(preset, 'remove_cafe_check', { checkId: 'c1' }));

  assert.equal(Object.hasOwn(change.preset, 'cafeChecks'), false);
});

test('없는 카페체크는 지우지 않는다', () => {
  assert.deepEqual(applyPresetAction(fixture(), 'remove_cafe_check', { checkId: 'nope' }), {
    ok: false,
    result: R.cafeCheckNotFound('nope'),
  });
});

test('대상을 켜고 끈다', () => {
  const preset = fixture();
  const change = ok(applyPresetAction(preset, 'enable_target', { targetId: 'pet' }));

  assert.equal(change.preset.targets.find(({ id }) => id === 'pet')?.enabled, true);
  // 나머지 필드가 살아 있어야 한다. maxPages 가 사라지면 페이지 체크가 기본값으로 돈다.
  assert.equal(change.preset.targets.find(({ id }) => id === 'pet')?.maxPages, 3);
  assert.deepEqual(change.preset.targets.find(({ id }) => id === 'pet')?.blogGroupIds, ['group-1']);
  assert.equal(change.preset.targets.find(({ id }) => id === 'cafe')?.enabled, true);
});

test('이미 그 상태면 아무것도 하지 않는다', () => {
  assert.deepEqual(applyPresetAction(fixture(), 'enable_target', { targetId: 'cafe' }), {
    ok: false,
    result: R.targetAlreadyInState('카페 + 블로그', true),
  });
});

test('없는 대상은 있는 목록을 알려주며 거부한다', () => {
  const result = applyPresetAction(fixture(), 'disable_target', { targetId: 'newthing' });

  assert.deepEqual(result, { ok: false, result: R.targetNotFound('newthing', ['cafe', 'pet']) });
  assert.equal(result.ok === false && result.result.includes('limits'), true);
});

test('계정 그룹을 더한다', () => {
  const change = ok(
    applyPresetAction(fixture(), 'add_blog_group', {
      label: '최블',
      blogIds: ['blog-b', 'blog-c', 'blog-b'],
    }),
  );

  assert.equal(change.preset.blogGroups.length, 2);
  assert.deepEqual(change.preset.blogGroups[1]?.blogIds, ['blog-b', 'blog-c']);
});

test('Dooray 웹훅은 https 만 받고 기존 값을 덮는다는 사실을 알린다', () => {
  assert.deepEqual(applyPresetAction(fixture(), 'set_dooray_webhook', { url: 'http://x' }), {
    ok: false,
    result: R.doorayUrlNotHttps,
  });

  const change = ok(
    applyPresetAction(fixture(), 'set_dooray_webhook', { url: 'https://hook.dooray.com/new' }),
  );

  assert.equal(change.preset.doorayWebhookUrl, 'https://hook.dooray.com/new');
  assert.equal(change.summary[0], R.summaryDoorayChanged(true));
});

test('모르는 동작은 거부한다', () => {
  assert.deepEqual(applyPresetAction(fixture(), 'set_target_sheet', {}), {
    ok: false,
    result: R.unknownPresetAction('set_target_sheet'),
  });
});


// ---------- 서버가 저장 직전에 하는 정규화 ----------

test('블로그 아이디 정규화가 노출지기와 같은 규칙을 쓴다', () => {
  assert.equal(normalizeBlogId('https://m.blog.naver.com/introsm?tab=1'), 'introsm');
  assert.equal(normalizeBlogId('  AirTrd '), 'airtrd');
  assert.equal(normalizeBlogId('@@bad id@@'), '');
  assert.equal(normalizeBlogId('a'), '');
  assert.equal(normalizeBlogId(null), '');
});

test('계정 그룹은 서버가 버릴 값을 미리 걸러 세어 준다', () => {
  // 여기서 안 거르면 확인 카드에 "블로그 3개" 라고 적히고 서버에는 1개만 남는다.
  const applied = applyPresetAction(fixture(), 'add_blog_group', {
    label: '최블',
    blogIds: ['https://m.blog.naver.com/airtrd?tab=1', '@@bad id@@', 'AIRTRD'],
  });

  assert.equal(applied.ok, true);
  if (!applied.ok) return;

  const group = applied.change.preset.blogGroups.at(-1);

  // 주소에서 뽑은 airtrd 와 대문자 AIRTRD 는 같은 값이라 하나로 합쳐진다.
  assert.deepEqual(group?.blogIds, ['airtrd']);
  assert.equal(applied.change.summary[0]?.includes('블로그 1개'), true);
  assert.equal(applied.change.summary.some((line) => line.includes('@@bad id@@')), true);
});

test('전부 아이디 모양이 아니면 아무것도 저장하지 않는다', () => {
  // 그냥 보내면 서버가 blogIds:[] 를 200 으로 저장하고, 그 그룹을 쓰는 대상은 계정 0개로 돈다.
  const applied = applyPresetAction(fixture(), 'add_blog_group', {
    label: '최블',
    blogIds: ['@@bad@@', 'x'],
  });

  assert.equal(applied.ok, false);
  if (applied.ok) return;

  assert.equal(applied.result, R.blogGroupAllDropped(['@@bad@@', 'x']));
});

// ---------- 저장 뒤 되읽기 ----------

test('저장 결과는 서버가 되돌려준 값으로 말한다', () => {
  const saved: TenantPreset = {
    ...fixture(),
    blogGroups: [{ id: 'choebl', label: '최블', blogIds: ['airtrd'] }],
  };

  const lines = describeSavedPreset({ kind: 'blogGroup', id: 'choebl' }, saved);

  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.includes('블로그 1개'), true);
});

test('서버가 블로그를 전부 버리면 성공이라고 말하지 않는다', () => {
  const saved: TenantPreset = {
    ...fixture(),
    blogGroups: [{ id: 'choebl', label: '최블', blogIds: [] }],
  };

  assert.deepEqual(describeSavedPreset({ kind: 'blogGroup', id: 'choebl' }, saved), [
    R.savedBlogGroupEmpty('최블', 'choebl'),
  ]);
});

test('200 을 받아도 되돌아온 값에 없으면 만들어졌다고 하지 않는다', () => {
  assert.deepEqual(describeSavedPreset({ kind: 'cafeCheck', id: 'my-cafe' }, fixture()), [
    R.savedMissing('my-cafe'),
  ]);
});

test('토글이 반대로 저장되면 그대로 짚어 준다', () => {
  const saved = fixture();
  const first = saved.targets[0];
  assert.ok(first);

  const lines = describeSavedPreset({ kind: 'target', id: first.id, enabled: !first.enabled }, saved);

  assert.deepEqual(lines, [R.savedTargetMismatch(first.label, first.id, first.enabled)]);
});

test('되돌아온 프리셋을 못 읽으면 저장됐다고 단정하지 않는다', () => {
  assert.deepEqual(describeSavedPreset({ kind: 'dooray' }, { targets: 'nope' }), [R.savedUnverified]);
});
