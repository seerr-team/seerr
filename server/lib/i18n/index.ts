import { createIntl, createIntlCache } from '@formatjs/intl';
import type { AvailableLocale } from '@server/types/languages';
import { availableLocales } from '@server/types/languages';
import fs from 'fs';
import path from 'path';

type IntlInstance = ReturnType<typeof createIntl>;

const cache = createIntlCache();
const intls = new Map<string, IntlInstance>();

export function initI18n(): void {
  for (const locale of availableLocales) {
    const filePath = path.join(__dirname, `locale/${locale}.json`);

    if (!fs.existsSync(filePath)) continue;

    const messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    intls.set(
      locale,
      createIntl(
        {
          locale,
          messages,
          defaultLocale: 'en',
        },
        cache
      )
    );
  }

  if (!intls.has('en')) {
    throw new Error(
      'Failed to initialize English locale - en.json is required'
    );
  }
}

export function getIntl(locale?: AvailableLocale): IntlInstance {
  return intls.get(locale ?? 'en') || intls.get('en')!;
}

type MessageDescriptorMap<T extends Record<string, string>> = {
  [K in keyof T]: { id: string; defaultMessage: T[K] };
};

export function defineMessages<T extends Record<string, string>>(
  namespace: string,
  messages: T
): MessageDescriptorMap<T> {
  const result = {} as MessageDescriptorMap<T>;

  for (const key of Object.keys(messages) as (keyof T)[]) {
    result[key] = {
      id: `${namespace}.${String(key)}`,
      defaultMessage: messages[key],
    };
  }

  return result;
}
