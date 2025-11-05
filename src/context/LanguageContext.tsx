import { type AvailableLocale } from '@server/types/languages';
import React from 'react';

type AvailableLanguageObject = Record<
  string,
  { code: AvailableLocale; display: string }
>;

export const availableLanguages: AvailableLanguageObject = {
  bg: {
    code: 'bg',
    display: 'Bulgarian',
  },
  ca: {
    code: 'ca',
    display: 'Català',
  },
  cs: {
    code: 'cs',
    display: 'Čeština',
  },
  da: {
    code: 'da',
    display: 'Dansk',
  },
  de: {
    code: 'de',
    display: 'Deutsch',
  },
  en: {
    code: 'en',
    display: 'English',
  },
  es: {
    code: 'es',
    display: 'Español',
  },
  'es-MX': {
    code: 'es-MX',
    display: 'Español (Latinoamérica)',
  },
  fi: {
    code: 'fi',
    display: 'Finnish',
  },
  fr: {
    code: 'fr',
    display: 'Français',
  },
  he: {
    code: 'he',
    display: 'Hebrew',
  },
  hi: {
    code: 'hi',
    display: 'Hindi',
  },
  hr: {
    code: 'hr',
    display: 'Hrvatski',
  },
  it: {
    code: 'it',
    display: 'Italiano',
  },
  lt: {
    code: 'lt',
    display: 'Lietuvių',
  },
  hu: {
    code: 'hu',
    display: 'Magyar',
  },
  nl: {
    code: 'nl',
    display: 'Nederlands',
  },
  'nb-NO': {
    code: 'nb-NO',
    display: 'Norsk Bokmål',
  },
  pl: {
    code: 'pl',
    display: 'Polski',
  },
  'pt-BR': {
    code: 'pt-BR',
    display: 'Português (Brasil)',
  },
  'pt-PT': {
    code: 'pt-PT',
    display: 'Português (Portugal)',
  },
  sq: {
    code: 'sq',
    display: 'Shqip',
  },
  sv: {
    code: 'sv',
    display: 'Svenska',
  },
  el: {
    code: 'el',
    display: 'Ελληνικά',
  },
  ro: {
    code: 'ro',
    display: 'Romanian',
  },
  ru: {
    code: 'ru',
    display: 'pусский',
  },
  sr: {
    code: 'sr',
    display: 'српски језик',
  },
  tr: {
    code: 'tr',
    display: 'Türkçe',
  },
  ar: {
    code: 'ar',
    display: 'العربية',
  },
  ja: {
    code: 'ja',
    display: '日本語',
  },
  ko: {
    code: 'ko',
    display: '한국어',
  },
  uk: {
    code: 'uk',
    display: 'українська мова',
  },
  'zh-TW': {
    code: 'zh-TW',
    display: '繁體中文',
  },
  'zh-CN': {
    code: 'zh-CN',
    display: '简体中文',
  },
};

export interface LanguageContextProps {
  locale: AvailableLocale;
  children: (locale: string) => React.ReactNode;
  setLocale?: React.Dispatch<React.SetStateAction<AvailableLocale>>;
}

export const LanguageContext = React.createContext<
  Omit<LanguageContextProps, 'children'>
>({
  locale: 'en',
});
