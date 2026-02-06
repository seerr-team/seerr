import defineMessages from '@app/utils/defineMessages';
import { Listbox, Transition } from '@headlessui/react';
import * as Icons from '@heroicons/react/24/outline';
import { TrashIcon } from '@heroicons/react/24/outline';
import type { CustomMovieLink } from '@server/interfaces/api/settingsInterfaces';
import { Field } from 'formik';
import React from 'react';
import { useIntl } from 'react-intl';

interface CustomMovieLinkInputProps {
  data: CustomMovieLink;
  onChange: (data: CustomMovieLink) => void;
  onDelete: () => void;
  className?: string;
}

const messages = defineMessages('components.Settings', {
  customMovieLinkUrl: 'Link URL',
  customMovieLinkText: 'Link Text',
  customMovieLinkIcon: 'Link Icon',
});

interface IconDesc {
  id: string;
  elem: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
}

const allIcons: IconDesc[] = Object.entries(Icons)
  .filter(([key]) => {
    return key.endsWith('Icon');
  })
  .map(([key, Icon]) => ({
    id: key,
    elem: Icon,
  }));

function LinkIconSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const iconId = value || 'LinkIcon';
  const [selectedIcon, setSelectedIcon] = React.useState(
    allIcons.find((icon) => icon.id === iconId)
  );

  return (
    <Listbox
      as="div"
      className="relative"
      onChange={(value) => {
        setSelectedIcon(allIcons.find((icon) => icon.id === value));
        onChange(value);
      }}
    >
      {({ open }) => (
        <>
          <Listbox.Button className="form-input-field flex items-center justify-between">
            <button
              type="button"
              className="input-action !rounded-r-none !rounded-l-md !border-r-0 !border-gray-500 !bg-gray-700"
            >
              {selectedIcon ? <selectedIcon.elem className="h-5 w-5" /> : <></>}
            </button>
          </Listbox.Button>
          <Transition
            show={open}
            as={React.Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {allIcons.map((icon) => (
                <Listbox.Option
                  key={icon.id}
                  value={icon.id}
                  className={({ active }) =>
                    `relative cursor-pointer select-none p-3 py-1 text-white ${
                      active ? 'bg-indigo-600' : ''
                    }`
                  }
                >
                  {<icon.elem />}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </>
      )}
    </Listbox>
  );
}

function CustomMovieLinkInput({
  data,
  onChange,
  onDelete,
  className,
}: CustomMovieLinkInputProps) {
  const intl = useIntl();

  return (
    <div className={'form-input-field ' + (className || '')}>
      <LinkIconSelector
        value={data.icon}
        onChange={(value) => {
          onChange({
            ...data,
            icon: value,
          });
        }}
      />

      <Field
        type="text"
        value={data.text}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange({
            ...data,
            text: e.target.value,
          });
        }}
        placeholder={intl.formatMessage(messages.customMovieLinkText)}
        className="form-input-field rounded-l-only !rounded-none !border-r-0"
      />
      <Field
        type="text"
        value={data.url}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange({
            ...data,
            url: e.target.value,
          });
        }}
        placeholder={intl.formatMessage(messages.customMovieLinkUrl)}
        className="form-input-field flex-grow !rounded-none"
      />
      <button type="button" className="input-action" onClick={onDelete}>
        <TrashIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export default CustomMovieLinkInput;
export type { CustomMovieLinkInputProps };
