import Button from '@app/components/Common/Button';
import MultiRangeSlider from '@app/components/Common/MultiRangeSlider';
import SlideOver from '@app/components/Common/SlideOver';
import Toggle from '@app/components/Common/Toggle';
import type { FilterOptions } from '@app/components/Discover/constants';
import { countActiveFilters } from '@app/components/Discover/constants';
import LanguageSelector from '@app/components/LanguageSelector';
import {
  CompanySelector,
  GenreSelector,
  KeywordSelector,
  StatusSelector,
  USCertificationSelector,
  WatchProviderSelector,
} from '@app/components/Selector';
import useSettings from '@app/hooks/useSettings';
import {
  useBatchUpdateQueryParams,
  useUpdateQueryParams,
} from '@app/hooks/useUpdateQueryParams';
import defineMessages from '@app/utils/defineMessages';
import { XCircleIcon } from '@heroicons/react/24/outline';
import Datepicker from '@seerr-team/react-tailwindcss-datepicker';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import type { MultiValue } from 'react-select';
import AsyncSelect from 'react-select/async';

const messages = defineMessages('components.Discover.FilterSlideover', {
  filters: 'Filters',
  activefilters:
    '{count, plural, one {# Active Filter} other {# Active Filters}}',
  releaseDate: 'Release Date',
  firstAirDate: 'First Air Date',
  from: 'From',
  to: 'To',
  studio: 'Studio',
  genres: 'Genres',
  keywords: 'Keywords',
  excludeKeywords: 'Exclude Keywords',
  originalLanguage: 'Original Language',
  runtimeText: '{minValue}-{maxValue} minute runtime',
  ratingText: 'Ratings between {minValue} and {maxValue}',
  clearfilters: 'Clear Active Filters',
  tmdbuserscore: 'TMDB User Score',
  tmdbuservotecount: 'TMDB User Vote Count',
  runtime: 'Runtime',
  streamingservices: 'Streaming Services',
  voteCount: 'Number of votes between {minValue} and {maxValue}',
  status: 'Status',
  certification: 'Content Rating',
  onlyWithCoverArt: 'Only show releases with cover art',
  releaseType: 'Release Type',
});

type FilterSlideoverProps = {
  show: boolean;
  onClose: () => void;
  type: 'movie' | 'tv' | 'music';
  currentFilters: FilterOptions;
};

const FilterSlideover = ({
  show,
  onClose,
  type,
  currentFilters,
}: FilterSlideoverProps) => {
  const intl = useIntl();
  const { currentSettings } = useSettings();
  const updateQueryParams = useUpdateQueryParams({});
  const batchUpdateQueryParams = useBatchUpdateQueryParams({});
  const [defaultSelectedGenres, setDefaultSelectedGenres] = useState<
    { label: string; value: string }[] | null
  >(null);
  const [defaultSelectedReleaseTypes, setDefaultSelectedReleaseTypes] =
    useState<{ label: string; value: string }[] | null>(null);

  const dateGte =
    type === 'movie' ? 'primaryReleaseDateGte' : 'firstAirDateGte';
  const dateLte =
    type === 'movie' ? 'primaryReleaseDateLte' : 'firstAirDateLte';

  useEffect(() => {
    if (type === 'music' && currentFilters.genre) {
      const genres = currentFilters.genre.split(',');

      setDefaultSelectedGenres(
        genres.map((genre) => ({
          label: genre,
          value: genre,
        }))
      );
    } else {
      setDefaultSelectedGenres(null);
    }

    if (type === 'music' && currentFilters.releaseType) {
      const releaseTypes = currentFilters.releaseType.split(',');

      setDefaultSelectedReleaseTypes(
        releaseTypes.map((rt) => ({
          label: rt,
          value: rt,
        }))
      );
    } else {
      setDefaultSelectedReleaseTypes(null);
    }
  }, [type, currentFilters.genre, currentFilters.releaseType]);

  const musicReleaseTypeOptions = [
    { label: 'Album', value: 'Album' },
    { label: 'EP', value: 'EP' },
    { label: 'Single', value: 'Single' },
    { label: 'Soundtrack', value: 'Soundtrack' },
    { label: 'Remix', value: 'Remix' },
    { label: 'Live', value: 'Live' },
    { label: 'Demo', value: 'Demo' },
    { label: 'DJ-mix', value: 'DJ-mix' },
    { label: 'Compilation', value: 'Compilation' },
    { label: 'Audio drama', value: 'Audio drama' },
    { label: 'Mixtape/Street', value: 'Mixtape/Street' },
    { label: 'Field recording', value: 'Field recording' },
    { label: 'Other', value: 'Other' },
  ];

  const loadMusicReleaseTypeOptions = async (inputValue: string) => {
    return musicReleaseTypeOptions.filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  const musicGenreTagOptions = [
    { label: 'Rock', value: 'rock' },
    { label: 'Pop', value: 'pop' },
    { label: 'Electronic', value: 'electronic' },
    { label: 'Hip Hop', value: 'hip hop' },
    { label: 'Metal', value: 'metal' },
    { label: 'Jazz', value: 'jazz' },
    { label: 'Classical', value: 'classical' },
    { label: 'Punk', value: 'punk' },
    { label: 'Folk', value: 'folk' },
    { label: 'Country', value: 'country' },
    { label: 'Blues', value: 'blues' },
    { label: 'R&B', value: 'r&b' },
    { label: 'Soul', value: 'soul' },
    { label: 'Reggae', value: 'reggae' },
    { label: 'Latin', value: 'latin' },
    { label: 'Indie', value: 'indie' },
    { label: 'Alternative', value: 'alternative' },
    { label: 'Experimental', value: 'experimental' },
    { label: 'Ambient', value: 'ambient' },
    { label: 'Dance', value: 'dance' },
    { label: 'Funk', value: 'funk' },
    { label: 'Singer-Songwriter', value: 'singer-songwriter' },
    { label: 'World', value: 'world' },
    { label: 'Industrial', value: 'industrial' },
    { label: 'New Wave', value: 'new wave' },
    { label: 'Soundtrack', value: 'soundtrack' },
    { label: 'Heavy Metal', value: 'heavy metal' },
    { label: 'Hard Rock', value: 'hard rock' },
    { label: 'Progressive Rock', value: 'progressive rock' },
    { label: 'Grunge', value: 'grunge' },
  ];

  const loadMusicGenreTagOptions = async (inputValue: string) => {
    return musicGenreTagOptions.filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  if (type === 'music') {
    return (
      <SlideOver
        show={show}
        title={intl.formatMessage(messages.filters)}
        subText={intl.formatMessage(messages.activefilters, {
          count: countActiveFilters(currentFilters),
        })}
        onClose={() => onClose()}
      >
        <div>
          <div className="mb-2 text-lg font-semibold">
            {intl.formatMessage(messages.releaseDate)}
          </div>
          <div className="relative z-40 flex space-x-2">
            <div className="flex flex-col">
              <div className="mb-2">{intl.formatMessage(messages.from)}</div>
              <Datepicker
                primaryColor="indigo"
                value={{
                  startDate: currentFilters.releaseDateGte ?? null,
                  endDate: currentFilters.releaseDateGte ?? null,
                }}
                onChange={(value) => {
                  let formattedDate: string | undefined = undefined;
                  if (value?.startDate) {
                    try {
                      const date = new Date(value.startDate as string);
                      if (!isNaN(date.getTime())) {
                        formattedDate = date.toISOString().split('T')[0];
                      }
                    } catch (e) {
                      // Invalid date, use undefined
                    }
                  }
                  updateQueryParams('releaseDateGte', formattedDate);
                }}
                inputName="fromdate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
                displayFormat="YYYY-MM-DD"
              />
            </div>
            <div className="flex flex-col">
              <div className="mb-2">{intl.formatMessage(messages.to)}</div>
              <Datepicker
                primaryColor="indigo"
                value={{
                  startDate: currentFilters.releaseDateLte ?? null,
                  endDate: currentFilters.releaseDateLte ?? null,
                }}
                onChange={(value) => {
                  let formattedDate: string | undefined = undefined;
                  if (value?.startDate) {
                    try {
                      const date = new Date(value.startDate as string);
                      if (!isNaN(date.getTime())) {
                        formattedDate = date.toISOString().split('T')[0];
                      }
                    } catch (e) {
                      // Invalid date, use undefined
                    }
                  }
                  updateQueryParams('releaseDateLte', formattedDate);
                }}
                inputName="todate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
                displayFormat="YYYY-MM-DD"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col space-y-4">
          <span className="text-lg font-semibold">
            {intl.formatMessage(messages.releaseType)}
          </span>
          <AsyncSelect
            key={`music-release-type-select-${defaultSelectedReleaseTypes}`}
            className="react-select-container"
            classNamePrefix="react-select"
            defaultValue={defaultSelectedReleaseTypes}
            defaultOptions={musicReleaseTypeOptions}
            isMulti
            cacheOptions
            loadOptions={loadMusicReleaseTypeOptions}
            placeholder={intl.formatMessage(messages.releaseType)}
            onChange={(value: MultiValue<{ label: string; value: string }>) => {
              updateQueryParams(
                'releaseType',
                value?.length ? value.map((v) => v.value).join(',') : undefined
              );
            }}
          />

          <span className="text-lg font-semibold">
            {intl.formatMessage(messages.genres)}
          </span>
          <AsyncSelect
            key={`music-genre-select-${defaultSelectedGenres}`}
            className="react-select-container"
            classNamePrefix="react-select"
            defaultValue={defaultSelectedGenres}
            defaultOptions={musicGenreTagOptions}
            isMulti
            cacheOptions
            loadOptions={loadMusicGenreTagOptions}
            placeholder={intl.formatMessage(messages.genres)}
            onChange={(value: MultiValue<{ label: string; value: string }>) => {
              updateQueryParams(
                'genre',
                value?.length ? value.map((v) => v.value).join(',') : undefined
              );
            }}
          />

          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-semibold">
              {intl.formatMessage(messages.onlyWithCoverArt)}
            </span>
            <Toggle
              checked={currentFilters.onlyWithCoverArt === 'true'}
              onChange={(checked) => {
                const newValue = checked ? 'true' : undefined;
                updateQueryParams('onlyWithCoverArt', newValue);
              }}
            />
          </div>
          <div className="pt-4">
            <Button
              className="w-full"
              disabled={Object.keys(currentFilters).length === 0}
              onClick={() => {
                const copyCurrent = Object.assign({}, currentFilters);
                (
                  Object.keys(copyCurrent) as (keyof typeof currentFilters)[]
                ).forEach((k) => {
                  copyCurrent[k] = undefined;
                });
                batchUpdateQueryParams(copyCurrent);
                onClose();
              }}
            >
              <XCircleIcon />
              <span>{intl.formatMessage(messages.clearfilters)}</span>
            </Button>
          </div>
        </div>
      </SlideOver>
    );
  }

  return (
    <SlideOver
      show={show}
      title={intl.formatMessage(messages.filters)}
      subText={intl.formatMessage(messages.activefilters, {
        count: countActiveFilters(currentFilters),
      })}
      onClose={() => onClose()}
    >
      <div className="flex flex-col space-y-4">
        <div>
          <div className="mb-2 text-lg font-semibold">
            {intl.formatMessage(
              type === 'movie' ? messages.releaseDate : messages.firstAirDate
            )}
          </div>
          <div className="relative z-40 flex space-x-2">
            <div className="flex flex-col">
              <div className="mb-2">{intl.formatMessage(messages.from)}</div>
              <Datepicker
                primaryColor="indigo"
                value={{
                  startDate: currentFilters[dateGte] ?? null,
                  endDate: currentFilters[dateGte] ?? null,
                }}
                onChange={(value) => {
                  // Format the date as YYYY-MM-DD before setting it
                  let formattedDate: string | undefined = undefined;
                  if (value?.startDate) {
                    try {
                      const date = new Date(value.startDate as string);
                      if (!isNaN(date.getTime())) {
                        formattedDate = date.toISOString().split('T')[0];
                      }
                    } catch (e) {
                      // Invalid date, use undefined
                    }
                  }
                  updateQueryParams(dateGte, formattedDate);
                }}
                inputName="fromdate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
                displayFormat="YYYY-MM-DD" // Add this to enforce the correct format
              />
            </div>
            <div className="flex flex-col">
              <div className="mb-2">{intl.formatMessage(messages.to)}</div>
              <Datepicker
                primaryColor="indigo"
                value={{
                  startDate: currentFilters[dateLte] ?? null,
                  endDate: currentFilters[dateLte] ?? null,
                }}
                onChange={(value) => {
                  let formattedDate: string | undefined = undefined;
                  if (value?.startDate) {
                    try {
                      const date = new Date(value.startDate as string);
                      if (!isNaN(date.getTime())) {
                        formattedDate = date.toISOString().split('T')[0];
                      }
                    } catch (e) {
                      // Invalid date, use undefined
                    }
                  }
                  updateQueryParams(dateLte, formattedDate);
                }}
                inputName="todate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
                displayFormat="YYYY-MM-DD" // Add this to enforce the correct format
              />
            </div>
          </div>
        </div>
        {type === 'movie' && (
          <>
            <span className="text-lg font-semibold">
              {intl.formatMessage(messages.studio)}
            </span>
            <CompanySelector
              defaultValue={currentFilters.studio}
              onChange={(value) => {
                updateQueryParams('studio', value?.value.toString());
              }}
            />
          </>
        )}
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.genres)}
        </span>
        <GenreSelector
          type={type}
          defaultValue={currentFilters.genre}
          isMulti
          onChange={(value) => {
            updateQueryParams('genre', value?.map((v) => v.value).join(','));
          }}
        />
        {type === 'tv' && (
          <>
            <span className="text-lg font-semibold">
              {intl.formatMessage(messages.status)}
            </span>
            <StatusSelector
              defaultValue={currentFilters.status}
              isMulti
              onChange={(value) => {
                updateQueryParams(
                  'status',
                  value?.map((v) => v.value).join('|')
                );
              }}
            />
          </>
        )}
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.keywords)}
        </span>
        <KeywordSelector
          defaultValue={currentFilters.keywords}
          isMulti
          onChange={(value) => {
            updateQueryParams('keywords', value?.map((v) => v.value).join(','));
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.excludeKeywords)}
        </span>
        <KeywordSelector
          defaultValue={currentFilters.excludeKeywords}
          isMulti
          onChange={(value) => {
            updateQueryParams(
              'excludeKeywords',
              value?.map((v) => v.value).join(',')
            );
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.originalLanguage)}
        </span>
        <LanguageSelector
          value={currentFilters.language}
          serverValue={currentSettings.originalLanguage}
          isUserSettings
          setFieldValue={(_key, value) => {
            updateQueryParams('language', value);
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.certification)}
        </span>
        <USCertificationSelector
          type={type}
          certification={currentFilters.certification}
          onChange={(params) => {
            batchUpdateQueryParams(params);
          }}
        />
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.runtime)}
        </span>
        <div className="relative z-0">
          <MultiRangeSlider
            min={0}
            max={400}
            onUpdateMin={(min) => {
              updateQueryParams(
                'withRuntimeGte',
                min !== 0 && Number(currentFilters.withRuntimeLte) !== 400
                  ? min.toString()
                  : undefined
              );
            }}
            onUpdateMax={(max) => {
              updateQueryParams(
                'withRuntimeLte',
                max !== 400 && Number(currentFilters.withRuntimeGte) !== 0
                  ? max.toString()
                  : undefined
              );
            }}
            defaultMaxValue={
              currentFilters.withRuntimeLte
                ? Number(currentFilters.withRuntimeLte)
                : undefined
            }
            defaultMinValue={
              currentFilters.withRuntimeGte
                ? Number(currentFilters.withRuntimeGte)
                : undefined
            }
            subText={intl.formatMessage(messages.runtimeText, {
              minValue: currentFilters.withRuntimeGte ?? 0,
              maxValue: currentFilters.withRuntimeLte ?? 400,
            })}
          />
        </div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.tmdbuserscore)}
        </span>
        <div className="relative z-0">
          <MultiRangeSlider
            min={1}
            max={10}
            defaultMaxValue={
              currentFilters.voteAverageLte
                ? Number(currentFilters.voteAverageLte)
                : undefined
            }
            defaultMinValue={
              currentFilters.voteAverageGte
                ? Number(currentFilters.voteAverageGte)
                : undefined
            }
            onUpdateMin={(min) => {
              updateQueryParams(
                'voteAverageGte',
                min !== 1 && Number(currentFilters.voteAverageLte) !== 10
                  ? min.toString()
                  : undefined
              );
            }}
            onUpdateMax={(max) => {
              updateQueryParams(
                'voteAverageLte',
                max !== 10 && Number(currentFilters.voteAverageGte) !== 1
                  ? max.toString()
                  : undefined
              );
            }}
            subText={intl.formatMessage(messages.ratingText, {
              minValue: currentFilters.voteAverageGte ?? 1,
              maxValue: currentFilters.voteAverageLte ?? 10,
            })}
          />
        </div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.tmdbuservotecount)}
        </span>
        <div className="relative z-0">
          <MultiRangeSlider
            min={0}
            max={1000}
            defaultMaxValue={
              currentFilters.voteCountLte
                ? Number(currentFilters.voteCountLte)
                : undefined
            }
            defaultMinValue={
              currentFilters.voteCountGte
                ? Number(currentFilters.voteCountGte)
                : undefined
            }
            onUpdateMin={(min) => {
              updateQueryParams(
                'voteCountGte',
                min !== 0 && Number(currentFilters.voteCountLte) !== 1000
                  ? min.toString()
                  : undefined
              );
            }}
            onUpdateMax={(max) => {
              updateQueryParams(
                'voteCountLte',
                max !== 1000 && Number(currentFilters.voteCountGte) !== 0
                  ? max.toString()
                  : undefined
              );
            }}
            subText={intl.formatMessage(messages.voteCount, {
              minValue: currentFilters.voteCountGte ?? 0,
              maxValue: currentFilters.voteCountLte ?? 1000,
            })}
          />
        </div>
        <span className="text-lg font-semibold">
          {intl.formatMessage(messages.streamingservices)}
        </span>
        <WatchProviderSelector
          type={type}
          region={currentFilters.watchRegion}
          activeProviders={
            currentFilters.watchProviders?.split('|').map((v) => Number(v)) ??
            []
          }
          onChange={(region, providers) => {
            if (providers.length) {
              batchUpdateQueryParams({
                watchRegion: region,
                watchProviders: providers.join('|'),
              });
            } else {
              batchUpdateQueryParams({
                watchRegion: undefined,
                watchProviders: undefined,
              });
            }
          }}
        />
        <div className="pt-4">
          <Button
            className="w-full"
            disabled={Object.keys(currentFilters).length === 0}
            onClick={() => {
              const copyCurrent = Object.assign({}, currentFilters);
              (
                Object.keys(copyCurrent) as (keyof typeof currentFilters)[]
              ).forEach((k) => {
                copyCurrent[k] = undefined;
              });
              batchUpdateQueryParams(copyCurrent);
              onClose();
            }}
          >
            <XCircleIcon />
            <span>{intl.formatMessage(messages.clearfilters)}</span>
          </Button>
        </div>
      </div>
    </SlideOver>
  );
};

export default FilterSlideover;
