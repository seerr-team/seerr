import { shouldPolyfill as shouldPolyfillLocale } from '@formatjs/intl-locale/should-polyfill.js';

const polyfillLocale = async () => {
  if (shouldPolyfillLocale()) {
    await import('@formatjs/intl-locale/polyfill.js');
  }
};

export const polyfillIntl = async () => {
  await polyfillLocale();
};
