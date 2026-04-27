import { shouldPolyfill as shouldPolyfillDisplayNames } from '@formatjs/intl-displaynames/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillLocale } from '@formatjs/intl-locale/should-polyfill.js';
import { shouldPolyfill as shouldPolyfillPluralrules } from '@formatjs/intl-pluralrules/should-polyfill.js';

const polyfillLocale = async () => {
  if (shouldPolyfillLocale()) {
    await import('@formatjs/intl-locale/polyfill.js');
  }
};

const polyfillPluralRules = async (locale: string) => {
  const unsupportedLocale = shouldPolyfillPluralrules(locale);
  // This locale is supported
  if (!unsupportedLocale) {
    return;
  }
  // Load the polyfill 1st BEFORE loading data
  await import('@formatjs/intl-pluralrules/polyfill-force.js');
  await import(
    `@formatjs/intl-pluralrules/locale-data/${unsupportedLocale}.js`
  );
};

const polyfillDisplayNames = async (locale: string) => {
  const unsupportedLocale = shouldPolyfillDisplayNames(locale);
  // This locale is supported
  if (!unsupportedLocale) {
    return;
  }
  // Load the polyfill 1st BEFORE loading data
  await import('@formatjs/intl-displaynames/polyfill-force.js');
  await import(
    `@formatjs/intl-displaynames/locale-data/${unsupportedLocale}.js`
  );
};

export const polyfillIntl = async (locale: string) => {
  await polyfillLocale();
  await polyfillPluralRules(locale);
  await polyfillDisplayNames(locale);
};
