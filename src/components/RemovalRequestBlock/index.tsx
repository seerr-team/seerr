import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import Tooltip from '@app/components/Common/Tooltip';
import { useToasts } from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  CheckIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { MediaRemovalRequestStatus, MediaType } from '@server/constants/media';
import type { MediaRemovalRequest } from '@server/entity/MediaRemovalRequest';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { FormattedRelativeTime, useIntl } from 'react-intl';
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
  seasons: '{count, plural, one {Season} other {Seasons}}',
  actionFailed: 'Something went wrong while updating the removal request.',
  removedmedia: 'Removed media',
  unknowntitle: 'Unknown Title',
  type: 'Type',
  requestedby: 'Requested By',
});

interface RemovalRequestBlockProps {
  request: MediaRemovalRequest;
  onUpdate?: () => void;
  // When true (e.g. the global request list) the block renders as a full card
  // that identifies the target media, mirroring RequestItem. In the manage
  // slide-over it renders as a compact row, mirroring RequestBlock.
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

  const typeBadge = (
    <Badge badgeType="danger">
      {intl.formatMessage(request.is4k ? messages.removal4k : messages.removal)}
    </Badge>
  );

  const seasonBadges =
    request.seasons && request.seasons.length > 0 ? (
      <span className="flex flex-wrap">
        {request.seasons.map((s) => (
          <span key={`season-${s}`} className="mb-1 mr-1.5">
            <Badge>{s}</Badge>
          </span>
        ))}
      </span>
    ) : null;

  const canManagePending =
    hasPermission(Permission.MANAGE_REQUESTS) &&
    request.status === MediaRemovalRequestStatus.PENDING;
  const canRetry =
    hasPermission(Permission.MANAGE_REQUESTS) &&
    request.status === MediaRemovalRequestStatus.FAILED;
  const canDelete =
    hasPermission(Permission.MANAGE_REQUESTS) ||
    request.requestedBy?.id === user?.id;

  const requesterLink = request.requestedBy ? (
    <Link
      href={
        request.requestedBy.id === user?.id
          ? '/profile'
          : `/users/${request.requestedBy.id}`
      }
      className="group flex items-center truncate"
    >
      <span className="avatar-sm ml-1.5">
        <CachedImage
          type="avatar"
          src={request.requestedBy.avatar}
          alt=""
          className="avatar-sm object-cover"
          width={20}
          height={20}
        />
      </span>
      <span className="truncate text-sm font-semibold group-hover:text-white group-hover:underline">
        {request.requestedBy.displayName}
      </span>
    </Link>
  ) : null;

  const approveDeclineButtons = canManagePending && (
    <>
      <Tooltip content={intl.formatMessage(messages.approve)}>
        <Button
          buttonType="success"
          disabled={isLoading}
          onClick={() => updateRequest('approve')}
          aria-label={intl.formatMessage(messages.approve)}
        >
          <CheckIcon className="icon-sm" />
        </Button>
      </Tooltip>
      <Tooltip content={intl.formatMessage(messages.decline)}>
        <Button
          buttonType="danger"
          disabled={isLoading}
          onClick={() => updateRequest('decline')}
          aria-label={intl.formatMessage(messages.decline)}
        >
          <XMarkIcon className="icon-sm" />
        </Button>
      </Tooltip>
    </>
  );

  // ── Compact row (manage slide-over) ─────────────────────────────────────
  if (!showMedia) {
    return (
      <div className="px-4 py-3 text-gray-300">
        <div className="flex items-center justify-between">
          <div className="mr-6 min-w-0 flex-1 text-sm leading-5">
            <div className="mb-1 flex flex-nowrap">
              <span className="flex items-center truncate">
                <Tooltip content={intl.formatMessage(messages.requestedby)}>
                  <UserIcon className="mr-1.5 h-5 w-5 min-w-0 flex-shrink-0" />
                </Tooltip>
                {requesterLink}
              </span>
            </div>
          </div>
          <div className="ml-2 flex flex-shrink-0 flex-wrap gap-1">
            {approveDeclineButtons}
            {canRetry && (
              <Tooltip content={intl.formatMessage(globalMessages.retry)}>
                <Button
                  buttonType="primary"
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
                  disabled={isLoading}
                  onClick={() => deleteRequest()}
                  aria-label={intl.formatMessage(messages.delete)}
                >
                  <TrashIcon className="icon-sm" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {typeBadge}
          {statusBadge}
          {seasonBadges}
        </div>
      </div>
    );
  }

  // ── Full card (request list) ────────────────────────────────────────────
  const mediaTitle = title
    ? isMovieDetails(title)
      ? title.title
      : title.name
    : undefined;
  const year = title
    ? (isMovieDetails(title) ? title.releaseDate : title.firstAirDate)?.slice(
        0,
        4
      )
    : undefined;
  const mediaHref = media ? `/${media.mediaType}/${media.tmdbId}` : undefined;

  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-2 text-gray-400 shadow-md ring-1 ring-gray-700 xl:h-28 xl:flex-row">
      {title?.backdropPath && (
        <div className="absolute inset-0 z-0 w-full bg-cover bg-center xl:w-2/3">
          <CachedImage
            type="tmdb"
            src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${title.backdropPath}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(31, 41, 55, 0.47) 0%, rgba(31, 41, 55, 1) 100%)',
            }}
          />
        </div>
      )}
      <div className="relative flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="relative z-10 flex w-full items-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          {mediaHref ? (
            <Link
              href={mediaHref}
              className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105"
            >
              <CachedImage
                type="tmdb"
                src={
                  title?.posterPath
                    ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${title.posterPath}`
                    : '/images/seerr_poster_not_found.png'
                }
                alt=""
                sizes="100vw"
                style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                width={600}
                height={900}
              />
            </Link>
          ) : (
            <div className="h-auto w-12 flex-shrink-0 overflow-hidden rounded-md">
              <CachedImage
                type="tmdb"
                src={'/images/seerr_poster_not_found.png'}
                alt=""
                sizes="100vw"
                style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                width={600}
                height={900}
              />
            </div>
          )}
          <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
            <div className="pt-0.5 text-xs font-medium text-white sm:pt-1">
              {year}
            </div>
            {mediaHref ? (
              <Link
                href={mediaHref}
                className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl"
              >
                {mediaTitle ?? intl.formatMessage(messages.unknowntitle)}
              </Link>
            ) : (
              <span className="mr-2 min-w-0 truncate text-lg font-bold text-white xl:text-xl">
                {intl.formatMessage(messages.removedmedia)}
              </span>
            )}
            {seasonBadges && (
              <div className="card-field">
                <span className="card-field-name">
                  {intl.formatMessage(messages.seasons, {
                    count: request.seasons?.length ?? 0,
                  })}
                </span>
                {seasonBadges}
              </div>
            )}
          </div>
        </div>
        <div className="z-10 ml-4 mt-4 flex w-full flex-col justify-center gap-1 overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(messages.type)}
            </span>
            {typeBadge}
          </div>
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(globalMessages.status)}
            </span>
            {statusBadge}
          </div>
          {requesterLink && (
            <div className="card-field">
              <span className="card-field-name">
                {intl.formatMessage(messages.requestedby)}
              </span>
              <span className="flex truncate text-sm text-gray-300">
                {requesterLink}
                <span className="ml-1 flex items-center">
                  <FormattedRelativeTime
                    value={Math.floor(
                      (new Date(request.createdAt).getTime() - Date.now()) /
                        1000
                    )}
                    updateIntervalInSeconds={1}
                    numeric="auto"
                  />
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="z-10 mt-4 flex w-full flex-col justify-center space-y-2 pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
        {canManagePending && (
          <div className="flex w-full gap-2 xl:w-auto">
            <Button
              className="w-full"
              buttonType="success"
              disabled={isLoading}
              onClick={() => updateRequest('approve')}
            >
              <CheckIcon />
              <span>{intl.formatMessage(messages.approve)}</span>
            </Button>
            <Button
              className="w-full"
              buttonType="danger"
              disabled={isLoading}
              onClick={() => updateRequest('decline')}
            >
              <XMarkIcon />
              <span>{intl.formatMessage(messages.decline)}</span>
            </Button>
          </div>
        )}
        {canRetry && (
          <Button
            className="w-full"
            buttonType="primary"
            disabled={isLoading}
            onClick={() => updateRequest('retry')}
          >
            <span>{intl.formatMessage(globalMessages.retry)}</span>
          </Button>
        )}
        {canDelete && (
          <ConfirmButton
            onClick={() => deleteRequest()}
            confirmText={intl.formatMessage(globalMessages.areyousure)}
            className="w-full"
          >
            <TrashIcon />
            <span>{intl.formatMessage(messages.delete)}</span>
          </ConfirmButton>
        )}
      </div>
    </div>
  );
};

export default RemovalRequestBlock;
