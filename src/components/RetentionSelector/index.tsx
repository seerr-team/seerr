import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { RETENTION_PRESETS } from '@app/utils/retentionHelpers';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RetentionSelector', {
  retentionDays: 'Delete after {retentionDays}',
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
            {RETENTION_PRESETS.map((days) => (
              <option value={days} key={`${mediaType}-retention-${days}`}>
                {intl.formatMessage(globalMessages.days, { count: days })}
              </option>
            ))}
          </select>
        ),
      })}
    </div>
  );
};

export default React.memo(RetentionSelector);
