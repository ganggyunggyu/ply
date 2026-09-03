/**
 * 노출지기 프리셋 병합. 네트워크를 타지 않는 순수 함수뿐이다.
 *
 * PUT /api/preset 은 전체 교체다. 모델이 GET 결과를 읽고 JSON 을 다시 써서 PUT 하면
 * 안 건드린 항목이 조용히 사라지고, 그 실패에는 에러가 없다. 그래서 병합은 반드시 코드가 한다.
 *
 * 타입은 dashboard/src/server/preset.ts 를 구조만 베낀 것이다. 그쪽을 import 할 수 없으므로
 * 여기서 지어내지 않고 "읽은 값을 그대로 되돌려주는" 쪽으로 기운다.
 * 모르는 필드는 손대지 않고 통과시킨다. 아는 필드만 고친다.
 */
import { RESULT_PRESET as R } from './prompts';

export type SheetLocation = { sheetId: string; tabTitle: string };

export type PresetTarget = {
  id: string;
  label: string;
  kind: string;
  source: SheetLocation;
  result?: SheetLocation;
  maxPages?: number;
  blogGroupIds?: string[];
  blogIds?: string[];
  enabled: boolean;
};

export type BlogGroup = { id: string; label: string; blogIds: string[] };

export type RunBundle = { id: string; label: string; targets: string[]; maxPages?: number };

export type CafeCheck = {
  id: string;
  label: string;
  sheetUrl: string;
  tabTitle: string;
  targets: string[];
};

export type TenantPreset = {
  targets: PresetTarget[];
  blogGroups: BlogGroup[];
  runBundles?: RunBundle[];
  cafeChecks?: CafeCheck[];
  doorayWebhookUrl?: string;
};

/**
 * 도구가 받는 action 목록.
 *
 * set_target_sheet 는 일부러 없다. PresetTarget.source/result 는 대시보드가 저장도 하고
 * 검증도 하지만 봇 스크립트는 그 값을 읽지 않는다(시트가 코드에 박혀 있다).
 * 도구로 열면 "시트 바꿨어요" 라고 보고한 뒤 실제로는 옛 시트를 계속 읽는,
 * 조용히 틀린 결과가 나온다. 이 사실은 docs/api/limits.md 에만 적는다.
 */
export const PRESET_ACTIONS = [
  'add_cafe_check',
  'remove_cafe_check',
  'enable_target',
  'disable_target',
  'add_blog_group',
  'set_dooray_webhook',
] as const;

export type PresetActionName = (typeof PRESET_ACTIONS)[number];

export const isPresetActionName = (value: unknown): value is PresetActionName =>
  typeof value === 'string' && (PRESET_ACTIONS as readonly string[]).includes(value);

/** 대시보드 preset.ts 의 상한과 같은 값. 서버가 400 을 주기 전에 여기서 막는다. */
export const MAX_CAFE_CHECKS = 12;
export const MAX_CAFE_TARGETS = 50;
export const MAX_BLOG_IDS_PER_GROUP = 500;

/** dashboard/src/server/preset.ts 의 parseSheetIdFromUrl 과 같은 규칙. */
export const parseSheetIdFromUrl = (raw: string): string =>
  raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? '';

/**
 * dashboard/src/shared/lib/blog-id 의 normalizeBlogId 와 같은 규칙.
 *
 * 저쪽 서버는 계정 그룹을 저장하기 전에 이 정규화를 통과시키고 걸러진 값은 조용히 버린다.
 * 여기서 같은 규칙을 돌리지 않으면 도구는 "블로그 3개" 라고 보고하는데 서버에는 1개만
 * 남는다. 사용자는 그 숫자를 보고 승인한다. 저장 결과가 0개면 그 그룹을 쓰는 대상은
 * 계정 0개로 돌아간다 — 그것도 에러 없이.
 */
export const normalizeBlogId = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';

  const trimmed = raw.trim().toLowerCase();
  const fromUrl = trimmed.match(/(?:m\.)?blog\.naver\.com\/([^/?&#\s]+)/)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/[/?&#].*$/, '');

  return /^[a-z0-9_-]{2,40}$/.test(candidate) ? candidate : '';
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

/**
 * 서버가 준 프리셋을 우리가 아는 모양으로 좁힌다.
 *
 * 배열이 아닌 값이 오면 빈 배열로 두지 않고 그대로 실패시킨다. targets 를 빈 배열로 채워
 * PUT 하면 사용자가 켜 둔 대상이 전부 날아간다. 못 읽었으면 아무것도 쓰지 않는 쪽이 맞다.
 */
export type PresetRead = { ok: false; result: string } | { ok: true; preset: TenantPreset };

export const readTenantPreset = (raw: unknown): PresetRead => {
  const { targets, blogGroups, runBundles, cafeChecks, doorayWebhookUrl } = asRecord(raw);

  if (!Array.isArray(targets)) return { ok: false, result: R.presetUnreadable };

  const preset: TenantPreset = {
    targets: targets as PresetTarget[],
    blogGroups: Array.isArray(blogGroups) ? (blogGroups as BlogGroup[]) : [],
  };

  if (Array.isArray(runBundles)) preset.runBundles = runBundles as RunBundle[];
  if (Array.isArray(cafeChecks)) preset.cafeChecks = cafeChecks as CafeCheck[];
  if (typeof doorayWebhookUrl === 'string' && doorayWebhookUrl) {
    preset.doorayWebhookUrl = doorayWebhookUrl;
  }

  return { ok: true, preset };
};

/**
 * 새 항목 id. 모델이 짓지 않는다.
 *
 * ascii 로만 만든다. id 는 `cafe-check:<id>` 로 URL 경로에 들어가고, 대시보드 화면도
 * cafe-1 / group-1 규칙을 쓴다. 한글 슬러그를 넣으면 인코딩 경계마다 갈릴 자리가 생긴다.
 */
export const nextPresetId = (label: string, prefix: string, taken: ReadonlySet<string>): string => {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || '';

  if (slug && !taken.has(slug)) return slug;

  const base = slug || prefix;
  let suffix = slug ? 2 : 1;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;

  return `${base}-${suffix}`;
};

/**
 * 저장 뒤에 무엇을 되읽어 확인할지. PUT 응답에 담겨 오는 "실제 저장된 프리셋" 을 이걸로 본다.
 *
 * 보내기 전의 요약을 사실로 보고하면 안 된다. 서버는 저장 직전에 값을 정규화하고 못 쓰는 값을
 * 조용히 버린다. 우리가 보낸 것과 저장된 것이 다를 수 있고, 다를 때 에러는 오지 않는다.
 */
export type PresetVerify =
  | { kind: 'cafeCheck'; id: string }
  | { kind: 'cafeCheckRemoved'; id: string }
  | { kind: 'blogGroup'; id: string }
  | { kind: 'target'; id: string; enabled: boolean }
  | { kind: 'dooray' };

export type PresetChange = {
  preset: TenantPreset;
  /** 확인 카드에 그대로 들어갈 줄들. 코드가 만든다. */
  summary: string[];
  /** 이번에 손대지 않는 항목 수. 전체 교체라는 사실을 사용자가 알아야 승인이 의미가 있다. */
  untouched: number;
  /** 저장 뒤 되읽기용. 도구는 이 결과만 사실로 보고한다. */
  verify: PresetVerify;
};

export type PresetApply = { ok: false; result: string } | { ok: true; change: PresetChange };

const countItems = ({ targets, blogGroups, runBundles, cafeChecks }: TenantPreset): number =>
  targets.length + blogGroups.length + (runBundles?.length ?? 0) + (cafeChecks?.length ?? 0);

const stringList = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(asText).filter((value) => value !== '') : [];

const addCafeCheck = (preset: TenantPreset, input: Record<string, unknown>): PresetApply => {
  const label = asText(input.label);
  if (!label) return { ok: false, result: R.cafeCheckLabelRequired };

  const sheetUrl = asText(input.sheetUrl);
  if (!parseSheetIdFromUrl(sheetUrl)) return { ok: false, result: R.cafeCheckSheetUrlInvalid };

  const tabTitle = asText(input.tabTitle);
  if (!tabTitle) return { ok: false, result: R.cafeCheckTabRequired };

  const targets = [...new Set(stringList(input.targets))];
  if (targets.length === 0) return { ok: false, result: R.cafeCheckTargetsRequired };
  if (targets.length > MAX_CAFE_TARGETS) {
    return { ok: false, result: R.cafeCheckTooManyTargets(MAX_CAFE_TARGETS) };
  }
  // 서버가 환경변수로 쉼표 이어붙이기를 해서 값에 쉼표가 있으면 두 개로 쪼개진다.
  if (targets.some((value) => value.includes(','))) {
    return { ok: false, result: R.cafeCheckCommaTarget };
  }

  const checks = preset.cafeChecks ?? [];
  if (checks.length >= MAX_CAFE_CHECKS) {
    return { ok: false, result: R.cafeCheckLimit(MAX_CAFE_CHECKS) };
  }

  const id = nextPresetId(label, 'cafe', new Set(checks.map((check) => check.id)));
  const created: CafeCheck = { id, label, sheetUrl, tabTitle, targets };

  return {
    ok: true,
    change: {
      preset: { ...preset, cafeChecks: [...checks, created] },
      summary: [
        R.summaryCafeCheckAdded(label, id),
        R.summaryCafeCheckSheet(tabTitle),
        R.summaryCafeCheckTargets(targets),
      ],
      untouched: countItems(preset),
      verify: { kind: 'cafeCheck', id },
    },
  };
};

const removeCafeCheck = (preset: TenantPreset, input: Record<string, unknown>): PresetApply => {
  const checkId = asText(input.checkId);
  if (!checkId) return { ok: false, result: R.cafeCheckIdRequired };

  const checks = preset.cafeChecks ?? [];
  const found = checks.find((check) => check.id === checkId);
  if (!found) return { ok: false, result: R.cafeCheckNotFound(checkId) };

  const remaining = checks.filter((check) => check.id !== checkId);
  const next: TenantPreset = { ...preset, cafeChecks: remaining };
  // 빈 배열이면 키를 아예 뺀다. 서버의 parsePreset 도 0개면 키를 넣지 않는다.
  if (remaining.length === 0) delete next.cafeChecks;

  return {
    ok: true,
    change: {
      preset: next,
      summary: [R.summaryCafeCheckRemoved(found.label, checkId)],
      untouched: countItems(preset) - 1,
      verify: { kind: 'cafeCheckRemoved', id: checkId },
    },
  };
};

const setTargetEnabled = (
  preset: TenantPreset,
  input: Record<string, unknown>,
  enabled: boolean,
): PresetApply => {
  const targetId = asText(input.targetId);
  if (!targetId) return { ok: false, result: R.targetIdRequired };

  const found = preset.targets.find((target) => target.id === targetId);
  if (!found) {
    return { ok: false, result: R.targetNotFound(targetId, preset.targets.map(({ id }) => id)) };
  }

  if (found.enabled === enabled) {
    return { ok: false, result: R.targetAlreadyInState(found.label, enabled) };
  }

  return {
    ok: true,
    change: {
      preset: {
        ...preset,
        targets: preset.targets.map((target) =>
          target.id === targetId ? { ...target, enabled } : target,
        ),
      },
      summary: [R.summaryTargetToggled(found.label, targetId, enabled)],
      untouched: countItems(preset) - 1,
      verify: { kind: 'target', id: targetId, enabled },
    },
  };
};

const addBlogGroup = (preset: TenantPreset, input: Record<string, unknown>): PresetApply => {
  const label = asText(input.label);
  if (!label) return { ok: false, result: R.blogGroupLabelRequired };

  const given = stringList(input.blogIds);
  if (given.length === 0) return { ok: false, result: R.blogGroupIdsRequired };

  // 서버가 저장 직전에 하는 정규화를 여기서 먼저 돌린다. 그래야 확인 카드의 숫자와
  // 실제로 저장될 숫자가 같아진다. 서버가 버릴 값으로 사용자에게 승인을 받지 않는다.
  const blogIds = [...new Set(given.map(normalizeBlogId).filter((blogId) => blogId !== ''))];
  const dropped = given.filter((raw) => normalizeBlogId(raw) === '');

  if (blogIds.length === 0) return { ok: false, result: R.blogGroupAllDropped(dropped) };
  if (blogIds.length > MAX_BLOG_IDS_PER_GROUP) {
    return { ok: false, result: R.blogGroupTooMany(MAX_BLOG_IDS_PER_GROUP) };
  }

  const id = nextPresetId(label, 'group', new Set(preset.blogGroups.map((group) => group.id)));
  const created: BlogGroup = { id, label, blogIds };

  const summary = [R.summaryBlogGroupAdded(label, id, blogIds.length)];
  if (dropped.length > 0) summary.push(R.summaryBlogIdsDropped(dropped));

  return {
    ok: true,
    change: {
      preset: { ...preset, blogGroups: [...preset.blogGroups, created] },
      summary,
      untouched: countItems(preset),
      verify: { kind: 'blogGroup', id },
    },
  };
};

const setDoorayWebhook = (preset: TenantPreset, input: Record<string, unknown>): PresetApply => {
  const url = asText(input.url);
  if (!url) return { ok: false, result: R.doorayUrlRequired };
  if (!url.startsWith('https://')) return { ok: false, result: R.doorayUrlNotHttps };

  return {
    ok: true,
    change: {
      preset: { ...preset, doorayWebhookUrl: url },
      summary: [R.summaryDoorayChanged(Boolean(preset.doorayWebhookUrl))],
      untouched: countItems(preset),
      verify: { kind: 'dooray' },
    },
  };
};

/**
 * PUT 응답에 담겨 온 "실제 저장된 프리셋" 을 읽어 사실만 적는다.
 *
 * 보내기 전 요약과 다를 수 있는 자리가 실제로 있다 — 노출지기의 parsePreset 은 blogIds 를
 * normalizeBlogId 로 거르고, 라벨이 비면 id 로 채우고, 빈 배열이면 키를 통째로 뺀다.
 * 그래서 저장 결과는 다시 읽어서 말한다. 못 읽었으면 "확인 못 했다" 고 말하지, 보낸 값을
 * 저장된 값인 척하지 않는다.
 */
export const describeSavedPreset = (verify: PresetVerify, raw: unknown): string[] => {
  const parsed = readTenantPreset(raw);
  if (!parsed.ok) return [R.savedUnverified];

  const saved = parsed.preset;

  if (verify.kind === 'cafeCheck') {
    const found = (saved.cafeChecks ?? []).find((check) => check.id === verify.id);
    if (!found) return [R.savedMissing(verify.id)];

    return [
      R.savedCafeCheck(found.label, found.id, found.tabTitle),
      R.savedCafeCheckTargets(Array.isArray(found.targets) ? found.targets.length : 0),
    ];
  }

  if (verify.kind === 'cafeCheckRemoved') {
    const still = (saved.cafeChecks ?? []).some((check) => check.id === verify.id);

    return [still ? R.savedStillPresent(verify.id) : R.savedRemoved(verify.id)];
  }

  if (verify.kind === 'blogGroup') {
    const found = saved.blogGroups.find((group) => group.id === verify.id);
    if (!found) return [R.savedMissing(verify.id)];

    const stored = Array.isArray(found.blogIds) ? found.blogIds : [];

    return stored.length === 0
      ? [R.savedBlogGroupEmpty(found.label, found.id)]
      : [R.savedBlogGroup(found.label, found.id, stored.length, stored)];
  }

  if (verify.kind === 'target') {
    const found = saved.targets.find((target) => target.id === verify.id);
    if (!found) return [R.savedMissing(verify.id)];

    return [
      found.enabled === verify.enabled
        ? R.savedTarget(found.label, found.id, found.enabled)
        : R.savedTargetMismatch(found.label, found.id, found.enabled),
    ];
  }

  return [R.savedDooray(Boolean(saved.doorayWebhookUrl))];
};

/**
 * 프리셋 하나에 동작 하나를 적용한다. 모르는 필드는 스프레드로 그대로 넘어간다.
 * 실패는 예외가 아니라 모델이 읽을 문장이다. 도구가 그대로 돌려주면 된다.
 */
export const applyPresetAction = (
  preset: TenantPreset,
  action: string,
  input: Record<string, unknown>,
): PresetApply => {
  if (action === 'add_cafe_check') return addCafeCheck(preset, input);
  if (action === 'remove_cafe_check') return removeCafeCheck(preset, input);
  if (action === 'enable_target') return setTargetEnabled(preset, input, true);
  if (action === 'disable_target') return setTargetEnabled(preset, input, false);
  if (action === 'add_blog_group') return addBlogGroup(preset, input);
  if (action === 'set_dooray_webhook') return setDoorayWebhook(preset, input);

  return { ok: false, result: R.unknownPresetAction(action) };
};
