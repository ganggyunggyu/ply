/**
 * 네이버 카페 셀렉터.
 *
 * 카페는 PC 화면이 iframe(`#cafe_main`) 안에서 돌고, 가입 흐름만 모바일 화면을 쓴다.
 * 값은 바이로(cafe-bot)에서 실제로 돌려 검증한 것을 그대로 가져왔다. 추측으로 고치지 않는다.
 */

export const CAFE_MAIN_FRAME = 'iframe#cafe_main';

export const JOIN_BUTTON = [
  'button:has-text("카페 가입하기")',
  'a:has-text("카페 가입하기")',
  'button:has-text("가입하기")',
  'a:has-text("가입하기")',
].join(', ');

export const JOIN_SUBMIT = [
  'button:has-text("동의 후 가입하기")',
  'a:has-text("동의 후 가입하기")',
  'button:has-text("가입하기")',
  'a:has-text("가입하기")',
  'button:has-text("확인")',
  'a:has-text("확인")',
  'button[type="submit"]',
  'input[type="submit"]',
].join(', ');

export const JOIN_CAPTCHA_IMAGE = [
  '.CafeJoinCaptcha img[alt*="보안문자"]',
  'img[alt*="보안문자"]',
].join(', ');

export const JOIN_CAPTCHA_INPUT = [
  'textarea#label_join_captcha',
  'textarea[placeholder*="보안문자"]',
  'input[placeholder*="보안문자"]',
].join(', ');

export const JOIN_CAPTCHA_REFRESH = [
  '.CafeJoinCaptcha button:has-text("새로고침")',
  'button.chaptcha_btn',
  'button:has-text("새로고침")',
].join(', ');

/** 대댓글 입력창에는 취소 버튼이 붙는다. 그걸로 원댓글 입력창만 고른다. */
export const COMMENT_INPUT = '.CommentWriter:not(:has(.btn_cancel)) textarea.comment_inbox_text';
export const COMMENT_SUBMIT = '.CommentWriter:not(:has(.btn_cancel)) a.btn_register';
export const COMMENT_ITEM = '.CommentItem';
export const ERROR_POPUP = '.LayerPopup, .popup_layer, [role="alertdialog"]';

export const NICKNAME_TAKEN = /사용할 수 없는 별명|별명을 다시|이미 사용|중복/;
export const JOIN_RESTRICTED = /가입이 제한|가입할 수 없습니다|활동이 정지/;
export const JOIN_PENDING = /가입.{0,5}신청.{0,5}완료|승인.{0,5}대기/;
export const CAPTCHA_REJECTED = /보안문자를 정확히|보안문자를 입력/;
