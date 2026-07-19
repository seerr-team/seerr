import defineMessages from '@app/utils/defineMessages';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RetentionSelector', {
  retentionDays:
    'Delete after <retentionUnits>{retentionDays} {days}</retentionUnits>',
  days: '{count, plural, one {day} other {days}}',
  unlimited: 'Never (Unlimited)',
});

interface RetentionSelectorProps {
  mediaType: 'movie' | 'tv';
  fieldName: string;
  defaultDays?: number;
  override?: number;
  isDisabled?: boolean;
  onChange: (fieldName: string, value: number) => void;
}

const RetentionSelector = ({
  mediaType,
  fieldName,
  defaultDays = 0,
  override,
  isDisabled = false,
  onChange,
}: RetentionSelectorProps) => {
  const [retentionDays, setRetentionDays] = useState(defaultDays ?? 0);
  const intl = useIntl();

  useEffect(() => {
    onChange(fieldName, retentionDays);
  }, [fieldName, onChange, retentionDays]);

  return (
    <div className={isDisabled ? 'opacity-50' : ''}>
      {intl.formatMessage(messages.retentionDays, {
        retentionDays: (
          <select
            className="short inline"
            value={override ?? retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            disabled={isDisabled}
          >
            <option value="0">{intl.formatMessage(messages.unlimited)}</option>
            {[7, 14, 30, 60, 90, 180, 365].map((days) => (
              <option value={days} key={`${mediaType}-retention-${days}`}>
                {days}
              </option>
            ))}
          </select>
        ),
        days: intl.formatMessage(messages.days, {
          count: override ?? retentionDays,
        }),
        retentionUnits: function retentionUnits(msg) {
          return (
            <span className={override || retentionDays ? '' : 'hidden'}>
              {msg}
            </span>
          );
        },
      })}
    </div>
  );
};

export default React.memo(RetentionSelector);
