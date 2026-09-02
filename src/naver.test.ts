import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodePostTitle,
  isBlogOrigin,
  isPostGone,
  isPublishedPostUrl,
  isSessionExpired,
  judgePostListVerdict,
  modifierKey,
  parseBlogIdFromUrl,
  parseLogNo,
  parsePostListResponse,
  titleMatches,
} from './naver';

test('로그인 페이지로 튕기면 세션 만료로 본다', () => {
  assert.equal(isSessionExpired('https://nid.naver.com/nidlogin.login'), true);
  assert.equal(isSessionExpired('https://blog.naver.com/nidlogin?x=1'), true);
  assert.equal(isSessionExpired('https://blog.naver.com/GoBlogWrite.naver'), false);
});

test('플랫폼에 맞는 수정자 키를 쓴다', () => {
  assert.equal(modifierKey(), process.platform === 'darwin' ? 'Meta' : 'Control');
});

test('발행된 글 주소만 완료로 본다', () => {
  assert.equal(isPublishedPostUrl('https://blog.naver.com/sampleblog/223344556677'), true);
  assert.equal(isPublishedPostUrl('https://blog.naver.com/sampleblog?Redirect=Write&'), false);
  assert.equal(isPublishedPostUrl('https://blog.naver.com/GoBlogWrite.naver'), false);
  assert.equal(isPublishedPostUrl('https://blog.naver.com/sampleblog'), false);
  assert.equal(isPublishedPostUrl('https://blog.naver.com/sampleblog/12345'), false);
});

test('블로그 주소에서 실제 blogId 만 뽑는다', () => {
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com/sampleblog/223344556677'), 'sampleblog');
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com/sampleblog'), 'sampleblog');
});

test('페이지 이름을 blogId 로 오인하지 않는다', () => {
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com/GoBlogWrite.naver'), null);
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com/PostList.naver?blogId=x'), null);
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com/prologue'), null);
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com/PostView.naver?blogId=y&logNo=1'), null);
});

test('블로그 도메인이 아니면 blogId 가 없다', () => {
  assert.equal(parseBlogIdFromUrl('https://nid.naver.com/nidlogin.login'), null);
});

test('호스트를 흉내낸 주소에서 blogId 를 뽑지 않는다', () => {
  assert.equal(parseBlogIdFromUrl('https://evil.example/blog.naver.com/victim/1'), null);
  assert.equal(parseBlogIdFromUrl('https://blog.naver.com.evil.example/victim'), null);
  assert.equal(parseBlogIdFromUrl('blog.naver.com/victim'), null);
});

test('상대경로 요청을 보낼 수 있는 오리진만 통과시킨다', () => {
  assert.equal(isBlogOrigin('https://blog.naver.com/sampleblog/223344556677'), true);
  assert.equal(isBlogOrigin('https://nid.naver.com/nidlogin.login'), false);
  assert.equal(isBlogOrigin('https://m.blog.naver.com/sampleblog'), false);
  assert.equal(isBlogOrigin('about:blank'), false);
});

test('logNo 는 6~20자리 숫자만 통과한다', () => {
  assert.equal(parseLogNo('223344556677'), '223344556677');
  assert.equal(parseLogNo(223344556677), '223344556677');
});

test('logNo 형식이 아니면 전부 거른다', () => {
  assert.equal(parseLogNo('12345'), null);
  assert.equal(parseLogNo(''), null);
  assert.equal(parseLogNo('abc'), null);
  assert.equal(parseLogNo(null), null);
  assert.equal(parseLogNo('123 456'), null);
  assert.equal(parseLogNo('12345678901234567890123'), null);
});

test('숫자로 넘겼을 때 값이 어긋나는 길이는 거른다', () => {
  assert.equal(parseLogNo('1234567890123456'), null);
  assert.equal(parseLogNo('999999999999999'), '999999999999999');
  assert.equal(Number.isSafeInteger(Number('999999999999999')), true);
});

test('글 제목은 URL 디코딩하고 + 를 공백으로 바꾼다', () => {
  assert.equal(decodePostTitle('%EA%B0%95%EC%95%84%EC%A7%80+%EC%9C%A0%EC%B9%98%EC%9B%90'), '강아지 유치원');
});

test('디코딩에 실패해도 던지지 않는다', () => {
  assert.equal(decodePostTitle('%ZZ+broken'), '%ZZ broken');
});

test('정상 목록 응답을 파싱한다', () => {
  const posts = parsePostListResponse(
    '{"postList":[{"logNo":"223344556677","title":"%EA%B0%9C","addDate":"2026.08.30"}],"totalCount":1}',
  );

  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], { logNo: '223344556677', title: '개', addDate: '2026.08.30' });
});

test('표준 JSON 이 아니어도 postList 배열을 뽑아낸다', () => {
  const raw =
    `{"postList":[{"logNo":"223344556677","title":"%EA%B0%9C%EC%9D%98+\\'%ED%95%98%EB%A3%A8\\'","addDate":"2026.08.30"}],` +
    `"pagingHtml":'<a href="#">1</a>'}`;

  const [post] = parsePostListResponse(raw);

  assert.deepEqual(post, { logNo: '223344556677', title: "개의 '하루'", addDate: '2026.08.30' });
});

test('logNo 가 망가진 항목만 버린다', () => {
  const posts = parsePostListResponse(
    '{"postList":[' +
      '{"logNo":null,"title":"%EA%B0%9C","addDate":"2026.08.30"},' +
      '{"logNo":"abc","title":"%EA%B0%9C","addDate":"2026.08.30"},' +
      '{"logNo":"223344556677","title":"%EA%B0%9C","addDate":"2026.08.30"}' +
      ']}',
  );

  assert.equal(posts.length, 1);
  assert.equal(posts.at(0)?.logNo, '223344556677');
});

test('목록 응답이 쓰레기면 빈 배열을 준다', () => {
  assert.deepEqual(parsePostListResponse('쓰레기 응답'), []);
  assert.deepEqual(parsePostListResponse('{}'), []);
});

test('404 와 410 만 지워진 것으로 본다', () => {
  assert.equal(isPostGone(404), true);
  assert.equal(isPostGone(410), true);
});

test('200 응답으로는 삭제를 단정하지 않는다', () => {
  assert.equal(isPostGone(200), false);
  assert.equal(isPostGone(500), false);
  assert.equal(isPostGone(302), false);
});

const listBody = (...logNos: string[]) =>
  `{"postList":[${logNos
    .map((logNo) => `{"logNo":"${logNo}","title":"%EA%B0%9C","addDate":"2026.08.30"}`)
    .join(',')}],"totalCount":${logNos.length}}`;

test('목록에서 사라졌으면 지워진 것으로 본다', () => {
  assert.equal(judgePostListVerdict(200, listBody('111111111111'), '223344556677'), 'deleted');
});

test('목록에 그대로 있으면 아직 살아있는 글이다', () => {
  assert.equal(
    judgePostListVerdict(200, listBody('223344556677', '111111111111'), '223344556677'),
    'alive',
  );
});

test('목록을 못 읽으면 삭제됐다고 우기지 않는다', () => {
  assert.equal(judgePostListVerdict(302, listBody('111111111111'), '223344556677'), 'unknown');
  assert.equal(judgePostListVerdict(200, '<html>로그인</html>', '223344556677'), 'unknown');
  assert.equal(judgePostListVerdict(200, '{"postList":[]}', '223344556677'), 'unknown');
});

test('공백만 다른 제목은 같은 제목으로 본다', () => {
  assert.equal(titleMatches('강아지  유치원 고르는 법', '강아지 유치원 고르는 법'), true);
  assert.equal(titleMatches('강아지 유치원 고르는 법 ', '강아지 유치원 고르는 법...'), true);
});

test('연작 제목을 같은 글로 보지 않는다', () => {
  assert.equal(titleMatches('강아지 유치원 고르는 법', '강아지 유치원 고르는 법 2편'), false);
  assert.equal(titleMatches('다이어트 후기', '다이어트 후기 3일차'), false);
});

test('실제 제목이 더 짧아도 통과시키지 않는다', () => {
  assert.equal(titleMatches('오늘의 일기', '일기'), false);
  assert.equal(titleMatches('강아지 유치원 고르는 법', '강아지'), false);
  assert.equal(titleMatches('2026년 봄 여행 후기', '봄'), false);
});

test('다른 글 제목은 통과시키지 않는다', () => {
  assert.equal(titleMatches('개', '고양이'), false);
  assert.equal(titleMatches('', '무엇'), false);
  assert.equal(titleMatches('강아지 유치원', '고양이 카페'), false);
});
