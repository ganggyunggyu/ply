import { IMAGE_SOURCES, MANUSCRIPT_TYPES, SCHEDULE_STATUSES } from '../scheduler-enums';

export const PARAM_DESCRIPTIONS = {
  cafeUrl:
    '카페 주소나 슬러그. `https://cafe.naver.com/<슬러그>` 형태 또는 슬러그만. 모르면 cafeId 를 쓴다.',
  cafeId: '카페 숫자 id. 바이로 api_get /api/agent/cafes 로 얻을 수 있다.',
  cafeNickname: '그 카페에서 쓸 별명. 한글과 영숫자만 남고 20자에서 잘린다.',
  cafeArticleId: '댓글을 달 글의 번호. 카페 글 주소 끝의 숫자다.',
  cafeCommentBody: '댓글 내용. 줄바꿈은 공백으로 합쳐진다.',
  accountId: 'list_accounts 가 돌려준 계정 id',
  schedulerAccountId: 'list_scheduler_accounts 가 돌려준 id. 브라우저 프로필 id 를 그대로 넣으면 안 된다.',
  keyword: '글의 주제 키워드',
  tone: '원하는 톤. 없으면 생략',
  angle: '같은 키워드로 여러 편 쓸 때 각 편의 차별점',
  ref: '참고 자료나 업체 정보',
  model: '지정할 모델. 비우면 다붓 기본값',
  profileId: '이 계정 프로필로 열고 싶을 때만',
  question: '사용자에게 보여줄 질문 한 문장',
  choices: '고르게 할 보기. 자유 입력이면 생략',
  formFields: [
    '받을 값 목록. 칸 하나가 객체 하나다.',
    'key 는 결과에서 값을 찾을 이름, label 은 칸 왼쪽에 보이는 짧은 이름이다.',
    'type 은 text/number/date/time 중 하나이고 기본은 text 다. 날짜는 date, 시각은 time 을 쓴다.',
    'choices 를 주면 고르는 칸이 된다. 보기 하나는 { label, value } 다. label 은 화면에 보이는 글자, value 는 답으로 돌아오는 값이다. 이름과 id 가 다르면 반드시 둘을 나눠 넣는다.',
    '칸의 value 는 미리 채워둘 값이다. choices 가 있으면 그 보기의 value 중 하나여야 한다. optional 이 true 면 비워도 넘어간다.',
    '비밀번호는 절대 이걸로 받지 않는다.',
  ].join(' '),
  formChoiceItems:
    '보기 목록. 보기 하나는 { label, value } 다. label 은 사용자가 보는 글자, value 는 답으로 돌아오는 값이다. 이름과 id 가 다르면 label 에 이름을, value 에 id 를 넣는다. 둘이 같아도 되지만 둘 다 채운다.',
  scheduleDate:
    'YYYY-MM-DD 형식의 실제 날짜. 월과 일은 두 자리로 쓴다. 오늘이거나 그 뒤여야 한다. 오늘 날짜는 시스템 프롬프트에 적혀 있다',
  manuscriptType: `원고 스타일. 아래 목록 밖의 값을 넣으면 스케줄러가 거부한다: ${MANUSCRIPT_TYPES.join(', ')}. projectId 를 넘기면 원고 생성에서는 이 값이 무시되지만 발행 모드 계산에는 그대로 쓰인다`,
  imageSource: `본문에 넣을 이미지를 어디서 가져올지: ${IMAGE_SOURCES.join(', ')}. 안 주면 ai 로 돈다`,
  scheduleProjectId:
    'list_dabut_projects 가 이번 실행에서 돌려준 프로젝트 id. 목록에 없던 id 는 거부된다. 넘기면 원고를 그 프로젝트 방식으로 뽑는다(원고 생성에서만 manuscriptType 을 대신한다). 다붓 로그인이 되어 있을 때만 쓴다',
  postsPerDay: '하루에 몇 건 발행할지. 1 에서 10 사이',
  startHour:
    '첫 글을 몇 시에 올릴지. 0 에서 23 사이. 필수다. 사용자가 말하지 않았으면 ask_user_form 으로 물어보고, 짐작해서 채우지 않는다',
  intervalMinutes: '글 사이 간격(분). 10 에서 720 사이',
  keywordCategory: '이 예약 묶음에 붙일 카테고리. 없으면 생략',
  blogName: '스케줄러 계정에 등록된 블로그 이름. 없으면 생략',
  scheduleId:
    'list_schedules 나 get_schedule 이 이번 실행에서 돌려준 scheduleId. sch_ 로 시작하는 문자열을 접두사까지 그대로 넣는다',
  scheduleAccountFilter:
    '특정 계정의 예약만 보고 싶을 때만. list_scheduler_accounts 가 돌려준 id 나 이름을 그대로 넣는다. 생략하면 내 계정 전부를 본다. 목록에 없는 값을 넣으면 거부된다',
  scheduleStatusFilter: `상태로 거를 때만: ${SCHEDULE_STATUSES.join(', ')}. 예약 묶음의 상태이고 건별 상태(generating, published 등)와는 다르다. 확실하지 않으면 생략한다`,
  exposureJob: 'list_exposure_jobs 의 key',
  serviceName: '서비스 이름 또는 key. 예: 노출지기, 다붓, 시트앱, cafe-bot',
  projectId: 'list_dabut_projects 가 돌려준 프로젝트 id',
  projectChanges:
    '바꿀 항목만 담은 객체. 보낸 것만 바뀐다. 쓸 수 있는 키는 label, description, model, system_prompt, user_prompt_template, pre_steps, post_steps, db_category, is_active. 스텝은 [{type, config}] 배열이다.',
  loginReason: '왜 로그인이 필요한지 한 문장. 카드에 그대로 보인다',
  businessName: '업체를 고정하고 싶을 때만. 웹검색 단계가 이 업체로 검색한다',
  withImages: '이미지까지 만들지 여부. 기본은 원고만',
  postLimit: '가져올 글 개수. 기본 10, 최대 30',
  logNos: 'list_my_posts 가 돌려준 logNo 문자열 배열. 목록에 없던 번호를 넣으면 거부된다. 최대 10개',

  accountAction:
    'add 는 새 계정 등록, change_password 는 저장된 비밀번호 갱신, remove 는 삭제다. remove 는 되돌릴 수 없다',
  manageAccountId:
    'change_password 와 remove 에 필수. list_accounts 가 이번 실행에서 돌려준 id 만 받는다. 기억으로 지어내지 않는다',
  accountLabel: 'add 에서 카드에 미리 채울 이름. 사용자가 부르는 이름이면 된다',
  accountNaverId: 'add 에서 카드에 미리 채울 네이버 아이디. 모르면 비운다',
  accountReason: '왜 이 작업이 필요한지 한 문장. 카드에 그대로 보인다',

  presetAction:
    '무엇을 할지. add_cafe_check 는 카페 노출체크 만들기, remove_cafe_check 는 지우기, enable_target/disable_target 은 대상 켜고 끄기, add_blog_group 은 계정 그룹 추가, set_dooray_webhook 은 알림 주소 설정이다',
  presetLabel: '사람이 부를 이름. add_cafe_check 와 add_blog_group 에 필수. id 는 도구가 만든다',
  presetSheetUrl:
    'add_cafe_check 에 필수. 키워드를 읽고 결과도 쓸 구글시트 주소. /spreadsheets/d/ 가 들어간 전체 주소를 그대로 넣는다',
  presetTabTitle: 'add_cafe_check 에 필수. 그 시트 안의 탭 이름',
  presetCafeTargets:
    'add_cafe_check 에 필수. 노출을 확인할 카페·블로그 주소 목록. cafe.naver.com 이면 카페, blog.naver.com 이면 블로그로 갈린다. 주소에 쉼표를 넣을 수 없다',
  presetCheckId: 'remove_cafe_check 에 필수. GET 으로 읽은 프리셋의 cafeChecks[].id',
  presetTargetId:
    'enable_target 과 disable_target 에 필수. 프리셋의 targets[].id. 없는 id 는 거부된다',
  presetBlogIds: 'add_blog_group 에 필수. 이 그룹에 넣을 블로그 아이디 목록',
  presetDoorayUrl: 'set_dooray_webhook 에 필수. https 로 시작하는 웹훅 주소',

  apiDocTopic: '읽을 주제. 빼면 목차가 나온다',
  apiDocSection: "그 문서 안의 '## 제목'. 빼면 문서 전체가 나온다",
  apiService: '어느 서버에서 읽을지',
  apiPath:
    "슬래시로 시작하는 경로. 물음표와 쿼리 문자열을 붙이지 않는다. 값은 query 로 따로 준다. 경로에 id 가 들어가면 그 자리에 실제 값을 넣는다",
  apiQuery: '쿼리 파라미터. 객체로 준다. 인코딩은 앱이 한다',
  shopAccountId: 'list_shop_accounts 가 돌려준 쇼핑몰 계정 id',
  productNo: '상품 번호. Cafe24 상품 주소 끝의 product_no 값이다',
} as const;
