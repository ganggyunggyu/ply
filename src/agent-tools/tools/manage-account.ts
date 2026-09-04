import type { ToolSpec } from '../../openrouter';
import { TOOL_RESULTS as RESULT, TOOL_DESCRIPTIONS as DESC, PARAM_DESCRIPTIONS as PARAM } from '../../prompts';
import { PROGRESS } from '../../messages';
import { parseCardOutcome, describeDabutSync } from '../card-outcome';
import { requestAccountRemoveApproval } from '../approval';
import type { ToolRuntime } from '../runtime';

export const createManageAccountTools = (runtime: ToolRuntime): [ToolSpec] => {
  const { declinedCards, onProgress, requestAccountCard, signal, knownAccountIds, accountStore, touchedAccountIds, askUser } = runtime;

  const manageNaverAccount: ToolSpec = {
    name: 'manage_naver_account',
    description: DESC.manageNaverAccount,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'change_password', 'remove'],
          description: PARAM.accountAction,
        },
        accountId: { type: 'string', description: PARAM.manageAccountId },
        label: { type: 'string', description: PARAM.accountLabel },
        naverId: { type: 'string', description: PARAM.accountNaverId },
        reason: { type: 'string', description: PARAM.accountReason },
      },
      required: ['action'],
      additionalProperties: false,
    },
    // 비밀번호 파라미터가 없다. 카드로 받는다. 인자에 실으면 tool_start 이벤트와
    // OpenRouter 요청 본문에 평문이 그대로 남는다.
    run: async ({ action, accountId, label, naverId, reason }) => {
      const mode = String(action ?? '');
      const note = reason === undefined || reason === null ? '' : String(reason);

      if (mode === 'add') {
        if (declinedCards.has('account_add')) return RESULT.accountCardAlreadyDeclined;

        onProgress(PROGRESS.accountCardWaiting);

        const answer = await requestAccountCard({
          mode: 'add',
          accountId: '',
          label: label ? String(label) : '',
          naverId: naverId ? String(naverId) : '',
          reason: note,
        }).catch(() => '');

        if (!answer) {
          declinedCards.add('account_add');

          return signal?.aborted ? RESULT.runStopped : RESULT.accountCardNoAnswer;
        }

        const outcome = parseCardOutcome(answer);
        if (outcome.status !== 'account_added') {
          declinedCards.add('account_add');

          return RESULT.accountCardCancelled;
        }

        knownAccountIds.add(outcome.id);

        return RESULT.accountAdded(outcome.label, outcome.id);
      }

      const id = accountId === undefined || accountId === null ? '' : String(accountId).trim();
      if (!id) return RESULT.accountIdRequired;

      // 목록에 없던 id 는 거부한다. delete_blog_posts 의 knownPosts 와 같은 이유다.
      if (!knownAccountIds.has(id)) return RESULT.accountNotListed(id);

      const account = accountStore.find(id);
      if (!account) return RESULT.accountNotFound(id);

      if (touchedAccountIds.has(id)) return RESULT.accountAlreadyAttempted(id);

      if (mode === 'change_password') {
        onProgress(PROGRESS.accountCardWaiting);

        const answer = await requestAccountCard({
          mode: 'change_password',
          accountId: id,
          label: account.label,
          naverId: account.naverId,
          reason: note,
        }).catch(() => '');

        // 거절도 끈적하게 만든다. 성공했을 때만 표시하면 카드를 무한히 다시 띄울 수 있다.
        if (!answer) {
          touchedAccountIds.add(id);

          return signal?.aborted ? RESULT.runStopped : RESULT.accountCardNoAnswer;
        }

        const outcome = parseCardOutcome(answer);
        if (outcome.status !== 'account_password') {
          touchedAccountIds.add(id);

          return RESULT.accountCardCancelled;
        }

        touchedAccountIds.add(id);

        // 두 곳을 반드시 따로 적는다. 한 줄로 뭉치면 모델이 "다 바꿨어요" 라고 보고한다.
        return RESULT.accountPasswordChanged([
          RESULT.accountLocalChanged,
          describeDabutSync(outcome.dabut, outcome.dabutDetail),
        ]);
      }

      if (mode !== 'remove') return RESULT.accountActionUnknown(mode);

      onProgress(PROGRESS.accountRemoveConfirmWaiting(account.label));

      const { approved, answer, answered } = await requestAccountRemoveApproval({ askUser, account });

      if (!approved) {
        touchedAccountIds.add(id);

        return answered ? RESULT.accountRemoveNotApproved(answer) : RESULT.accountRemoveNoAnswer(id);
      }

      touchedAccountIds.add(id);
      accountStore.remove(id);
      knownAccountIds.delete(id);

      return RESULT.accountRemoved(account.label, id);
    },
  };

  return [manageNaverAccount];
};
