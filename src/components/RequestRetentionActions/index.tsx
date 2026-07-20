import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Tooltip from '@app/components/Common/Tooltip';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { getErrorMessage } from '@app/utils/getErrorMessage';
import { ClockIcon, TrashIcon } from '@heroicons/react/24/solid';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import axios from 'axios';
import { useState } from 'react';
import type { IntlShape } from 'react-intl';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.RequestRetentionActions', {
  deletemovie: 'Delete Movie & Files',
  deleteseries: 'Delete Series & Files',
  deletemediaconfirm: 'Permanently delete files?',
  deletemediatooltip:
    'Permanently removes this {mediaType} and its downloaded files. This is different from canceling the request - the {mediaType} will no longer be available to anyone.',
  keepmedia: 'Keep',
  keepmediatooltip:
    'Exempt this {mediaType} from automatic retention deletion, indefinitely',
  keptindefinitely: 'Kept Indefinitely',
  keptindefinitelyshort: 'Indefinite',
  expiresindays: 'Expires in {days}',
  expirestoday: 'Expires today',
  expirestodayshort: 'Today',
  retentionpendingtooltip:
    'Retention countdown starts once this {mediaType} is available',
  failedkeep: 'Something went wrong while updating retention.',
  faileddelete: 'Something went wrong while deleting this media.',
});

interface RetentionSummary {
  badgeType: 'default' | 'warning';
  text: string;
  tooltip?: string;
}

// Compact mode uses a minimal badge ("90d") with the full phrase in a tooltip.
function getRetentionSummary(
  request: NonFunctionProperties<MediaRequest>,
  compact: boolean,
  mediaTypeLabel: string,
  intl: IntlShape
): RetentionSummary {
  if (request.retentionDays == null) {
    return {
      badgeType: 'default',
      text: intl.formatMessage(
        compact ? messages.keptindefinitelyshort : messages.keptindefinitely
      ),
      tooltip: compact
        ? intl.formatMessage(messages.keptindefinitely)
        : undefined,
    };
  }

  if (request.availableSince) {
    const expiresInDays = Math.ceil(
      (new Date(request.availableSince).getTime() +
        request.retentionDays * 86400000 -
        Date.now()) /
        86400000
    );
    const isToday = expiresInDays <= 1;
    const longText = isToday
      ? intl.formatMessage(messages.expirestoday)
      : intl.formatMessage(messages.expiresindays, {
          days: intl.formatMessage(globalMessages.days, {
            count: expiresInDays,
          }),
        });
    return {
      badgeType: isToday ? 'warning' : 'default',
      text: compact
        ? intl.formatMessage(
            isToday ? messages.expirestodayshort : globalMessages.daysShort,
            { count: expiresInDays }
          )
        : longText,
      tooltip: compact ? longText : undefined,
    };
  }

  const daysText = intl.formatMessage(globalMessages.days, {
    count: request.retentionDays,
  });
  const pendingTooltip = intl.formatMessage(messages.retentionpendingtooltip, {
    mediaType: mediaTypeLabel,
  });
  return {
    badgeType: 'default',
    text: compact
      ? intl.formatMessage(globalMessages.daysShort, {
          count: request.retentionDays,
        })
      : daysText,
    tooltip: compact ? `${daysText} - ${pendingTooltip}` : pendingTooltip,
  };
}

interface RequestRetentionActionsProps {
  request: NonFunctionProperties<MediaRequest>;
  onUpdate?: () => void;
  layout?: 'inline' | 'stacked';
  /** Use minimal badge text (e.g. "90d" instead of "Expires in 90 days") for tight spaces like RequestCard. */
  compact?: boolean;
}

const RequestRetentionActions = ({
  request,
  onUpdate,
  layout = 'inline',
  compact = false,
}: RequestRetentionActionsProps) => {
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { addToast } = useToasts();
  const [isKeeping, setKeeping] = useState(false);
  const [isDeleting, setDeleting] = useState(false);

  const isAdmin = hasPermission(Permission.MANAGE_REQUESTS);
  const isOwner = request.requestedBy.id === user?.id;
  const isActionable =
    request.status === MediaRequestStatus.APPROVED ||
    request.status === MediaRequestStatus.COMPLETED;

  // No file to delete yet if still pending/searching in Radarr/Sonarr.
  const currentMediaStatus =
    request.media[request.is4k ? 'status4k' : 'status'];
  const hasFile =
    currentMediaStatus === MediaStatus.AVAILABLE ||
    currentMediaStatus === MediaStatus.PARTIALLY_AVAILABLE;

  const isVisible = isActionable && (isOwner || isAdmin);

  const canDelete = isVisible && hasFile;
  const canKeep =
    isVisible && (isAdmin || hasPermission(Permission.KEEP_MEDIA));

  if (!isVisible) {
    return null;
  }

  const mediaTypeLabel = request.type === MediaType.MOVIE ? 'movie' : 'series';
  const retentionSummary = getRetentionSummary(
    request,
    compact,
    mediaTypeLabel,
    intl
  );
  const retentionBadge = (
    <Badge badgeType={retentionSummary.badgeType} className="items-center">
      <ClockIcon className="mr-1 h-3 w-3 shrink-0" />
      {retentionSummary.text}
    </Badge>
  );

  const keepMedia = async () => {
    if (isKeeping) {
      return;
    }
    setKeeping(true);
    try {
      await axios.post(`/api/v1/request/${request.id}/retention`, {
        retentionDays: null,
      });
      onUpdate?.();
    } catch (e) {
      addToast(getErrorMessage(e, intl.formatMessage(messages.failedkeep)), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setKeeping(false);
    }
  };

  const deleteMedia = async () => {
    if (isDeleting) {
      return;
    }
    setDeleting(true);
    try {
      await axios.delete(`/api/v1/request/${request.id}`);
      onUpdate?.();
    } catch (e) {
      addToast(getErrorMessage(e, intl.formatMessage(messages.faileddelete)), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={
        layout === 'inline'
          ? 'flex flex-wrap items-center gap-2'
          : 'flex w-full flex-col space-y-2'
      }
    >
      {retentionSummary.tooltip ? (
        <Tooltip content={retentionSummary.tooltip}>{retentionBadge}</Tooltip>
      ) : (
        retentionBadge
      )}
      {canKeep && request.retentionDays != null && (
        <Tooltip
          content={intl.formatMessage(messages.keepmediatooltip, {
            mediaType: mediaTypeLabel,
          })}
        >
          <Button
            className={layout === 'stacked' ? 'w-full' : undefined}
            buttonType="default"
            buttonSize="sm"
            disabled={isKeeping}
            onClick={() => keepMedia()}
          >
            <ClockIcon />
            <span className={layout === 'inline' ? 'hidden sm:block' : ''}>
              {intl.formatMessage(messages.keepmedia)}
            </span>
          </Button>
        </Tooltip>
      )}
      {canDelete && (
        <Tooltip
          content={intl.formatMessage(messages.deletemediatooltip, {
            mediaType: mediaTypeLabel,
          })}
        >
          <ConfirmButton
            className={layout === 'stacked' ? 'w-full' : undefined}
            buttonSize="sm"
            onClick={() => deleteMedia()}
            confirmText={intl.formatMessage(messages.deletemediaconfirm)}
          >
            <TrashIcon />
            <span className={layout === 'inline' ? 'hidden sm:block' : ''}>
              {intl.formatMessage(
                request.type === MediaType.MOVIE
                  ? messages.deletemovie
                  : messages.deleteseries
              )}
            </span>
          </ConfirmButton>
        </Tooltip>
      )}
    </div>
  );
};

export default RequestRetentionActions;
