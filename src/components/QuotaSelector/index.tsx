import defineMessages from '@app/utils/defineMessages';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.QuotaSelector', {
  movieRequests:
    '{quotaLimit} <quotaUnits>{movies} per {quotaDays} {days}</quotaUnits>',
  tvRequests:
    '{quotaLimit} <quotaUnits>{seasons} per {quotaDays} {days}</quotaUnits>',
  movies: '{count, plural, one {movie} other {movies}}',
  seasons: '{count, plural, one {season} other {seasons}}',
  days: '{count, plural, one {day} other {days}}',
  unlimited: 'Unlimited',
});

interface QuotaSelectorProps {
  mediaType: 'movie' | 'tv' | 'combined';
  defaultDays?: number;
  defaultLimit?: number;
  dayOverride?: number;
  limitOverride?: number;
  dayFieldName: string;
  limitFieldName: string;
  isDisabled?: boolean;
  onChange: (fieldName: string, value: number) => void;
}

const QuotaSelector = ({
  mediaType,
  dayFieldName,
  limitFieldName,
  defaultDays = 7,
  defaultLimit = 0,
  dayOverride,
  limitOverride,
  isDisabled = false,
  onChange,
}: QuotaSelectorProps) => {
  const initialDays = defaultDays ?? 7;
  const initialLimit = defaultLimit ?? 0;
  const [quotaDays, setQuotaDays] = useState(initialDays);
  const [quotaLimit, setQuotaLimit] = useState(initialLimit);
  const intl = useIntl();

  useEffect(() => {
    onChange(dayFieldName, quotaDays);
  }, [dayFieldName, onChange, quotaDays]);

  useEffect(() => {
    onChange(limitFieldName, quotaLimit);
  }, [limitFieldName, onChange, quotaLimit]);

  const currentLimit = limitOverride ?? quotaLimit;
  const currentDays = dayOverride ?? quotaDays;

  const unitsLabel = (() => {
    if (mediaType === 'movie') {
      return intl.formatMessage(messages.movies, { count: currentLimit });
    }

    if (mediaType === 'tv') {
      return intl.formatMessage(messages.seasons, { count: currentLimit });
    }

    return currentLimit === 1 ? 'request' : 'requests';
  })();

  const quotaMessage =
    mediaType === 'tv' ? messages.tvRequests : messages.movieRequests;

  return (
    <div className={`${isDisabled ? 'opacity-50' : ''}`}>
      {intl.formatMessage(quotaMessage, {
        quotaLimit: (
          <select
            className="short inline"
            value={currentLimit}
            onChange={(e) => setQuotaLimit(Number(e.target.value))}
            disabled={isDisabled}
          >
            <option value="0">{intl.formatMessage(messages.unlimited)}</option>
            {[...Array(100)].map((_item, i) => (
              <option value={i + 1} key={`${mediaType}-limit-${i + 1}`}>
                {i + 1}
              </option>
            ))}
          </select>
        ),
        quotaDays: (
          <select
            className="short inline"
            value={currentDays}
            onChange={(e) => setQuotaDays(Number(e.target.value))}
            disabled={isDisabled}
          >
            {[...Array(100)].map((_item, i) => (
              <option value={i + 1} key={`${mediaType}-days-${i + 1}`}>
                {i + 1}
              </option>
            ))}
          </select>
        ),
        movies: unitsLabel,
        seasons: unitsLabel,
        days: intl.formatMessage(messages.days, { count: currentDays }),
        quotaUnits: function quotaUnits(msg) {
          return <span className={currentLimit ? '' : 'hidden'}>{msg}</span>;
        },
      })}
    </div>
  );
};

export default React.memo(QuotaSelector);
