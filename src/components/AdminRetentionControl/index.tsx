import Button from '@app/components/Common/Button';
import useToasts from '@app/hooks/useToasts';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { getErrorMessage } from '@app/utils/getErrorMessage';
import { RETENTION_PRESETS } from '@app/utils/retentionHelpers';
import { MediaType } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { RetentionLimitResponse } from '@server/interfaces/api/userInterfaces';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.AdminRetentionControl', {
  retention: 'Retention',
  keepindefinitely: 'Keep Indefinitely',
  resettodefaultindefinite: 'Reset to Default (Indefinite)',
  resettodefaultdays: 'Reset to Default ({days})',
  customplaceholder: 'Days',
  set: 'Set',
  failedretention: 'Something went wrong while updating retention.',
});

interface AdminRetentionControlProps {
  request: Pick<MediaRequest, 'id' | 'type' | 'retentionDays'> & {
    requestedBy: { id: number };
  };
  onUpdate?: () => void;
  className?: string;
}

/**
 * Lets an admin (MANAGE_REQUESTS) set or override a request's retention,
 * including granting indefinite retention, regardless of whether the
 * requester holds Permission.KEEP_MEDIA themselves. Only rendered from
 * admin-gated surfaces (ManageSlideOver, admin request list) - the
 * retention endpoint enforces this same admin bypass server-side.
 */
const AdminRetentionControl = ({
  request,
  onUpdate,
  className,
}: AdminRetentionControlProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [retentionDays, setRetentionDays] = useState(request.retentionDays);
  const [isSaving, setSaving] = useState(false);
  const [customDays, setCustomDays] = useState('');

  const { data: retentionLimit } = useSWR<RetentionLimitResponse>(
    `/api/v1/user/${request.requestedBy.id}/retention`
  );
  const limitForType =
    request.type === MediaType.MOVIE
      ? retentionLimit?.movie
      : retentionLimit?.tv;

  if (!limitForType?.enabled) {
    return null;
  }

  const updateRetention = async (days: number | null) => {
    setSaving(true);
    try {
      await axios.post(`/api/v1/request/${request.id}/retention`, {
        retentionDays: days,
      });
      setRetentionDays(days);
      onUpdate?.();
    } catch (e) {
      addToast(
        getErrorMessage(e, intl.formatMessage(messages.failedretention)),
        { autoDismiss: true, appearance: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () =>
    updateRetention(limitForType.defaultDays ?? null);
  const isAtDefault = retentionDays === (limitForType.defaultDays ?? null);

  const applyCustomDays = () => {
    const parsed = Number(customDays);
    if (!customDays || !Number.isInteger(parsed) || parsed <= 0) {
      return;
    }
    updateRetention(parsed);
    setCustomDays('');
  };

  return (
    <div className={`text-sm ${className ?? ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold">
          {intl.formatMessage(messages.retention)}
        </span>
        <select
          className="short"
          value={retentionDays ?? 'indefinite'}
          disabled={isSaving}
          onChange={(e) =>
            updateRetention(
              e.target.value === 'indefinite' ? null : Number(e.target.value)
            )
          }
        >
          <option value="indefinite">
            {intl.formatMessage(messages.keepindefinitely)}
          </option>
          {RETENTION_PRESETS.map((days) => (
            <option value={days} key={`retention-admin-${days}`}>
              {intl.formatMessage(globalMessages.days, { count: days })}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          buttonSize="sm"
          buttonType="default"
          disabled={isSaving || isAtDefault}
          onClick={resetToDefault}
        >
          {limitForType.defaultDays
            ? intl.formatMessage(messages.resettodefaultdays, {
                days: intl.formatMessage(globalMessages.days, {
                  count: limitForType.defaultDays,
                }),
              })
            : intl.formatMessage(messages.resettodefaultindefinite)}
        </Button>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            step={1}
            className="short"
            placeholder={intl.formatMessage(messages.customplaceholder)}
            value={customDays}
            disabled={isSaving}
            onChange={(e) => setCustomDays(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomDays();
              }
            }}
          />
          <Button
            buttonSize="sm"
            buttonType="default"
            disabled={isSaving || !customDays}
            onClick={applyCustomDays}
          >
            {intl.formatMessage(messages.set)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminRetentionControl;
