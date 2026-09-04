import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildAutoScheduleBody,
  buildShellInvocation,
  describeSchedulerError,
  findExposureJob,
  isScheduleNotFound,
  listExposureJobs,
  maskAccountId,
  pnpmCandidatePaths,
  readAutoScheduleResult,
  readCancelScheduleResult,
  readScheduleDetail,
  readScheduleList,
} from './hub';

test('pnpm 을 찾으면 셸을 거치지 않고 직접 실행한다', () => {
  const { command, args, viaShell } = buildShellInvocation('exposure:package', '/opt/homebrew/bin/pnpm');

  assert.equal(command, '/opt/homebrew/bin/pnpm');
  assert.deepEqual(args, ['run', 'exposure:package']);
  assert.equal(viaShell, false);
});

test('pnpm 을 못 찾으면 셸로 넘기되 .zshrc 까지 읽는다', () => {
  const { command, args, viaShell } = buildShellInvocation('exposure:package', null);

  assert.equal(viaShell, true);

  if (process.platform === 'win32') {
    assert.equal(command, 'cmd.exe');
    return;
  }

  // pnpm setup 은 PNPM_HOME 을 .zshrc 에 쓴다. -lc 는 .zshrc 를 안 읽어서 놓친다.
  if (command.endsWith('zsh')) assert.equal(args[0], '-ilc');
  else assert.equal(args[0], '-lc');
  assert.equal(args[1], 'pnpm run exposure:package');
});

test('흔한 pnpm 설치 위치를 전부 후보에 넣는다', () => {
  const paths = pnpmCandidatePaths('/Users/tester');

  if (process.platform !== 'win32') {
    assert.ok(paths.includes('/Users/tester/Library/pnpm/pnpm'));
    assert.ok(paths.includes('/opt/homebrew/bin/pnpm'));
  }

  assert.ok(paths.length > 0);
});

test('스크립트 이름에 셸 메타문자를 못 넣는다', () => {
  assert.throws(() => buildShellInvocation('a; rm -rf /'), /실행할 수 없는/);
  assert.throws(() => buildShellInvocation('a && curl evil'), /실행할 수 없는/);
  assert.throws(() => buildShellInvocation('$(whoami)'), /실행할 수 없는/);
  assert.throws(() => buildShellInvocation(''), /실행할 수 없는/);
});

/** 노출체크 저장소는 이 저장소에 없다. package.json 만 흉내 낸 임시 디렉터리를 쓴다. */
const fakeExposureRepo = (scripts: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'gng-exposure-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fake', scripts }));
  return dir;
};

test('저장소의 exposure: 스크립트만 작업 목록에 올린다', () => {
  const dir = fakeExposureRepo({
    'exposure:package': 'node x',
    'exposure:some-client': 'node x',
    build: 'node x',
    'image-generator:published:exposure': 'node x',
  });

  assert.deepEqual(
    listExposureJobs(dir).map(({ script }) => script),
    ['exposure:package', 'exposure:some-client'],
  );
});

test('라벨을 모르는 스크립트도 키를 그대로 써서 실행할 수 있다', () => {
  const dir = fakeExposureRepo({ 'exposure:package': 'node x', 'exposure:some-client': 'node x' });

  assert.equal(findExposureJob(dir, 'package')?.label, '패키지 시트');
  assert.equal(findExposureJob(dir, 'PACKAGE')?.script, 'exposure:package');
  assert.equal(findExposureJob(dir, 'some-client')?.script, 'exposure:some-client');
  assert.equal(findExposureJob(dir, 'some-client')?.label, 'some-client');
  assert.equal(findExposureJob(dir, '아무거나'), null);
});

test('경로가 없거나 저장소가 아니면 빈 목록이다', () => {
  assert.deepEqual(listExposureJobs(''), []);
  assert.deepEqual(listExposureJobs('/definitely/not/a/repo'), []);
  assert.equal(findExposureJob('', 'package'), null);
});

test('package.json 이 깨져 있어도 던지지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gng-exposure-'));
  writeFileSync(join(dir, 'package.json'), '{ not json');

  assert.deepEqual(listExposureJobs(dir), []);
});

test('목록에 오른 스크립트 이름은 전부 셸 안전하다', () => {
  const dir = fakeExposureRepo({
    'exposure:package': 'node x',
    'exposure:a; rm -rf /': 'node x',
    'exposure:$(whoami)': 'node x',
  });

  const jobs = listExposureJobs(dir);

  assert.deepEqual(jobs.map(({ script }) => script), ['exposure:package']);
  jobs.forEach(({ script }) => assert.doesNotThrow(() => buildShellInvocation(script)));
});

// ---------- /bot/auto-schedule 바디 ----------

const scheduleFixture = () => ({
  scheduleDate: '2026-09-10',
  queues: [{ account: { dabutAccountId: 'acc-1' }, keywords: ['강아지유치원'] }],
});

test('예약 바디의 최상위 키는 전부 snake_case 다', () => {
  const body = buildAutoScheduleBody({
    ...scheduleFixture(),
    postsPerDay: 3,
    startHour: 9,
    intervalMinutes: 120,
    manuscriptType: 'pet',
    imageSource: 'google',
    keywordCategory: '반려동물',
    projectId: 'proj-1',
  });

  // zod 가 non-strict 라 이름이 어긋난 키는 400 없이 조용히 버려진다. 이름을 여기서 고정한다.
  assert.deepEqual(Object.keys(body).sort(), [
    'image_source',
    'interval_minutes',
    'keyword_category',
    'manuscript_type',
    'posts_per_day',
    'project_id',
    'queues',
    'schedule_date',
    'start_hour',
  ]);
});

test('projectId 는 최상위 project_id 로 실린다', () => {
  const body = buildAutoScheduleBody({ ...scheduleFixture(), projectId: 'proj-1' });

  assert.equal(body.project_id, 'proj-1');
  assert.equal('projectId' in body, false);
});

test('imageSource 는 최상위 image_source 로 실린다', () => {
  const body = buildAutoScheduleBody({ ...scheduleFixture(), imageSource: 'keyword' });

  assert.equal(body.image_source, 'keyword');
  assert.equal('imageSource' in body, false);
});

test('안 준 값은 키 자체를 만들지 않는다', () => {
  const body = buildAutoScheduleBody(scheduleFixture());

  assert.deepEqual(Object.keys(body).sort(), ['queues', 'schedule_date']);
  assert.equal('project_id' in body, false);
  assert.equal('image_source' in body, false);
});

test('빈 문자열 projectId 는 보내지 않는다', () => {
  // 스케줄러의 project_id 는 min(1) 이라 '' 를 보내면 400 이다.
  const body = buildAutoScheduleBody({ ...scheduleFixture(), projectId: '' });

  assert.equal('project_id' in body, false);
});

test('큐의 계정은 dabutAccountId 로 넘어간다', () => {
  const body = buildAutoScheduleBody(scheduleFixture());
  const [queue] = body.queues as { account: Record<string, unknown> }[];

  assert.deepEqual(queue?.account, { dabutAccountId: 'acc-1' });
});

test('항목별 프로젝트는 item_options 로 실어 보낼 수 있다', () => {
  const body = buildAutoScheduleBody({
    scheduleDate: '2026-09-10',
    queues: [
      {
        account: { dabutAccountId: 'acc-1' },
        keywords: ['가', '나'],
        item_options: [{ projectId: 'proj-1' }, { projectId: 'proj-2' }],
      },
    ],
  });
  const [queue] = body.queues as { keywords: string[]; item_options: unknown[] }[];

  // 길이가 다르면 스케줄러가 HTTP 200 + success:false 로 조용히 실패한다.
  assert.equal(queue?.item_options.length, queue?.keywords.length);
});

// ---------- /bot/auto-schedule 응답 ----------

test('success:false 는 HTTP 200 이어도 실패다', () => {
  // 계정 크리덴셜 복호화 실패가 이 모양으로 온다. axios 는 200 이라 던지지 않는다.
  const outcome = readAutoScheduleResult({
    success: false,
    message: 'dabutAccountId 를 쓰려면 로그인이 필요합니다.',
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.message, 'dabutAccountId 를 쓰려면 로그인이 필요합니다.');
});

test('success 가 없는 응답도 성공으로 보지 않는다', () => {
  assert.equal(readAutoScheduleResult({}).ok, false);
  assert.equal(readAutoScheduleResult(null).ok, false);
  assert.equal(readAutoScheduleResult('ok').ok, false);
  assert.equal(readAutoScheduleResult({ success: 'true' }).ok, false);
});

test('등록 성공은 건수와 함께 읽는다', () => {
  const outcome = readAutoScheduleResult({
    success: true,
    totalJobs: 3,
    schedules: [{ scheduleId: 's1', reused: false, totalJobs: 3 }],
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.totalJobs, 3);
  assert.equal(outcome.reused, false);
});

test('reused 는 새로 걸린 게 아니라는 표시로 읽는다', () => {
  // 지문이 같으면 스케줄러가 기존 예약을 그대로 돌려준다. 잡은 이미 있어 다시 안 들어간다.
  const outcome = readAutoScheduleResult({
    success: true,
    totalJobs: 2,
    schedules: [{ scheduleId: 's1', reused: false }, { scheduleId: 's2', reused: true }],
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.reused, true);
});

test('400 본문의 필드 오류까지 모델에게 넘긴다', () => {
  const error = Object.assign(new Error('Request failed with status code 400'), {
    response: {
      data: {
        success: false,
        message: '요청 값이 올바르지 않습니다',
        fields: [{ field: 'start_hour', message: 'Number must be less than or equal to 23' }],
      },
    },
  });

  const described = describeSchedulerError(error);

  assert.ok(described.includes('요청 값이 올바르지 않습니다'));
  assert.ok(described.includes('start_hour'));
  assert.ok(described.includes('Number must be less than or equal to 23'));
});

test('본문이 없는 예외는 원문 메시지만 넘긴다', () => {
  assert.equal(describeSchedulerError(new Error('connect ECONNREFUSED')), 'connect ECONNREFUSED');
  assert.equal(describeSchedulerError('깨진 값'), '깨진 값');
});

// ---------- /schedules 읽기 ----------

test('예약 목록은 schedules 를 풀고 _id 를 id 로 옮긴다', () => {
  const rows = readScheduleList({
    schedules: [
      {
        _id: 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8',
        accountId: 'sampleblog01',
        scheduleDate: '2026-09-03',
        status: 'pending',
        totalJobs: 1,
        completedJobs: 0,
        failedJobs: 0,
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, 'sch_4e2f5c84-22e3-4a33-af12-549a427341f8');
  assert.equal(rows[0]?.scheduleDate, '2026-09-03');
  assert.equal(rows[0]?.totalJobs, 1);
});

test('예약 목록이 비어 있거나 모양이 다르면 빈 배열로 둔다', () => {
  assert.deepEqual(readScheduleList({ schedules: [] }), []);
  assert.deepEqual(readScheduleList({}), []);
  assert.deepEqual(readScheduleList(null), []);
  // id 가 없는 행은 취소 대상이 될 수 없으므로 아예 버린다.
  assert.deepEqual(readScheduleList({ schedules: [{ status: 'pending' }] }), []);
});

test('예약 상세는 건마다 projectId 를 살려서 낸다', () => {
  // 이 도구가 있는 이유. 보낸 원고 프로젝트가 실제로 저장됐는지는 여기서만 확인된다.
  const { schedule, jobs } = readScheduleDetail({
    schedule: { _id: 'sch_1', accountId: 'sampleblog01', scheduleDate: '2026-09-03', status: 'pending' },
    jobs: [
      {
        _id: 'job_809afa57',
        keyword: '제물포구맛집',
        scheduledAt: '2026-09-03 23:00',
        status: 'pending',
        projectId: '6a76084a9f8378fbf93e52f3',
        manuscriptType: 'restaurant',
      },
    ],
  });

  assert.equal(schedule?.id, 'sch_1');
  assert.equal(jobs[0]?.projectId, '6a76084a9f8378fbf93e52f3');
  assert.equal(jobs[0]?.keyword, '제물포구맛집');
  assert.equal(jobs[0]?.id, 'job_809afa57');
});

test('projectId 가 저장되지 않은 job 도 읽다가 죽지 않는다', () => {
  // mongoose 는 set 안 된 필드를 JSON 에 아예 넣지 않는다. 빈 문자열 자체가 "저장 안 됨" 이라는 결과다.
  const { jobs } = readScheduleDetail({
    schedule: { _id: 'sch_1', status: 'pending' },
    jobs: [{ _id: 'job_1', keyword: '가', scheduledAt: '2026-09-03 09:00', status: 'pending' }],
  });

  assert.equal(jobs[0]?.projectId, '');
  assert.equal(jobs[0]?.manuscriptType, '');
  assert.equal(jobs[0]?.postUrl, '');
});

test('없는 예약 응답은 schedule 을 null 로 둔다', () => {
  assert.deepEqual(readScheduleDetail({ message: 'Schedule not found' }), { schedule: null, jobs: [] });
  assert.deepEqual(readScheduleDetail(null), { schedule: null, jobs: [] });
});

test('404 본문의 메시지도 모델에게 넘긴다', () => {
  const error = Object.assign(new Error('Request failed with status code 404'), {
    response: { data: { message: 'Schedule not found' } },
  });

  assert.ok(describeSchedulerError(error).includes('Schedule not found'));
});

test('취소 응답은 success 가 참일 때만 성공으로 읽는다', () => {
  assert.deepEqual(readCancelScheduleResult({ success: true, id: 'sch_1' }), { ok: true, id: 'sch_1' });
  assert.equal(readCancelScheduleResult({ id: 'sch_1' }).ok, false);
  assert.equal(readCancelScheduleResult(null).ok, false);
});

test('예약 목록의 계정 id 는 가려서 낸다', () => {
  // GET /schedules 는 네이버 로그인 id 를 마스킹 없이 준다. 표와 모델에 원문을 흘리지 않는다.
  assert.equal(maskAccountId('sampleblog01'), 'sam***');
  assert.equal(maskAccountId('ab'), 'a***');
  assert.equal(maskAccountId(''), '');
  assert.equal(maskAccountId('sampleblog01').includes('sampleblog01'), false);
});

test('등록 응답에서 scheduleId 를 뽑아 둔다', () => {
  // 응답 원문을 잘라 넘기면 키워드가 많을 때 JSON 이 중간에서 끊긴다.
  // 되읽는 데 필요한 건 잡 목록이 아니라 id 뿐이다.
  const outcome = readAutoScheduleResult({
    success: true,
    totalJobs: 2,
    schedules: [{ scheduleId: 'sch_1' }, { _id: 'sch_2' }, { reused: true }],
  });

  assert.deepEqual(outcome.scheduleIds, ['sch_1', 'sch_2']);
  assert.deepEqual(readAutoScheduleResult({}).scheduleIds, []);
});

test('예약 목록은 등록 시각도 읽어 둔다', () => {
  // 계정별로 나눠 받은 목록을 다시 최신순으로 합치려면 이 값이 필요하다.
  const [row] = readScheduleList({
    schedules: [{ _id: 'sch_1', status: 'pending', createdAt: '2026-09-02T10:00:00.000Z' }],
  });

  assert.equal(row?.createdAt, '2026-09-02T10:00:00.000Z');
  // 없으면 빈 문자열로 두고 날짜 비교로 떨어진다. 던지지 않는다.
  assert.equal(readScheduleList({ schedules: [{ _id: 'sch_2', status: 'pending' }] })[0]?.createdAt, '');
});

test('404 는 읽기 실패가 아니라 없는 예약으로 가른다', () => {
  // axios 가 비-2xx 를 던지므로 "없는 예약" 은 schedule === null 이 아니라 예외로 온다.
  const notFound = Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404, data: { message: 'Schedule not found' } },
  });
  const unauthorized = Object.assign(new Error('Request failed with status code 401'), {
    response: { status: 401, data: { message: '인증이 필요합니다.' } },
  });

  assert.equal(isScheduleNotFound(notFound), true);
  assert.equal(isScheduleNotFound(unauthorized), false);
  assert.equal(isScheduleNotFound(new Error('connect ECONNREFUSED')), false);
  assert.equal(isScheduleNotFound(null), false);
});
