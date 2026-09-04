import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { shopLogin, visitProduct, loginUrl, productUrl } from '../../shop';
import type { ToolRuntime } from '../runtime';

/**
 * Cafe24 쇼핑몰 도구. 로그인과 상품 이동까지 — 되돌릴 수 없는 구매/후기 단계는 라이브 검증이
 * 필요해 아직 도구로 열지 않았다. 비밀번호는 저장소에서 앱이 꺼내 쓰고 모델로는 넘어가지 않는다.
 */
export const createShopTools = (runtime: ToolRuntime): [ToolSpec, ToolSpec, ToolSpec] => {
  const { shopAccountStore, withAgentTab } = runtime;

  const listShopAccounts: ToolSpec = {
    name: 'list_shop_accounts',
    description: DESC.listShopAccounts,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const accounts = shopAccountStore.list();
      if (accounts.length === 0) return RESULT.shopNoAccounts;

      return accounts.map(({ id, label, baseUrl }) => `${id} · ${label} · ${baseUrl}`).join('\n');
    },
  };

  const shopLoginTool: ToolSpec = {
    name: 'shop_login',
    description: DESC.shopLogin,
    parameters: {
      type: 'object',
      properties: { shopAccountId: { type: 'string', description: PARAM.shopAccountId } },
      required: ['shopAccountId'],
      additionalProperties: false,
    },
    run: async ({ shopAccountId }) => {
      const id = String(shopAccountId);
      const account = shopAccountStore.find(id);
      if (!account) return RESULT.shopAccountNotFound(id);

      const password = shopAccountStore.readPassword(id);
      if (!password) return RESULT.shopNoStoredPassword;

      return withAgentTab({ url: loginUrl(account.baseUrl), profileId: `shop-${id}` }, async ({ page }) => {
        const { detail } = await shopLogin(page, { baseUrl: account.baseUrl, id: account.memberId, password });
        return RESULT.shopLoginDone(detail);
      });
    },
  };

  const shopVisitProduct: ToolSpec = {
    name: 'shop_visit_product',
    description: DESC.shopVisitProduct,
    parameters: {
      type: 'object',
      properties: {
        shopAccountId: { type: 'string', description: PARAM.shopAccountId },
        productNo: { type: 'string', description: PARAM.productNo },
      },
      required: ['shopAccountId', 'productNo'],
      additionalProperties: false,
    },
    run: async ({ shopAccountId, productNo }) => {
      const id = String(shopAccountId);
      const account = shopAccountStore.find(id);
      if (!account) return RESULT.shopAccountNotFound(id);

      return withAgentTab({ url: productUrl(account.baseUrl, String(productNo)), profileId: `shop-${id}` }, async ({ page }) => {
        const { detail } = await visitProduct(page, account.baseUrl, String(productNo));
        return RESULT.shopStepDone(detail);
      });
    },
  };

  return [listShopAccounts, shopLoginTool, shopVisitProduct];
};
