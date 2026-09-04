/**
 * Cafe24 스토어프론트 경로. baseUrl 은 쇼핑몰마다 다르니 인자로 받는다(예: https://myshop.com).
 * 경로 부분은 Cafe24 가 고정으로 깔아 주는 것이라 몰이 바뀌어도 같다.
 */

const CAFE24_ADMIN_LOGIN = 'https://eclogin.cafe24.com/Shop/';

/** 끝 슬래시를 떼서 경로를 붙일 때 이중 슬래시가 안 나게 한다. */
export const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '');

export const loginUrl = (baseUrl: string) => `${normalizeBaseUrl(baseUrl)}/member/login.html`;
export const joinAgreeUrl = (baseUrl: string) => `${normalizeBaseUrl(baseUrl)}/member/join.html`;
export const myShopBoardUrl = (baseUrl: string) => `${normalizeBaseUrl(baseUrl)}/myshop/board_list.html`;

export const adminLoginUrl = () => CAFE24_ADMIN_LOGIN;

/** 상품 상세는 상품번호로 연다. Cafe24 는 /product/detail.html?product_no=N 형식이다. */
export const productUrl = (baseUrl: string, productNo: string | number) =>
  `${normalizeBaseUrl(baseUrl)}/product/detail.html?product_no=${productNo}`;
