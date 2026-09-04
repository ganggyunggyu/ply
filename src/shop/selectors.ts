/**
 * Cafe24 쇼핑몰 표준 셀렉터. 특정 쇼핑몰이 아니라 Cafe24 플랫폼이 공통으로 깔아 주는 마크업이라
 * baseUrl 만 바꾸면 어느 Cafe24 몰에서도 같은 셀렉터가 먹는다. hanryeo-bot 에서 검증된 값들이다.
 */

/** 회원 로그인 (스토어프론트) */
export const LOGIN_ID = '#member_id';
export const LOGIN_PW = '#member_passwd';
/** 로그인 버튼은 onclick 으로 MemberAction.login 을 부르는 a 태그다. */
export const LOGIN_SUBMIT = 'a.btnSubmit[onclick*="MemberAction.login"]';

/** 회원가입 폼 */
export const JOIN_ID = '#member_id';
export const JOIN_PW = '#passwd';
export const JOIN_PW_CONFIRM = '#user_passwd_confirm';
export const JOIN_NAME = '#name';
export const JOIN_MOBILE1 = '#mobile1';
export const JOIN_MOBILE2 = '#mobile2';
export const JOIN_MOBILE3 = '#mobile3';
export const JOIN_EMAIL = '#email1';
export const JOIN_CONFIRM_LAYER = '#ec_shop_confirm-checkingjoininfo_action';

/** 약관 동의 */
export const AGREE_ALL = '#sAgreeAllChecked';
export const AGREE_NEXT = 'button.btnSubmitFix';

/** 주문/결제 */
export const BUY_SUBMIT = 'a.btnSubmit';
export const ORDER_ZIP_SEARCH = '#btn_search_rzipcode';
export const ORDER_ADDR2 = '#raddr2';
export const ORDER_BANK = '#bankaccount';
export const ORDER_NAME = '#pname';
export const ORDER_PAYMENT = '#btn_payment';

/** 리뷰/QNA 공통 글쓰기 */
export const BOARD_SUBJECT = '#subject';
export const BOARD_CONTENT_IFRAME = '#content_IFRAME';
export const BOARD_CAPTCHA_IMAGE = '#captcha_Write';
export const BOARD_CAPTCHA_INPUT = '#captcha';

/** 관리자 로그인 (Cafe24 EC admin) */
export const ADMIN_MALL_ID = '#mall_id';
export const ADMIN_PW = '#userpasswd';
export const ADMIN_SUBMIT = 'button.btnStrong.large';
