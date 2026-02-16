import useSettings from '@app/hooks/useSettings';
import defineMessages from '@app/utils/defineMessages';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import type { Region } from '@server/lib/settings';
import { countries } from 'country-flag-icons';
import 'country-flag-icons/3x2/flags.css';
import { sortBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.RegionSelector', {
  regionDefault: 'All Regions',
  regionServerDefault: 'Default',
  regionsSelected: '{count, plural, one {Region} other {Regions}} Selected',
});

interface RegionSelectorProps {
  value: string;
  name: string;
  isUserSetting?: boolean;
  disableAll?: boolean;
  watchProviders?: boolean;
  regionType?: 'discover' | 'streaming';
  onChange?: (fieldName: string, region: string) => void;
}

const RegionSelector = ({
  name,
  value,
  isUserSetting = false,
  disableAll = false,
  watchProviders = false,
  regionType = 'discover',
  onChange,
}: RegionSelectorProps) => {
  const { currentSettings } = useSettings();
  const intl = useIntl();
  const { data: regions } = useSWR<Region[]>(
    watchProviders ? '/api/v1/watchproviders/regions' : '/api/v1/regions'
  );
  const [selectedRegionsList, setSelectedRegionsList] = useState<Region[]>([]);

  const allRegion: Region = useMemo(
    () => ({
      iso_3166_1: 'all',
      english_name: 'All',
    }),
    []
  );

  const defaultRegion: Region = useMemo(
    () => ({
      iso_3166_1: 'default',
      english_name: 'Default',
    }),
    []
  );

  const sortedRegions = useMemo(() => {
    regions?.forEach((region) => {
      region.name =
        intl.formatDisplayName(region.iso_3166_1, {
          type: 'region',
          fallback: 'none',
        }) ?? region.english_name;
    });

    return sortBy(regions, 'name');
  }, [intl, regions]);

  const regionName = (regionCode: string) =>
    sortedRegions?.find((region) => region.iso_3166_1 === regionCode)?.name ??
    regionCode;

  const regionValue =
    regionType === 'discover'
      ? currentSettings.discoverRegion
      : currentSettings.streamingRegion;

  useEffect(() => {
    if (regions && value) {
      if (value === 'all') {
        setSelectedRegionsList([allRegion]);
      } else if (value === '' && isUserSetting) {
        setSelectedRegionsList([defaultRegion]);
      } else {
        const regionCodes = value.split('|');
        const matchedRegions = regions.filter((region) =>
          regionCodes.includes(region.iso_3166_1)
        );
        setSelectedRegionsList(matchedRegions);
      }
    } else if (isUserSetting && value === '') {
      setSelectedRegionsList([defaultRegion]);
    }
  }, [value, regions, allRegion, isUserSetting, defaultRegion]);

  const handleChange = (newSelectedRegions: Region[]) => {
    // Check if we are selecting/deselecting "All" or "Default"
    const isAllSelected = newSelectedRegions.find(
      (r) => r.iso_3166_1 === 'all'
    );
    const wasAllSelected = selectedRegionsList.find(
      (r) => r.iso_3166_1 === 'all'
    );
    const isDefaultSelected = newSelectedRegions.find(
      (r) => r.iso_3166_1 === 'default'
    );
    const wasDefaultSelected = selectedRegionsList.find(
      (r) => r.iso_3166_1 === 'default'
    );

    let finalSelection = newSelectedRegions;

    if (isAllSelected && !wasAllSelected) {
      // If "All" was just selected, clear everything else
      finalSelection = [allRegion];
    } else if (isDefaultSelected && !wasDefaultSelected) {
      // If "Default" was just selected, clear everything else
      finalSelection = [defaultRegion];
    } else if (
      (wasAllSelected && newSelectedRegions.length > 1) ||
      (wasDefaultSelected && newSelectedRegions.length > 1)
    ) {
      // If "All" or "Default" was selected and we selected something else, remove "All"/"Default"
      finalSelection = newSelectedRegions.filter(
        (r) => r.iso_3166_1 !== 'all' && r.iso_3166_1 !== 'default'
      );
    } else if (newSelectedRegions.length === 0 && !disableAll) {
      // If everything deselected, fallback to All (or Default if user setting)
      finalSelection = isUserSetting ? [defaultRegion] : [allRegion];
    }

    setSelectedRegionsList(finalSelection);

    if (onChange) {
      const isNowAll = finalSelection.find((r) => r.iso_3166_1 === 'all');
      const isNowDefault = finalSelection.find(
        (r) => r.iso_3166_1 === 'default'
      );

      if (isNowAll) {
        onChange(name, 'all');
      } else if (isNowDefault) {
        onChange(name, '');
      } else {
        onChange(name, finalSelection.map((r) => r.iso_3166_1).join('|'));
      }
    }
  };

  const isRegionSelected = (regionCode: string) => {
    return selectedRegionsList.some((r) => r.iso_3166_1 === regionCode);
  };

  return (
    <div className="z-40 w-full">
      <Listbox
        as="div"
        value={selectedRegionsList}
        onChange={handleChange}
        multiple
      >
        {({ open }) => (
          <div className="relative">
            <span className="inline-block w-full rounded-md shadow-sm">
              <Listbox.Button className="focus:shadow-outline-blue relative flex w-full cursor-default items-center rounded-md border border-gray-500 bg-gray-700 py-2 pl-3 pr-10 text-left text-white transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none sm:text-sm sm:leading-5">
                {selectedRegionsList.length === 1 &&
                  selectedRegionsList[0].iso_3166_1 !== 'all' &&
                  selectedRegionsList[0].iso_3166_1 !== 'default' &&
                  countries.includes(selectedRegionsList[0].iso_3166_1) && (
                    <span className="mr-2 h-4 overflow-hidden text-base leading-4">
                      <span
                        className={`flag:${selectedRegionsList[0].iso_3166_1}`}
                      />
                    </span>
                  )}
                {selectedRegionsList.length === 1 &&
                  selectedRegionsList[0].iso_3166_1 === 'default' &&
                  regions &&
                  regionValue &&
                  countries.includes(regionValue) && (
                    <span className="mr-2 h-4 overflow-hidden text-base leading-4">
                      <span className={`flag:${regionValue}`} />
                    </span>
                  )}
                <span className="block truncate">
                  {selectedRegionsList.length > 1
                    ? selectedRegionsList.map((region, index) => {
                        const isLast = index === selectedRegionsList.length - 1;
                        if (index > 1) return null; // Only show first 2
                        if (index === 1 && selectedRegionsList.length > 2) {
                          return (
                            <span key="more">
                              {' '}
                              + {selectedRegionsList.length - 1} more
                            </span>
                          );
                        }
                        return (
                          <span key={region.iso_3166_1} className="mr-2">
                            {countries.includes(region.iso_3166_1) && (
                              <span
                                className={`flag:${region.iso_3166_1} mr-1 inline-block h-3 align-middle`}
                              />
                            )}
                            {regionName(region.iso_3166_1)}
                            {!isLast && selectedRegionsList.length <= 2 && ','}
                          </span>
                        );
                      })
                    : selectedRegionsList.length === 1
                    ? selectedRegionsList[0].iso_3166_1 === 'all'
                      ? intl.formatMessage(messages.regionDefault)
                      : selectedRegionsList[0].iso_3166_1 === 'default'
                      ? `${intl.formatMessage(messages.regionServerDefault)}${
                          regionValue && regionName(regionValue)
                            ? ` (${regionName(regionValue)})`
                            : ''
                        }`
                      : regionName(selectedRegionsList[0].iso_3166_1)
                    : intl.formatMessage(messages.regionDefault)}
                </span>
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
              className="absolute mt-1 w-full rounded-md bg-gray-800 shadow-lg"
            >
              <Listbox.Options
                static
                className="shadow-xs max-h-60 overflow-auto rounded-md py-1 text-base leading-6 focus:outline-none sm:text-sm sm:leading-5"
              >
                {isUserSetting && (
                  <Listbox.Option value={defaultRegion}>
                    {({ active }) => (
                      <div
                        className={`${
                          active ? 'bg-indigo-600 text-white' : 'text-gray-300'
                        } relative flex cursor-default select-none items-center py-2 pl-8 pr-4`}
                      >
                        <span className="mr-2 text-base">
                          <span
                            className={
                              countries.includes(regionValue)
                                ? `flag:${regionValue}`
                                : 'pr-6'
                            }
                          />
                        </span>
                        <span
                          className={`${
                            isRegionSelected('default')
                              ? 'font-semibold'
                              : 'font-normal'
                          } block truncate`}
                        >
                          {intl.formatMessage(messages.regionServerDefault)}
                          {regionValue && regionName(regionValue)
                            ? ` (${regionName(regionValue)})`
                            : ''}
                        </span>
                        {isRegionSelected('default') && (
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
                )}
                {!disableAll && (
                  <Listbox.Option value={allRegion}>
                    {({ active }) => (
                      <div
                        className={`${
                          active ? 'bg-indigo-600 text-white' : 'text-gray-300'
                        } relative cursor-default select-none py-2 pl-8 pr-4`}
                      >
                        <span
                          className={`${
                            isRegionSelected('all')
                              ? 'font-semibold'
                              : 'font-normal'
                          } block truncate pl-8`}
                        >
                          {intl.formatMessage(messages.regionDefault)}
                        </span>
                        {isRegionSelected('all') && (
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
                )}
                {sortedRegions?.map((region) => (
                  <Listbox.Option key={region.iso_3166_1} value={region}>
                    {({ active }) => (
                      <div
                        className={`${
                          active ? 'bg-indigo-600 text-white' : 'text-gray-300'
                        } relative flex cursor-default select-none items-center py-2 pl-8 pr-4`}
                      >
                        <span className="mr-2 text-base">
                          <span
                            className={
                              countries.includes(region.iso_3166_1)
                                ? `flag:${region.iso_3166_1}`
                                : 'pr-6'
                            }
                          />
                        </span>
                        <span
                          className={`${
                            isRegionSelected(region.iso_3166_1)
                              ? 'font-semibold'
                              : 'font-normal'
                          } block truncate`}
                        >
                          {regionName(region.iso_3166_1)}
                        </span>
                        {isRegionSelected(region.iso_3166_1) && (
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

export default RegionSelector;
