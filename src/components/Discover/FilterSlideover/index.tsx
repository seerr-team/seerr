import Button from '@app/components/Common/Button';
import MultiRangeSlider from '@app/components/Common/MultiRangeSlider';
import SlideCheckbox from '@app/components/Common/SlideCheckbox';
import SlideOver from '@app/components/Common/SlideOver';
import type { FilterOptions } from '@app/components/Discover/constants';
import { countActiveFilters } from '@app/components/Discover/constants';
import LanguageSelector from '@app/components/LanguageSelector';
import {
  CompanySelector,
  CountrySelector,
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
import { FILTER_CAPABILITIES } from '@shared/discover/capabilities';
import type { DimensionKey } from '@shared/discover/types';
import { useState } from 'react';
import { useIntl } from 'react-intl';

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
  include: 'Included',
  exclude: 'Excluded',
  originalLanguage: 'Original Language',
  country: 'Production Country',
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
});

type FilterSlideoverProps = {
  show: boolean;
  onClose: () => void;
  type: 'movie' | 'tv';
  currentFilters: FilterOptions;
};

/**
 * Section heading with an optional slide switch to flip the section between
 * include and exclude mode. Reuses the existing SlideCheckbox so the affordance
 * matches the rest of the app rather than introducing a new control.
 *
 * Whether the toggle renders is driven by FILTER_CAPABILITIES: a dimension
 * whose data source cannot exclude (e.g. watch providers) shows a plain
 * heading with no toggle.
 */
const FilterSectionHeading = ({
  title,
  dimension,
  type,
  excludeMode,
  onToggleExclude,
}: {
  title: string;
  dimension: DimensionKey;
  type: 'movie' | 'tv';
  excludeMode: boolean;
  onToggleExclude: (next: boolean) => void;
}) => {
  const intl = useIntl();
  const canExclude = FILTER_CAPABILITIES[type][dimension].exclude;

  // Dimensions that cannot exclude render a plain heading — no toggle.
  if (!canExclude) {
    return <span className="mb-1.5 block text-lg font-semibold">{title}</span>;
  }

  return (
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-lg font-semibold">{title}</span>
      <span className="flex items-center gap-1.5 text-sm text-gray-400">
        <span className={excludeMode ? 'text-indigo-400' : undefined}>
          {intl.formatMessage(messages.exclude)}
        </span>
        <SlideCheckbox
          checked={!excludeMode}
          onClick={() => onToggleExclude(!excludeMode)}
        />
        <span className={!excludeMode ? 'text-indigo-400' : undefined}>
          {intl.formatMessage(messages.include)}
        </span>
      </span>
    </div>
  );
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

  // Per-section include/exclude mode. Initialised from the URL: if an exclude
  // param is present, the switch starts in exclude mode.
  const [studioExclude, setStudioExclude] = useState(
    !!currentFilters.excludeStudio
  );
  const [genreExclude, setGenreExclude] = useState(
    !!currentFilters.excludeGenres
  );
  const [statusExclude, setStatusExclude] = useState(
    !!currentFilters.excludeStatus
  );
  const [keywordExclude, setKeywordExclude] = useState(
    !!currentFilters.excludeKeywords
  );
  const [languageExclude, setLanguageExclude] = useState(
    !!currentFilters.excludeLanguages
  );
  const [countryExclude, setCountryExclude] = useState(
    !!currentFilters.excludeCountries
  );

  const dateGte =
    type === 'movie' ? 'primaryReleaseDateGte' : 'firstAirDateGte';
  const dateLte =
    type === 'movie' ? 'primaryReleaseDateLte' : 'firstAirDateLte';

  /**
   * Flip a section between include and exclude. Transfers the current value
   * so the user doesn't need to re-type after toggling.
   */
  const toggleSection = (
    section: {
      include: keyof FilterOptions;
      exclude: keyof FilterOptions;
    },
    next: boolean,
    setLocal: (v: boolean) => void
  ) => {
    setLocal(next);
    const includeVal = currentFilters[section.include];
    const excludeVal = currentFilters[section.exclude];
    if (next) {
      batchUpdateQueryParams({
        [section.include]: undefined,
        [section.exclude]: includeVal || excludeVal || undefined,
      });
    } else {
      batchUpdateQueryParams({
        [section.include]: excludeVal || includeVal || undefined,
        [section.exclude]: undefined,
      });
    }
  };

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
                  updateQueryParams(
                    dateGte,
                    value?.startDate ? (value.startDate as string) : undefined
                  );
                }}
                inputName="fromdate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
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
                  updateQueryParams(
                    dateLte,
                    value?.startDate ? (value.startDate as string) : undefined
                  );
                }}
                inputName="todate"
                useRange={false}
                asSingle
                containerClassName="datepicker-wrapper"
                inputClassName="pr-1 sm:pr-4 text-base leading-5"
              />
            </div>
          </div>
        </div>
        {type === 'movie' && (
          <div>
            <FilterSectionHeading
              title={intl.formatMessage(messages.studio)}
              dimension="studio"
              type={type}
              excludeMode={studioExclude}
              onToggleExclude={(next) =>
                toggleSection(
                  { include: 'studio', exclude: 'excludeStudio' },
                  next,
                  setStudioExclude
                )
              }
            />
            <CompanySelector
              defaultValue={
                studioExclude
                  ? currentFilters.excludeStudio
                  : currentFilters.studio
              }
              onChange={(value) => {
                updateQueryParams(
                  studioExclude ? 'excludeStudio' : 'studio',
                  value?.value.toString()
                );
              }}
            />
          </div>
        )}
        <div>
          <FilterSectionHeading
            title={intl.formatMessage(messages.genres)}
            dimension="genres"
            type={type}
            excludeMode={genreExclude}
            onToggleExclude={(next) =>
              toggleSection(
                { include: 'genre', exclude: 'excludeGenres' },
                next,
                setGenreExclude
              )
            }
          />
          <GenreSelector
            type={type}
            defaultValue={
              genreExclude ? currentFilters.excludeGenres : currentFilters.genre
            }
            isMulti
            onChange={(value) => {
              updateQueryParams(
                genreExclude ? 'excludeGenres' : 'genre',
                value?.map((v) => v.value).join(',')
              );
            }}
          />
        </div>
        {type === 'tv' && (
          <div>
            <FilterSectionHeading
              title={intl.formatMessage(messages.status)}
              dimension="status"
              type={type}
              excludeMode={statusExclude}
              onToggleExclude={(next) =>
                toggleSection(
                  { include: 'status', exclude: 'excludeStatus' },
                  next,
                  setStatusExclude
                )
              }
            />
            <StatusSelector
              defaultValue={
                statusExclude
                  ? currentFilters.excludeStatus
                  : currentFilters.status
              }
              isMulti
              onChange={(value) => {
                updateQueryParams(
                  statusExclude ? 'excludeStatus' : 'status',
                  value?.map((v) => v.value).join('|')
                );
              }}
            />
          </div>
        )}
        <div>
          <FilterSectionHeading
            title={intl.formatMessage(messages.keywords)}
            dimension="keywords"
            type={type}
            excludeMode={keywordExclude}
            onToggleExclude={(next) =>
              toggleSection(
                { include: 'keywords', exclude: 'excludeKeywords' },
                next,
                setKeywordExclude
              )
            }
          />
          <KeywordSelector
            defaultValue={
              keywordExclude
                ? currentFilters.excludeKeywords
                : currentFilters.keywords
            }
            isMulti
            onChange={(value) => {
              updateQueryParams(
                keywordExclude ? 'excludeKeywords' : 'keywords',
                value?.map((v) => v.value).join(',')
              );
            }}
          />
        </div>
        <div>
          <FilterSectionHeading
            title={intl.formatMessage(messages.originalLanguage)}
            dimension="language"
            type={type}
            excludeMode={languageExclude}
            onToggleExclude={(next) =>
              toggleSection(
                { include: 'language', exclude: 'excludeLanguages' },
                next,
                setLanguageExclude
              )
            }
          />
          <LanguageSelector
            value={
              languageExclude
                ? currentFilters.excludeLanguages
                : currentFilters.language
            }
            serverValue={currentSettings.originalLanguage}
            isUserSettings
            setFieldValue={(_key, value) => {
              updateQueryParams(
                languageExclude ? 'excludeLanguages' : 'language',
                value
              );
            }}
          />
        </div>
        <div>
          <FilterSectionHeading
            title={intl.formatMessage(messages.country)}
            dimension="country"
            type={type}
            excludeMode={countryExclude}
            onToggleExclude={(next) =>
              toggleSection(
                { include: 'country', exclude: 'excludeCountries' },
                next,
                setCountryExclude
              )
            }
          />
          <CountrySelector
            defaultValue={
              countryExclude
                ? currentFilters.excludeCountries
                : currentFilters.country
            }
            isMulti
            onChange={(value) => {
              updateQueryParams(
                countryExclude ? 'excludeCountries' : 'country',
                value?.map((v) => v.value).join(',')
              );
            }}
          />
        </div>
        <div>
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
        </div>
        <div>
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
        </div>
        <div>
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
        </div>
        <div>
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
        </div>
        <div>
          <span className="mb-1.5 text-lg font-semibold">
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
};

export default FilterSlideover;
