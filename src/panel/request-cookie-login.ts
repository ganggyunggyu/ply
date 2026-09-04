import { cookieLoginServices } from '../service-form';
import { ONBOARDING, CHAT } from '../messages';
import { api } from './dom';
import { appendCard } from './card';
import { appendEntry } from './chat-log';
import { panelState } from './state';

export const requestCookieLogin = () => {
  const services = cookieLoginServices(panelState.serviceCatalog);

  if (services.length === 0) {
    appendEntry(CHAT.roleAgent, ONBOARDING.ready);
    return;
  }

  appendCard({
    lead: ONBOARDING.askCookieLogin,
    fields: [],
    submitLabel: ONBOARDING.accountSkipLabel,
    skipLabel: '',
    hint: ONBOARDING.cookieLoginDone,
    chips: services.map(({ name, url }) => ({
      label: name,
      onPick: () => {
        void api.createTab({ url });
      },
    })),
    onSubmit: async () => {
      appendEntry(CHAT.roleAgent, ONBOARDING.ready);
      return true;
    },
  });
};
