import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Tooltip from '@app/components/Common/Tooltip';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { ClockIcon, TrashIcon } from '@heroicons/react/24/solid';
import { MediaRequestStatus, MediaType } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import axios from 'axios';
import { useState } from 'react';
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
  expiresindays: 'Expires in {days, plural, one {# day} other {# days}}',
  expirestoday: 'Expires today',
  expiresindaysshort: '{days}d',
  expirestodayshort: 'Today',
  retentionpending: '{days, plural, one {# day} other {# days}}',
  retentionpendingshort: '{days}d',
  retentionpendingtooltip:
    'Retention countdown starts once this {mediaType} is available',
  failedkeep: 'Something went wrong while updating retention.',
  faileddelete: 'Something went wrong while deleting this media.',
});

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

  // Admins (manage content) can delete or keep anyone's media outright.
  // Non-admin owners need Permission.KEEP_MEDIA to keep their own media
  // indefinitely, but can always delete/relinquish their own request.
  const canDelete = isActionable && (isOwner || isAdmin);
  const canKeep =
    isActionable &&
    (isAdmin || (isOwner && hasPermission(Permission.KEEP_MEDIA)));

  if (!canDelete && !canKeep) {
    return null;
  }

  const mediaTypeLabel = request.type === MediaType.MOVIE ? 'movie' : 'series';

  const retentionSummary: {
    badgeType: 'default' | 'warning';
    text: string;
    tooltip?: string;
  } = (() => {
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
        : intl.formatMessage(messages.expiresindays, { days: expiresInDays });
      return {
        badgeType: isToday ? 'warning' : 'default',
        text: compact
          ? intl.formatMessage(
              isToday
                ? messages.expirestodayshort
                : messages.expiresindaysshort,
              { days: expiresInDays }
            )
          : longText,
        tooltip: compact ? longText : undefined,
      };
    }
    const pendingTooltip = intl.formatMessage(
      messages.retentionpendingtooltip,
      { mediaType: mediaTypeLabel }
    );
    return {
      badgeType: 'default',
      text: intl.formatMessage(
        compact ? messages.retentionpendingshort : messages.retentionpending,
        { days: request.retentionDays }
      ),
      tooltip: compact
        ? `${intl.formatMessage(messages.retentionpending, { days: request.retentionDays })} - ${pendingTooltip}`
        : pendingTooltip,
    };
  })();

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
      const message =
        (axios.isAxiosError(e) && e.response?.data?.message) ||
        intl.formatMessage(messages.failedkeep);
      addToast(message, {
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
      const message =
        (axios.isAxiosError(e) && e.response?.data?.message) ||
        intl.formatMessage(messages.faileddelete);
      addToast(message, {
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
      {(() => {
        const badge = (
          <Badge badgeType={retentionSummary.badgeType}>
            <ClockIcon className="mr-1 inline-block h-3 w-3" />
            {retentionSummary.text}
          </Badge>
        );
        return retentionSummary.tooltip ? (
          <Tooltip content={retentionSummary.tooltip}>{badge}</Tooltip>
        ) : (
          badge
        );
      })()}
      {canKeep && request.retentionDays != null && (
        <Tooltip
          content={intl.formatMessage(messages.keepmediatooltip, {
            mediaType: mediaTypeLabel,
          })}
        >
          <Button
            className={layout === 'stacked' ? 'w-full' : undefined}
            buttonType="default"
            buttonSize={layout === 'inline' ? 'sm' : 'md'}
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
