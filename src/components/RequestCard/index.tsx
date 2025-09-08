import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import StatusBadge from '@app/components/StatusBadge';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import { withProperties } from '@app/utils/typeHelpers';
import {
  ArrowPathIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestCard', {
  seasons: '{seasonCount, plural, one {Season} other {Seasons}}',
  failedretry: 'Something went wrong while retrying the request.',
  mediaerror: '{mediaType} Not Found',
  tmdbid: 'TMDB ID',
  tvdbid: 'TheTVDB ID',
  approverequest: 'Approve Request',
  declinerequest: 'Decline Request',
  editrequest: 'Edit Request',
  cancelrequest: 'Cancel Request',
  deleterequest: 'Delete Request',
  unknowntitle: 'Unknown Title',
});

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

const RequestCardPlaceholder = () => {
  return (
    <div className="relative w-72 animate-pulse rounded-xl bg-gray-700 p-4 sm:w-96">
      <div className="w-20 sm:w-28">
        <div className="w-full" style={{ paddingBottom: '150%' }} />
      </div>
    </div>
  );
};

interface RequestCardErrorProps {
  requestData?: NonFunctionProperties<MediaRequest>;
}

const RequestCardError = ({ requestData }: RequestCardErrorProps) => {
  const { hasPermission } = useUser();
  const intl = useIntl();

  const { mediaUrl: plexUrl, mediaUrl4k: plexUrl4k } = useDeepLinks({
    mediaUrl: requestData?.media?.mediaUrl,
    mediaUrl4k: requestData?.media?.mediaUrl4k,
    iOSPlexUrl: requestData?.media?.iOSPlexUrl,
    iOSPlexUrl4k: requestData?.media?.iOSPlexUrl4k,
  });

  const deleteRequest = async () => {
    await axios.delete(`/api/v1/media/${requestData?.media.id}`);
    mutate('/api/v1/media?filter=allavailable&take=20&sort=mediaAdded');
    mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');
    mutate('/api/v1/request/count');
  };

  return (
    <div
      className="relative flex w-72 overflow-hidden rounded-xl bg-gray-800 p-4 text-gray-400 shadow ring-1 ring-red-500 sm:w-96"
      data-testid="request-card"
    >
      <div className="w-20 sm:w-28">
        <div className="w-full" style={{ paddingBottom: '150%' }}>
          <div className="absolute inset-0 z-10 flex min-w-0 flex-1 flex-col p-4">
            <div
              className="whitespace-normal text-base font-bold text-white sm:text-lg"
              data-testid="request-card-title"
            >
              {intl.formatMessage(messages.mediaerror, {
                mediaType: intl.formatMessage(
                  requestData?.type
                    ? requestData?.type === 'movie'
                      ? globalMessages.movie
                      : globalMessages.tvshow
                    : globalMessages.request
                ),
              })}
            </div>
            {requestData && (
              <>
                {hasPermission(
                  [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                  { type: 'or' }
                ) && (
                  <div className="card-field !hidden sm:!block">
                    <Link
                      href={`/users/${requestData.requestedBy.id}`}
                      className="group flex items-center"
                    >
                      <span className="avatar-sm">
                        <CachedImage
                          type="avatar"
                          src={requestData.requestedBy.avatar}
                          alt=""
                          className="avatar-sm object-cover"
                          width={20}
                          height={20}
                        />
                      </span>
                      <span className="truncate group-hover:underline">
                        {requestData.requestedBy.displayName}
                      </span>
                    </Link>
                  </div>
                )}
                <div className="mt-2 flex items-center text-sm sm:mt-1">
                  <span className="mr-2 hidden font-bold sm:block">
                    {intl.formatMessage(globalMessages.status)}
                  </span>
                  {requestData.status === MediaRequestStatus.DECLINED ||
                  requestData.status === MediaRequestStatus.FAILED ? (
                    <Badge badgeType="danger">
                      {requestData.status === MediaRequestStatus.DECLINED
                        ? intl.formatMessage(globalMessages.declined)
                        : intl.formatMessage(globalMessages.failed)}
                    </Badge>
                  ) : (
                    <StatusBadge
                      status={
                        requestData.media[
                          requestData.is4k ? 'status4k' : 'status'
                        ]
                      }
                      downloadItem={
                        requestData.media[
                          requestData.is4k
                            ? 'downloadStatus4k'
                            : 'downloadStatus'
                        ]
                      }
                      title={intl.formatMessage(messages.unknowntitle)}
                      inProgress={
                        (
                          requestData.media[
                            requestData.is4k
                              ? 'downloadStatus4k'
                              : 'downloadStatus'
                          ] ?? []
                        ).length > 0
                      }
                      is4k={requestData.is4k}
                      mediaType={requestData.type}
                      plexUrl={requestData.is4k ? plexUrl4k : plexUrl}
                      serviceUrl={
                        requestData.is4k
                          ? requestData.media.serviceUrl4k
                          : requestData.media.serviceUrl
                      }
                    />
                  )}
                </div>
              </>
            )}
            <div className="flex flex-1 items-end space-x-2">
              {hasPermission(Permission.MANAGE_REQUESTS) &&
                requestData?.media.id && (
                  <>
                    <Button
                      buttonType="danger"
                      buttonSize="sm"
                      className="mt-4 hidden sm:block"
                      onClick={() => deleteRequest()}
                    >
                      <TrashIcon />
                      <span>{intl.formatMessage(globalMessages.delete)}</span>
                    </Button>
                    <Tooltip
                      content={intl.formatMessage(messages.deleterequest)}
                    >
                      <Button
                        buttonType="danger"
                        buttonSize="sm"
                        className="mt-4 sm:hidden"
                        onClick={() => deleteRequest()}
                      >
                        <TrashIcon />
                      </Button>
                    </Tooltip>
                  </>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface RequestCardProps {
  request: NonFunctionProperties<MediaRequest>;
  onTitleData?: (requestId: number, title: MovieDetails | TvDetails) => void;
}

const RequestCard = ({ request, onTitleData }: RequestCardProps) => {
  const settings = useSettings();
  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { addToast } = useToasts();
  const [isRetrying, setRetrying] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const url =
    request.type === 'movie'
      ? `/api/v1/movie/${request.media.tmdbId}`
      : `/api/v1/tv/${request.media.tmdbId}`;

  const { data: title, error } = useSWR<MovieDetails | TvDetails>(
    inView ? `${url}` : null
  );
  const {
    data: requestData,
    error: requestError,
    mutate: revalidate,
  } = useSWR<NonFunctionProperties<MediaRequest>>(
    `/api/v1/request/${request.id}`,
    {
      fallbackData: request,
      refreshInterval: refreshIntervalHelper(
        {
          downloadStatus: request.media.downloadStatus,
          downloadStatus4k: request.media.downloadStatus4k,
        },
        15000
      ),
    }
  );

  const { mediaUrl: plexUrl, mediaUrl4k: plexUrl4k } = useDeepLinks({
    mediaUrl: requestData?.media?.mediaUrl,
    mediaUrl4k: requestData?.media?.mediaUrl4k,
    iOSPlexUrl: requestData?.media?.iOSPlexUrl,
    iOSPlexUrl4k: requestData?.media?.iOSPlexUrl4k,
  });

  const modifyRequest = async (type: 'approve' | 'decline') => {
    const response = await axios.post(`/api/v1/request/${request.id}/${type}`);

    if (response) {
      revalidate();
      mutate('/api/v1/request/count');
    }
  };

  const deleteRequest = async () => {
    await axios.delete(`/api/v1/request/${request.id}`);
    mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');
    mutate('/api/v1/request/count');
  };

  const retryRequest = async () => {
    setRetrying(true);

    try {
      const response = await axios.post(`/api/v1/request/${request.id}/retry`);

      if (response) {
        revalidate();
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.failedretry), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (title && onTitleData) {
      onTitleData(request.id, title);
    }
  }, [title, onTitleData, request]);

  if (!title && !error) {
    return (
      <div ref={ref}>
        <RequestCardPlaceholder />
      </div>
    );
  }

  if (!requestData && !requestError) {
    return <RequestCardError />;
  }

  if (!title || !requestData) {
    return <RequestCardError requestData={requestData} />;
  }

  return (
    <>
      <RequestModal
        show={showEditModal}
        tmdbId={request.media.tmdbId}
        type={request.type}
        is4k={request.is4k}
        editRequest={request}
        onCancel={() => setShowEditModal(false)}
        onComplete={() => {
          revalidate();
          setShowEditModal(false);
        }}
      />
      <div
        className="relative flex w-72 overflow-hidden rounded-xl bg-gray-800 bg-cover bg-center p-4 text-gray-400 shadow ring-1 ring-gray-700 sm:w-96"
        data-testid="request-card"
      >
        {title.backdropPath && (
          <div className="absolute inset-0 z-0">
            <CachedImage
              type="tmdb"
              alt=""
              src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${title.backdropPath}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 75%)',
              }}
            />
          </div>
        )}
        <div
          className="relative z-10 flex min-w-0 flex-1 flex-col pr-4"
          data-testid="request-card-title"
        >
          <div className="hidden text-xs font-medium text-white sm:flex">
            {(isMovie(title) ? title.releaseDate : title.firstAirDate)?.slice(
              0,
              4
            )}
          </div>
          <Link
            href={
              request.type === 'movie'
                ? `/movie/${requestData.media.tmdbId}`
                : `/tv/${requestData.media.tmdbId}`
            }
            className="overflow-hidden overflow-ellipsis whitespace-nowrap text-base font-bold text-white hover:underline sm:text-lg"
          >
            {isMovie(title) ? title.title : title.name}
          </Link>
          {hasPermission(
            [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
            { type: 'or' }
          ) && (
            <div className="card-field">
              <Link
                href={`/users/${requestData.requestedBy.id}`}
                className="group flex items-center"
              >
                <span className="avatar-sm">
                  <CachedImage
                    type="avatar"
                    src={requestData.requestedBy.avatar}
                    alt=""
                    className="avatar-sm object-cover"
                    width={20}
                    height={20}
                  />
                </span>
                <span className="truncate font-semibold group-hover:text-white group-hover:underline">
                  {requestData.requestedBy.displayName}
                </span>
              </Link>
            </div>
          )}
          {!isMovie(title) && request.seasons.length > 0 && (
            <div className="my-0.5 hidden items-center text-sm sm:my-1 sm:flex">
              <span className="mr-2 font-bold ">
                {intl.formatMessage(messages.seasons, {
                  seasonCount:
                    (settings.currentSettings.enableSpecialEpisodes
                      ? title.seasons.length
                      : title.seasons.filter(
                          (season) => season.seasonNumber !== 0
                        ).length) === request.seasons.length
                      ? 0
                      : request.seasons.length,
                })}
              </span>
              <div className="hide-scrollbar overflow-x-scroll">
                {request.seasons.map((season) => (
                  <span key={`season-${season.id}`} className="mr-2">
                    <Badge>
                      {season.seasonNumber === 0
                        ? intl.formatMessage(globalMessages.specials)
                        : season.seasonNumber}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center text-sm sm:mt-1">
            <span className="mr-2 hidden font-bold sm:block">
              {intl.formatMessage(globalMessages.status)}
            </span>
            {requestData.status === MediaRequestStatus.DECLINED ? (
              <Badge badgeType="danger">
                {intl.formatMessage(globalMessages.declined)}
              </Badge>
            ) : requestData.status === MediaRequestStatus.FAILED ? (
              <Badge
                badgeType="danger"
                href={`/${requestData.type}/${requestData.media.tmdbId}?manage=1`}
              >
                {intl.formatMessage(globalMessages.failed)}
              </Badge>
            ) : requestData.status === MediaRequestStatus.PENDING &&
              requestData.media[requestData.is4k ? 'status4k' : 'status'] ===
                MediaStatus.DELETED ? (
              <Badge
                badgeType="warning"
                href={`/${requestData.type}/${requestData.media.tmdbId}?manage=1`}
              >
                {intl.formatMessage(globalMessages.pending)}
              </Badge>
            ) : (
              <StatusBadge
                status={
                  requestData.media[requestData.is4k ? 'status4k' : 'status']
                }
                downloadItem={
                  requestData.media[
                    requestData.is4k ? 'downloadStatus4k' : 'downloadStatus'
                  ]
                }
                title={isMovie(title) ? title.title : title.name}
                inProgress={
                  (
                    requestData.media[
                      requestData.is4k ? 'downloadStatus4k' : 'downloadStatus'
                    ] ?? []
                  ).length > 0
                }
                is4k={requestData.is4k}
                tmdbId={requestData.media.tmdbId}
                mediaType={requestData.type}
                plexUrl={requestData.is4k ? plexUrl4k : plexUrl}
                serviceUrl={
                  requestData.is4k
                    ? requestData.media.serviceUrl4k
                    : requestData.media.serviceUrl
                }
              />
            )}
          </div>
          <div className="flex flex-1 items-end space-x-2">
            {requestData.status === MediaRequestStatus.FAILED &&
              hasPermission(Permission.MANAGE_REQUESTS) && (
                <Button
                  buttonType="primary"
                  buttonSize="sm"
                  disabled={isRetrying}
                  onClick={() => retryRequest()}
                >
                  <ArrowPathIcon
                    className={isRetrying ? 'animate-spin' : ''}
                    style={{ marginRight: '0', animationDirection: 'reverse' }}
                  />
                  <span className="ml-1.5 hidden sm:block">
                    {intl.formatMessage(globalMessages.retry)}
                  </span>
                </Button>
              )}
            {requestData.status === MediaRequestStatus.PENDING &&
              hasPermission(Permission.MANAGE_REQUESTS) && (
                <>
                  <div>
                    <Button
                      buttonType="success"
                      buttonSize="sm"
                      className="hidden sm:block"
                      onClick={() => modifyRequest('approve')}
                    >
                      <CheckIcon />
                      <span>{intl.formatMessage(globalMessages.approve)}</span>
                    </Button>
                    <Tooltip
                      content={intl.formatMessage(messages.approverequest)}
                    >
                      <Button
                        buttonType="success"
                        buttonSize="sm"
                        className="sm:hidden"
                        onClick={() => modifyRequest('approve')}
                      >
                        <CheckIcon />
                      </Button>
                    </Tooltip>
                  </div>
                  <div>
                    <Button
                      buttonType="danger"
                      buttonSize="sm"
                      className="hidden sm:block"
                      onClick={() => modifyRequest('decline')}
                    >
                      <XMarkIcon />
                      <span>{intl.formatMessage(globalMessages.decline)}</span>
                    </Button>
                    <Tooltip
                      content={intl.formatMessage(messages.declinerequest)}
                    >
                      <Button
                        buttonType="danger"
                        buttonSize="sm"
                        className="sm:hidden"
                        onClick={() => modifyRequest('decline')}
                      >
                        <XMarkIcon />
                      </Button>
                    </Tooltip>
                  </div>
                </>
              )}
            {requestData.status === MediaRequestStatus.PENDING &&
              !hasPermission(Permission.MANAGE_REQUESTS) &&
              requestData.requestedBy.id === user?.id &&
              (requestData.type === 'tv' ||
                hasPermission(Permission.REQUEST_ADVANCED)) && (
                <div>
                  {!hasPermission(Permission.MANAGE_REQUESTS) && (
                    <Button
                      buttonType="primary"
                      buttonSize="sm"
                      className="hidden sm:block"
                      onClick={() => setShowEditModal(true)}
                    >
                      <PencilIcon />
                      <span>{intl.formatMessage(globalMessages.edit)}</span>
                    </Button>
                  )}
                  <Tooltip content={intl.formatMessage(messages.editrequest)}>
                    <Button
                      buttonType="primary"
                      buttonSize="sm"
                      className="sm:hidden"
                      onClick={() => setShowEditModal(true)}
                    >
                      <PencilIcon />
                    </Button>
                  </Tooltip>
                </div>
              )}
            {requestData.status === MediaRequestStatus.PENDING &&
              !hasPermission(Permission.MANAGE_REQUESTS) &&
              requestData.requestedBy.id === user?.id && (
                <div>
                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    className="hidden sm:block"
                    onClick={() => deleteRequest()}
                  >
                    <XMarkIcon />
                    <span>{intl.formatMessage(globalMessages.cancel)}</span>
                  </Button>
                  <Tooltip content={intl.formatMessage(messages.cancelrequest)}>
                    <Button
                      buttonType="danger"
                      buttonSize="sm"
                      className="sm:hidden"
                      onClick={() => deleteRequest()}
                    >
                      <XMarkIcon />
                    </Button>
                  </Tooltip>
                </div>
              )}
          </div>
        </div>
        <Link
          href={
            request.type === 'movie'
              ? `/movie/${requestData.media.tmdbId}`
              : `/tv/${requestData.media.tmdbId}`
          }
          className="w-20 flex-shrink-0 scale-100 transform-gpu cursor-pointer overflow-hidden rounded-md shadow-sm transition duration-300 hover:scale-105 hover:shadow-md sm:w-28"
        >
          <CachedImage
            type="tmdb"
            src={
              title.posterPath
                ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${title.posterPath}`
                : '/images/jellyseerr_poster_not_found.png'
            }
            alt=""
            sizes="100vw"
            style={{ width: '100%', height: 'auto' }}
            width={600}
            height={900}
          />
        </Link>
      </div>
    </>
  );
};

export default withProperties(RequestCard, {
  Placeholder: RequestCardPlaceholder,
});
