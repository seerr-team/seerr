import defineMessages from '@app/utils/defineMessages';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.QuotaSelector', {
  movieRequests:
    '{quotaLimit} <quotaUnits>{movies} per {quotaDays} {days}</quotaUnits>',
  tvRequests:
    '{quotaLimit} <quotaUnits>{seasons} per {quotaDays} {days}</quotaUnits>',
  bookRequests:
    '{quotaLimit} <quotaUnits>{books} per {quotaDays} {days}</quotaUnits>',
  movies: '{count, plural, one {movie} other {movies}}',
  seasons: '{count, plural, one {season} other {seasons}}',
  books: '{count, plural, one {book} other {books}}',
  days: '{count, plural, one {day} other {days}}',
  unlimited: 'Unlimited',
});

interface QuotaSelectorProps {
  mediaType: 'movie' | 'tv' | 'book';
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

  return (
    <div className={`${isDisabled ? 'opacity-50' : ''}`}>
      {intl.formatMessage(
        mediaType === 'movie'
          ? messages.movieRequests
          : mediaType === 'book'
          ? messages.bookRequests
          : messages.tvRequests,
        {
          quotaLimit: (
            <select
              className="short inline"
              value={limitOverride ?? quotaLimit}
              onChange={(e) => setQuotaLimit(Number(e.target.value))}
              disabled={isDisabled}
            >
              <option value="0">
                {intl.formatMessage(messages.unlimited)}
              </option>
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
              value={dayOverride ?? quotaDays}
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
          movies: intl.formatMessage(messages.movies, { count: quotaLimit }),
          seasons: intl.formatMessage(messages.seasons, { count: quotaLimit }),
          books: intl.formatMessage(messages.books, { count: quotaLimit }),
          days: intl.formatMessage(messages.days, { count: quotaDays }),
          quotaUnits: function quotaUnits(msg) {
            return (
              <span className={limitOverride || quotaLimit ? '' : 'hidden'}>
                {msg}
              </span>
            );
          },
        }
      )}
    </div>
  );
};

export default React.memo(QuotaSelector);
