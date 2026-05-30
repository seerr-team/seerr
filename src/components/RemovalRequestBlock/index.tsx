import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import { useToasts } from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { CheckIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { MediaRemovalRequestStatus, MediaType } from '@server/constants/media';
import type { MediaRemovalRequest } from '@server/entity/MediaRemovalRequest';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.RemovalRequestBlock', {
  approve: 'Approve Removal',
  decline: 'Decline Removal',
  delete: 'Delete Request',
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  failed: 'Failed',
  partiallyRemoved: 'Pending Removal',
  removal: 'Removal',
  removal4k: '4K Removal',
  seasons: '{count, plural, one {Season {seasons}} other {{count} Seasons}}',
  actionFailed: 'Something went wrong while updating the removal request.',
  removedmedia: 'Removed media',
  unknowntitle: 'Unknown Title',
});

interface RemovalRequestBlockProps {
  request: MediaRemovalRequest;
  onUpdate?: () => void;
  // When true (e.g. the global request list), the block also shows which media
  // the removal targets. In the manage slide-over the media is already obvious,
  // so this stays off to avoid redundancy.
  showMedia?: boolean;
}

const isMovieDetails = (
  details: MovieDetails | TvDetails
): details is MovieDetails => (details as MovieDetails).title !== undefined;

const RemovalRequestBlock = ({
  request,
  onUpdate,
  showMedia = false,
}: RemovalRequestBlockProps) => {
  const { user, hasPermission } = useUser();
  const intl = useIntl();
  const { addToast } = useToasts();
  const [isLoading, setIsLoading] = useState(false);

  const media = request.media;
  const { data: title } = useSWR<MovieDetails | TvDetails>(
    showMedia && media
      ? media.mediaType === MediaType.MOVIE
        ? `/api/v1/movie/${media.tmdbId}`
        : `/api/v1/tv/${media.tmdbId}`
      : null
  );

  const updateRequest = async (
    action: 'approve' | 'decline' | 'retry'
  ): Promise<void> => {
    setIsLoading(true);
    try {
      await axios.post(`/api/v1/removal-request/${request.id}/${action}`);
    } catch {
      addToast(intl.formatMessage(messages.actionFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      // Revalidate to sync UI state regardless of outcome
      onUpdate?.();
      setIsLoading(false);
    }
  };

  const deleteRequest = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await axios.delete(`/api/v1/removal-request/${request.id}`);
    } catch {
      addToast(intl.formatMessage(messages.actionFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      onUpdate?.();
      setIsLoading(false);
    }
  };

  const statusBadge = (() => {
    switch (request.status) {
      case MediaRemovalRequestStatus.PENDING:
        return (
          <Badge badgeType="warning">
            {intl.formatMessage(messages.pending)}
          </Badge>
        );
      case MediaRemovalRequestStatus.APPROVED:
        return (
          <Badge badgeType="success">
            {intl.formatMessage(messages.approved)}
          </Badge>
        );
      case MediaRemovalRequestStatus.DECLINED:
        return (
          <Badge badgeType="danger">
            {intl.formatMessage(messages.declined)}
          </Badge>
        );
      case MediaRemovalRequestStatus.FAILED:
        return (
          <Badge badgeType="danger">
            {intl.formatMessage(messages.failed)}
          </Badge>
        );
      case MediaRemovalRequestStatus.PARTIALLY_REMOVED:
        return (
          <Badge badgeType="warning">
            {intl.formatMessage(messages.partiallyRemoved)}
          </Badge>
        );
    }
  })();

  const canManagePending =
    hasPermission(Permission.MANAGE_REQUESTS) &&
    request.status === MediaRemovalRequestStatus.PENDING;
  const canRetry =
    hasPermission(Permission.MANAGE_REQUESTS) &&
    request.status === MediaRemovalRequestStatus.FAILED;
  const canDelete =
    hasPermission(Permission.MANAGE_REQUESTS) ||
    request.requestedBy?.id === user?.id;

  const mediaTitle = title
    ? isMovieDetails(title)
      ? title.title
      : title.name
    : undefined;

  return (
    <div className="flex items-center justify-between px-4 py-3 text-gray-400">
      <div className="flex min-w-0 items-center space-x-2">
        {showMedia &&
          (media ? (
            <Link
              href={`/${media.mediaType}/${media.tmdbId}`}
              className="flex min-w-0 items-center space-x-3"
            >
              <CachedImage
                type="tmdb"
                src={
                  title?.posterPath
                    ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${title.posterPath}`
                    : '/images/seerr_poster_not_found.png'
                }
                alt=""
                className="h-12 w-8 shrink-0 rounded-sm object-cover"
                width={32}
                height={48}
              />
              <span className="truncate font-medium text-white">
                {mediaTitle ?? intl.formatMessage(messages.unknowntitle)}
              </span>
            </Link>
          ) : (
            <span className="truncate italic">
              {intl.formatMessage(messages.removedmedia)}
            </span>
          ))}
        {statusBadge}
        {request.seasons && request.seasons.length > 0 && (
          <Tooltip content={request.seasons.map((s) => `S${s}`).join(', ')}>
            <Badge badgeType="default" className="shrink-0">
              {intl.formatMessage(messages.seasons, {
                count: request.seasons.length,
                seasons: request.seasons.join(', '),
              })}
            </Badge>
          </Tooltip>
        )}
        {request.requestedBy && (
          <Tooltip
            content={`${request.requestedBy.displayName} – ${intl.formatDate(request.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}`}
          >
            <Link
              href={`/users/${request.requestedBy.id}`}
              className="shrink-0"
            >
              <CachedImage
                type="avatar"
                src={request.requestedBy.avatar}
                alt={request.requestedBy.displayName}
                className="h-5 w-5 rounded-full object-cover"
                width={20}
                height={20}
              />
            </Link>
          </Tooltip>
        )}
      </div>
      <div className="flex shrink-0 items-center space-x-1">
        {canManagePending && (
          <Tooltip content={intl.formatMessage(messages.approve)}>
            <Button
              buttonType="success"
              buttonSize="sm"
              disabled={isLoading}
              onClick={() => updateRequest('approve')}
              aria-label={intl.formatMessage(messages.approve)}
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
          </Tooltip>
        )}
        {canManagePending && (
          <Tooltip content={intl.formatMessage(messages.decline)}>
            <Button
              buttonType="danger"
              buttonSize="sm"
              disabled={isLoading}
              onClick={() => updateRequest('decline')}
              aria-label={intl.formatMessage(messages.decline)}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </Tooltip>
        )}
        {canRetry && (
          <Tooltip content={intl.formatMessage(globalMessages.retry)}>
            <Button
              buttonType="primary"
              buttonSize="sm"
              disabled={isLoading}
              onClick={() => updateRequest('retry')}
            >
              {intl.formatMessage(globalMessages.retry)}
            </Button>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip content={intl.formatMessage(messages.delete)}>
            <Button
              buttonType="danger"
              buttonSize="sm"
              disabled={isLoading}
              onClick={() => deleteRequest()}
              aria-label={intl.formatMessage(messages.delete)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default RemovalRequestBlock;
