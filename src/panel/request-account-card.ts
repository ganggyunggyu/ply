import { ONBOARDING, CHAT } from '../messages';
import type { AccountCardRequest, AgentCardOutcome } from '../bridge';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { addThinking } from './thinking';
import { renderAccounts } from './account-list';
import { readableError } from './readable-error';
import type { CardField } from './types';

/**
 * 에이전트가 manage_naver_account 를 부르면 이 카드가 뜬다.
 *
 * 비밀번호 칸이 이 경로에만 있다. 폼 질문(ask_user_form)에는 password 칸을 만들 수 없다 —
 * 폼 답은 모델에게 그대로 돌아가기 때문이다.
 */
export const requestAgentAccountCard = ({ id, mode, reason, label, naverId, accountId }: AccountCardRequest) => {
  const finish = async (outcome: AgentCardOutcome) => {
    const accepted = await api.answerAccountCard(id, JSON.stringify(outcome));

    if (accepted) {
      addThinking();
      return;
    }

    appendEntry(CHAT.roleSystem, CHAT.answerExpired, 'error');
  };

  const isAdd = mode === 'add';

  const fields: CardField[] = isAdd
    ? [
        { placeholder: ONBOARDING.accountLabelPlaceholder, value: label },
        { placeholder: ONBOARDING.accountIdPlaceholder, value: naverId },
        { placeholder: ONBOARDING.accountPwPlaceholder, type: 'password' },
      ]
    : [{ placeholder: ONBOARDING.accountPwOnlyPlaceholder, type: 'password' }];

  // 첫 줄은 코드 문장으로 고정한다. reason 은 모델 문자열이라 note 로만 내려간다.
  const lead = isAdd ? ONBOARDING.accountAddLead : ONBOARDING.accountPwChangeLead(label);

  appendCard({
    lead,
    note: reason,
    fields,
    submitLabel: isAdd ? ONBOARDING.accountSaveLabel : ONBOARDING.accountPwChangeLabel,
    hint: isAdd ? ONBOARDING.accountHint : ONBOARDING.accountPwChangeHint,
    onSubmit: async (values, setError) => {
      const [first, second, third] = values;
      const nextLabel = isAdd ? (first ?? '').trim() : label;
      const nextNaverId = isAdd ? (second ?? '').trim() : naverId;
      const password = isAdd ? (third ?? '') : (first ?? '');

      if (isAdd && !nextNaverId) return false;
      if (!isAdd && !password) return false;

      try {
        const outcome = await api.applyAccountChange({
          mode,
          accountId,
          label: nextLabel || nextNaverId,
          naverId: nextNaverId,
          password,
        });

        renderAccounts(await api.listAccounts());
        await finish(outcome);
        return true;
      } catch (error) {
        setError(readableError(error));
        return false;
      }
    },
    onSkip: () => {
      appendEntry(CHAT.roleAgent, ONBOARDING.accountCardCancelled);
      void finish({ status: 'cancelled' });
    },
  });
};
