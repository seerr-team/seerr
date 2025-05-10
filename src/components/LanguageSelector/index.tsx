import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import type { Language } from '@server/interfaces/settings';
import { sortBy } from 'lodash';
import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import type { CSSObjectWithLabel } from 'react-select';
import Select from 'react-select';
import useSWR from 'swr';

const messages = defineMessages('components.LanguageSelector', {
  originalLanguageDefault: 'All Languages',
  languageServerDefault: 'Default ({language})',
});

type OptionType = {
  value: string;
  label: string;
  isFixed?: boolean;
};

const selectStyles = {
  multiValueLabel: (base: CSSObjectWithLabel, props: { data: OptionType }) => {
    return props.data?.isFixed ? { ...base, paddingRight: 6 } : base;
  },
  multiValueRemove: (base: CSSObjectWithLabel, props: { data: OptionType }) => {
    return props.data?.isFixed ? { ...base, display: 'none' } : base;
  },
};

interface LanguageSelectorProps {
  value?: string;
  setFieldValue: (property: string, value: string) => void;
  serverValue?: string;
  isUserSettings?: boolean;
  isDisabled?: boolean;
}

const LanguageSelector = ({
  value,
  setFieldValue,
  serverValue,
  isUserSettings = false,
  isDisabled,
}: LanguageSelectorProps) => {
  const intl = useIntl();
  const { data: languages } = useSWR<Language[]>('/api/v1/languages');

  const sortedLanguages = useMemo(() => {
    languages?.forEach((language) => {
      language.name =
        intl.formatDisplayName(language.iso_639_1, {
          type: 'language',
          fallback: 'none',
        }) ?? language.english_name;
    });

    return sortBy(languages, 'name');
  }, [intl, languages]);

  const languageName = (languageCode: string) =>
    sortedLanguages?.find((language) => language.iso_639_1 === languageCode)
      ?.name ?? languageCode;

  const options: OptionType[] =
    sortedLanguages?.map((language) => ({
      label: language.name,
      value: language.iso_639_1,
    })) ?? [];

  if (isUserSettings) {
    options.unshift({
      value: 'server',
      label: intl.formatMessage(messages.languageServerDefault, {
        language: serverValue
          ? serverValue
              .split('|')
              .map((value) => languageName(value))
              .reduce((prev, curr) =>
                intl.formatMessage(globalMessages.delimitedlist, {
                  a: prev,
                  b: curr,
                })
              )
          : intl.formatMessage(messages.originalLanguageDefault),
      }),
      isFixed: true,
    });
  }

  options.unshift({
    value: 'all',
    label: intl.formatMessage(messages.originalLanguageDefault),
    isFixed: true,
  });

  return (
    <Select<OptionType, true>
      options={options}
      isMulti
      isDisabled={isDisabled}
      className="react-select-container"
      classNamePrefix="react-select"
      value={
        (isUserSettings && value === 'all') || (!isUserSettings && !value)
          ? {
              value: 'all',
              label: intl.formatMessage(messages.originalLanguageDefault),
              isFixed: true,
            }
          : (value === '' || !value || value === 'server') && isUserSettings
          ? {
              value: 'server',
              label: intl.formatMessage(messages.languageServerDefault, {
                language: serverValue
                  ? serverValue
                      .split('|')
                      .map((value) => languageName(value))
                      .reduce((prev, curr) =>
                        intl.formatMessage(globalMessages.delimitedlist, {
                          a: prev,
                          b: curr,
                        })
                      )
                  : intl.formatMessage(messages.originalLanguageDefault),
              }),
              isFixed: true,
            }
          : (value
              ?.split('|')
              .map((code) => {
                const matchedLanguage = sortedLanguages?.find(
                  (lang) => lang.iso_639_1 === code
                );

                if (!matchedLanguage) {
                  return undefined;
                }

                return {
                  label: matchedLanguage.name,
                  value: matchedLanguage.iso_639_1,
                };
              })
              .filter((option) => option !== undefined) as OptionType[])
      }
      onChange={(value, options) => {
        if (
          (options &&
            options.action === 'select-option' &&
            options.option?.value === 'server') ||
          value.every((v) => v.value === 'server')
        ) {
          return setFieldValue('originalLanguage', '');
        }

        if (
          (options &&
            options.action === 'select-option' &&
            options.option?.value === 'all') ||
          value.every((v) => v.value === 'all')
        ) {
          return setFieldValue('originalLanguage', isUserSettings ? 'all' : '');
        }

        setFieldValue(
          'originalLanguage',
          value
            .map((lang) => lang.value)
            .filter((v) => v !== 'all')
            .join('|')
        );
      }}
      styles={selectStyles}
    />
  );
};

export default LanguageSelector;
