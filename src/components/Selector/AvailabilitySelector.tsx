import defineMessages from '@app/utils/defineMessages';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { DiscoverAvailabilityFilter } from '@server/constants/discover';
import React from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Selector.AvailabilitySelector', {
  all: 'Show All',
  availableOrRequested: 'Show Available and Requested only',
  notAvailableOrRequested: 'Hide Available and Requested',
});

interface AvailabilitySelectorProps {
  value?: DiscoverAvailabilityFilter;
  onChange: (value: DiscoverAvailabilityFilter) => void;
}

const AvailabilitySelector: React.FC<AvailabilitySelectorProps> = ({
  value = DiscoverAvailabilityFilter.ALL,
  onChange,
}) => {
  const intl = useIntl();

  const options = [
    {
      label: intl.formatMessage(messages.all),
      value: DiscoverAvailabilityFilter.ALL,
    },
    {
      label: intl.formatMessage(messages.availableOrRequested),
      value: DiscoverAvailabilityFilter.AVAILABLE_OR_REQUESTED,
    },
    {
      label: intl.formatMessage(messages.notAvailableOrRequested),
      value: DiscoverAvailabilityFilter.NOT_AVAILABLE_OR_REQUESTED,
    },
  ];

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="w-full">
      <Listbox
        value={selectedOption}
        onChange={(option) => onChange(option.value)}
      >
        {({ open }) => (
          <div className="relative">
            <span className="inline-block w-full rounded-md shadow-sm">
              <Listbox.Button className="focus:shadow-outline-blue relative flex w-full cursor-default items-center rounded-md border border-gray-500 bg-gray-700 py-2 pl-3 pr-10 text-left text-white transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none sm:text-sm sm:leading-5">
                <span className="block truncate">{selectedOption.label}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
                  <ChevronDownIcon className="h-5 w-5" />
                </span>
              </Listbox.Button>
            </span>
            <Transition
              show={open}
              leave="transition-opacity ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              className="absolute z-50 mt-1 w-full rounded-md bg-gray-800 shadow-lg"
            >
              <Listbox.Options
                static
                className="shadow-xs max-h-60 overflow-auto rounded-md py-1 text-base leading-6 focus:outline-none sm:text-sm sm:leading-5"
              >
                {options.map((option) => (
                  <Listbox.Option key={option.value} value={option}>
                    {({ selected, active }) => (
                      <div
                        className={`${
                          active ? 'bg-indigo-600 text-white' : 'text-gray-300'
                        } relative cursor-default select-none py-2 pl-8 pr-4`}
                      >
                        <span
                          className={`${selected ? 'font-semibold' : 'font-normal'} block truncate`}
                        >
                          {option.label}
                        </span>
                        {selected && (
                          <span
                            className={`${
                              active ? 'text-white' : 'text-indigo-600'
                            } absolute inset-y-0 left-0 flex items-center pl-1.5`}
                          >
                            <CheckIcon className="h-5 w-5" />
                          </span>
                        )}
                      </div>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        )}
      </Listbox>
    </div>
  );
};

export default AvailabilitySelector;
