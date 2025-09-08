import { availableLanguages } from '@app/context/LanguageContext';
import useClickOutside from '@app/hooks/useClickOutside';
import useLocale from '@app/hooks/useLocale';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { LanguageIcon } from '@heroicons/react/24/solid';
import type { AvailableLocale } from '@server/types/languages';
import { useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Layout.LanguagePicker', {
  displaylanguage: 'Display Language',
});

const LanguagePicker = () => {
  const intl = useIntl();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { locale, setLocale } = useLocale();
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  useClickOutside(dropdownRef, () => setDropdownOpen(false));

  return (
    <div className="relative">
      <div>
        <button
          className={`rounded-full p-1 hover:bg-gray-600 hover:text-white focus:bg-gray-600 focus:text-white focus:outline-none focus:ring-1 focus:ring-gray-500 sm:p-2 ${
            isDropdownOpen ? 'bg-gray-600 text-white' : 'text-gray-400'
          }`}
          aria-label="Language Picker"
          onClick={() => setDropdownOpen(true)}
        >
          <LanguageIcon className="h-6 w-6" />
        </button>
      </div>
      <Transition
        as="div"
        show={isDropdownOpen}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <div
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-md shadow-lg"
          ref={dropdownRef}
        >
          <div className="rounded-md bg-gray-700 px-3 py-2 ring-1 ring-black ring-opacity-5">
            <div>
              <label
                htmlFor="language"
                className="block pb-2 text-sm font-bold leading-5 text-gray-300"
              >
                {intl.formatMessage(messages.displaylanguage)}
              </label>
              <select
                id="language"
                className="rounded-md"
                onChange={(e) =>
                  setLocale && setLocale(e.target.value as AvailableLocale)
                }
                onBlur={(e) =>
                  setLocale && setLocale(e.target.value as AvailableLocale)
                }
                defaultValue={locale}
              >
                {(
                  Object.keys(
                    availableLanguages
                  ) as (keyof typeof availableLanguages)[]
                ).map((key) => (
                  <option key={key} value={availableLanguages[key].code}>
                    {availableLanguages[key].display}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  );
};

export default LanguagePicker;
