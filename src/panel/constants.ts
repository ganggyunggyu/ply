import { CHAT, ONBOARDING, PANEL, SETTINGS } from '../messages';

export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys';


export const PLACEHOLDERS: Record<string, string> = {
  apiKeyPlaceholder: ONBOARDING.apiKeyPlaceholder,
  accountIdPlaceholder: ONBOARDING.accountIdPlaceholder,
  accountPwPlaceholder: ONBOARDING.accountPwPlaceholder,
  accountLabelPlaceholder: PANEL.accountLabelPlaceholder,
  dabutPlaceholder: PANEL.dabutPlaceholder,
  schedulerPlaceholder: PANEL.schedulerPlaceholder,
  exposurePlaceholder: PANEL.exposurePlaceholder,
  composerPlaceholder: CHAT.composerPlaceholder,
  serviceUserPlaceholder: SETTINGS.serviceUserPlaceholder,
  servicePassPlaceholder: SETTINGS.servicePassPlaceholder,
  viroTokenPlaceholder: SETTINGS.viroTokenPlaceholder,
  shopLabelPlaceholder: SETTINGS.shopLabelPlaceholder,
  shopUrlPlaceholder: SETTINGS.shopUrlPlaceholder,
  shopIdPlaceholder: SETTINGS.shopIdPlaceholder,
  shopPwPlaceholder: SETTINGS.shopPwPlaceholder,
};
