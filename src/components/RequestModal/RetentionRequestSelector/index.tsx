import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { RETENTION_PRESETS } from '@app/utils/retentionHelpers';
import {
  DEFAULT_RETENTION_FALLBACK_DAYS,
  type RetentionLimitStatus,
} from '@server/interfaces/api/userInterfaces';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages(
  'components.RequestModal.RetentionRequestSelector',
  {
    keepfor: 'Keep for',
    indefinitely: 'Keep Indefinitely',
  }
);

interface RetentionRequestSelectorProps {
  retentionLimit: RetentionLimitStatus;
  value: number | null;
  onChange: (value: number | null) => void;
}

const RetentionRequestSelector = ({
  retentionLimit,
  value,
  onChange,
}: RetentionRequestSelectorProps) => {
  const intl = useIntl();

  const availablePresets = retentionLimit.maxDays
    ? RETENTION_PRESETS.filter(
        (days) => days <= (retentionLimit.maxDays as number)
      )
    : RETENTION_PRESETS;

  useEffect(() => {
    if (value !== null) {
      return;
    }
    if (retentionLimit.maxDays) {
      onChange(retentionLimit.maxDays);
    } else if (!retentionLimit.canKeepIndefinitely) {
      // No cap is configured, but this user isn't allowed to keep media
      // indefinitely - don't let the selector silently submit "indefinite".
      onChange(DEFAULT_RETENTION_FALLBACK_DAYS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retentionLimit.maxDays, retentionLimit.canKeepIndefinitely]);

  if (!retentionLimit.enabled) {
    return null;
  }

  return (
    <div className="form-row">
      <label htmlFor="retentionDays" className="text-label">
        {intl.formatMessage(messages.keepfor)}
      </label>
      <div className="form-input-area">
        <div className="form-input-field">
          <select
            id="retentionDays"
            name="retentionDays"
            className="short inline"
            value={value ?? 'indefinite'}
            onChange={(e) =>
              onChange(
                e.target.value === 'indefinite' ? null : Number(e.target.value)
              )
            }
          >
            {retentionLimit.canKeepIndefinitely && (
              <option value="indefinite">
                {intl.formatMessage(messages.indefinitely)}
              </option>
            )}
            {availablePresets.map((days) => (
              <option value={days} key={`retention-preset-${days}`}>
                {intl.formatMessage(globalMessages.days, { count: days })}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default RetentionRequestSelector;
