import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import RequestModal from '@app/components/RequestModal';
import StatusBadge from '@app/components/StatusBadge';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
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
import type { RequestResultsResponse } from '@server/interfaces/api/requestInterfaces';
import type { BookDetails } from '@server/models/Book';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { FormattedRelativeTime, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestList.RequestItem', {
  seasons: '{seasonCount, plural, one {Season} other {Seasons}}',
  failedretry: 'Something went wrong while retrying the request.',
  requested: 'Requested',
  requesteddate: 'Requested',
  modified: 'Modified',
  modifieduserdate: '{date} by {user}',
  mediaerror: '{mediaType} Not Found',
  editrequest: 'Edit Request',
  deleterequest: 'Delete Request',
  cancelRequest: 'Cancel Request',
  tmdbid: 'TMDB ID',
  tvdbid: 'TheTVDB ID',
  unknowntitle: 'Unknown Title',
  removearr: 'Remove from {arr}',
  profileName: 'Profile',
  metadataProfileName: 'Metadata Profile',
});

const isMovie = (
  movie: MovieDetails | TvDetails | BookDetails
): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

const isBook = (
  book: MovieDetails | TvDetails | BookDetails
): book is BookDetails => {
  return (book as BookDetails).author !== undefined;
};

interface RequestItemErrorProps {
  requestData?: NonFunctionProperties<MediaRequest>;
  revalidateList: () => void;
}

const RequestItemError = ({
  requestData,
  revalidateList,
}: RequestItemErrorProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();

  const deleteRequest = async () => {
    await axios.delete(`/api/v1/media/${requestData?.media.id}`);
    revalidateList();
    mutate('/api/v1/request/count');
  };

  const { mediaUrl: plexUrl, mediaUrlAlt: plexUrlAlt } = useDeepLinks({
    mediaUrl: requestData?.media?.mediaUrl,
    mediaUrlAlt: requestData?.media?.mediaUrlAlt,
    iOSPlexUrl: requestData?.media?.iOSPlexUrl,
    iOSPlexUrlAlt: requestData?.media?.iOSPlexUrlAlt,
  });

  return (
    <div className="flex h-64 w-full flex-col justify-center rounded-xl bg-gray-800 py-4 text-gray-400 shadow-md ring-1 ring-red-500 xl:h-28 xl:flex-row">
      <div className="flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="flex w-full flex-col justify-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          <div className="flex text-lg font-bold text-white xl:text-xl">
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
          {requestData && hasPermission(Permission.MANAGE_REQUESTS) && (
            <>
              <div className="card-field">
                <span className="card-field-name">
                  {intl.formatMessage(messages.tmdbid)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  {requestData.media.tmdbId}
                </span>
              </div>
              {requestData.media.tvdbId && (
                <div className="card-field">
                  <span className="card-field-name">
                    {intl.formatMessage(messages.tvdbid)}
                  </span>
                  <span className="flex truncate text-sm text-gray-300">
                    {requestData?.media.tvdbId}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-4 ml-4 flex w-full flex-col justify-center overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          {requestData && (
            <>
              <div className="card-field">
                <span className="card-field-name">
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
                        requestData.isAlt ? 'statusAlt' : 'status'
                      ]
                    }
                    downloadItem={
                      requestData.media[
                        requestData.isAlt
                          ? 'downloadStatusAlt'
                          : 'downloadStatus'
                      ]
                    }
                    title={intl.formatMessage(messages.unknowntitle)}
                    inProgress={
                      (
                        requestData.media[
                          requestData.isAlt
                            ? 'downloadStatusAlt'
                            : 'downloadStatus'
                        ] ?? []
                      ).length > 0
                    }
                    isAlt={requestData.isAlt}
                    mediaType={requestData.type}
                    plexUrl={requestData.isAlt ? plexUrlAlt : plexUrl}
                    serviceUrl={
                      requestData.isAlt
                        ? requestData.media.serviceUrlAlt
                        : requestData.media.serviceUrl
                    }
                  />
                )}
              </div>
              <div className="card-field">
                {hasPermission(
                  [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                  { type: 'or' }
                ) ? (
                  <>
                    <span className="card-field-name">
                      {intl.formatMessage(messages.requested)}
                    </span>
                    <span className="flex truncate text-sm text-gray-300">
                      {intl.formatMessage(messages.modifieduserdate, {
                        date: (
                          <FormattedRelativeTime
                            value={Math.floor(
                              (new Date(requestData.createdAt).getTime() -
                                Date.now()) /
                                1000
                            )}
                            updateIntervalInSeconds={1}
                            numeric="auto"
                          />
                        ),
                        user: (
                          <Link
                            href={`/users/${requestData.requestedBy.id}`}
                            className="group flex items-center truncate"
                          >
                            <span className="avatar-sm ml-1.5">
                              <CachedImage
                                type="avatar"
                                src={requestData.requestedBy.avatar}
                                alt=""
                                className="avatar-sm object-cover"
                                width={20}
                                height={20}
                              />
                            </span>
                            <span className="truncate text-sm group-hover:underline">
                              {requestData.requestedBy.displayName}
                            </span>
                          </Link>
                        ),
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="card-field-name">
                      {intl.formatMessage(messages.requesteddate)}
                    </span>
                    <span className="flex truncate text-sm text-gray-300">
                      <FormattedRelativeTime
                        value={Math.floor(
                          (new Date(requestData.createdAt).getTime() -
                            Date.now()) /
                            1000
                        )}
                        updateIntervalInSeconds={1}
                        numeric="auto"
                      />
                    </span>
                  </>
                )}
              </div>
              {requestData.modifiedBy && (
                <div className="card-field">
                  <span className="card-field-name">
                    {intl.formatMessage(messages.modified)}
                  </span>
                  <span className="flex truncate text-sm text-gray-300">
                    {intl.formatMessage(messages.modifieduserdate, {
                      date: (
                        <FormattedRelativeTime
                          value={Math.floor(
                            (new Date(requestData.updatedAt).getTime() -
                              Date.now()) /
                              1000
                          )}
                          updateIntervalInSeconds={1}
                          numeric="auto"
                        />
                      ),
                      user: (
                        <Link
                          href={`/users/${requestData.modifiedBy.id}`}
                          className="group flex items-center truncate"
                        >
                          <span className="avatar-sm ml-1.5">
                            <CachedImage
                              type="avatar"
                              src={requestData.modifiedBy.avatar}
                              alt=""
                              className="avatar-sm object-cover"
                              width={20}
                              height={20}
                            />
                          </span>
                          <span className="truncate text-sm group-hover:underline">
                            {requestData.modifiedBy.displayName}
                          </span>
                        </Link>
                      ),
                    })}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="z-10 mt-4 flex w-full flex-col justify-center pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
        {hasPermission(Permission.MANAGE_REQUESTS) && requestData?.media.id && (
          <Button
            className="w-full"
            buttonType="danger"
            onClick={() => deleteRequest()}
          >
            <TrashIcon />
            <span>{intl.formatMessage(messages.deleterequest)}</span>
          </Button>
        )}
      </div>
    </div>
  );
};

interface RequestItemProps {
  request: RequestResultsResponse['results'][number];
  revalidateList: () => void;
}

const RequestItem = ({ request, revalidateList }: RequestItemProps) => {
  const settings = useSettings();
  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const { addToast } = useToasts();
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const [showEditModal, setShowEditModal] = useState(false);
  const url =
    request.type === 'movie'
      ? `/api/v1/movie/${request.media.tmdbId}`
      : request.type === 'book'
      ? `/api/v1/book/${request.media.hcId}`
      : `/api/v1/tv/${request.media.tmdbId}`;
  const { data: title, error } = useSWR<MovieDetails | TvDetails | BookDetails>(
    inView ? url : null
  );
  const { data: requestData, mutate: revalidate } = useSWR<
    NonFunctionProperties<MediaRequest>
  >(`/api/v1/request/${request.id}`, {
    fallbackData: request,
    refreshInterval: refreshIntervalHelper(
      {
        downloadStatus: request.media.downloadStatus,
        downloadStatusAlt: request.media.downloadStatusAlt,
      },
      15000
    ),
  });

  const [isRetrying, setRetrying] = useState(false);

  const modifyRequest = async (type: 'approve' | 'decline') => {
    const response = await axios.post(`/api/v1/request/${request.id}/${type}`);

    if (response) {
      revalidate();
      mutate('/api/v1/request/count');
    }
  };

  const deleteRequest = async () => {
    await axios.delete(`/api/v1/request/${request.id}`);

    revalidateList();
    mutate('/api/v1/request/count');
  };

  const deleteMediaFile = async () => {
    if (request.media) {
      await axios.delete(
        `/api/v1/media/${request.media.id}/file?isAlt=${request.isAlt}`
      );
      await axios.delete(`/api/v1/media/${request.media.id}`);
      revalidateList();
    }
  };

  const retryRequest = async () => {
    setRetrying(true);

    try {
      const result = await axios.post(`/api/v1/request/${request.id}/retry`);
      revalidate(result.data);
    } catch (e) {
      addToast(intl.formatMessage(messages.failedretry), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setRetrying(false);
    }
  };

  const { mediaUrl: plexUrl, mediaUrlAlt: plexUrlAlt } = useDeepLinks({
    mediaUrl: requestData?.media?.mediaUrl,
    mediaUrlAlt: requestData?.media?.mediaUrlAlt,
    iOSPlexUrl: requestData?.media?.iOSPlexUrl,
    iOSPlexUrlAlt: requestData?.media?.iOSPlexUrlAlt,
  });

  if (!title && !error) {
    return (
      <div
        className="h-64 w-full animate-pulse rounded-xl bg-gray-800 xl:h-28"
        ref={ref}
      />
    );
  }

  if (!title || !requestData) {
    return (
      <RequestItemError
        requestData={requestData}
        revalidateList={revalidateList}
      />
    );
  }

  return (
    <>
      <RequestModal
        show={showEditModal}
        mediaId={request.media.hcId || request.media.tmdbId}
        type={request.type}
        isAlt={request.isAlt}
        editRequest={request}
        onCancel={() => setShowEditModal(false)}
        onComplete={() => {
          revalidateList();
          setShowEditModal(false);
        }}
      />
      <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-2 text-gray-400 shadow-md ring-1 ring-gray-700 xl:h-28 xl:flex-row">
        {title.backdropPath && (
          <div className="absolute inset-0 z-0 w-full bg-cover bg-center xl:w-2/3">
            <CachedImage
              type={requestData.type === 'book' ? 'hardcover' : 'tmdb'}
              src={title.backdropPath}
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
            <Link
              href={
                requestData.type === 'movie'
                  ? `/movie/${requestData.media.tmdbId}`
                  : requestData.type === 'book'
                  ? `/book/${requestData.media.hcId}`
                  : `/tv/${requestData.media.tmdbId}`
              }
              className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105"
            >
              <CachedImage
                type={requestData.type === 'book' ? 'hardcover' : 'tmdb'}
                src={
                  title.posterPath
                    ? title.posterPath
                    : '/images/jellyseerr_poster_not_found.png'
                }
                alt=""
                sizes="100vw"
                style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                width={600}
                height={900}
              />
            </Link>
            <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
              <div className="pt-0.5 text-xs font-medium text-white sm:pt-1">
                {(isMovie(title) || isBook(title)
                  ? title.releaseDate
                  : title.firstAirDate
                )?.slice(0, 4)}
              </div>
              <Link
                href={
                  requestData.type === 'movie'
                    ? `/movie/${requestData.media.tmdbId}`
                    : requestData.type === 'book'
                    ? `/book/${requestData.media.hcId}`
                    : `/tv/${requestData.media.tmdbId}`
                }
                className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl"
              >
                {isMovie(title) || isBook(title) ? title.title : title.name}
              </Link>
              {!isMovie(title) &&
                !isBook(title) &&
                request.seasons.length > 0 && (
                  <div className="card-field">
                    <span className="card-field-name">
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
                    <div className="hide-scrollbar flex flex-nowrap overflow-x-scroll">
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
            </div>
          </div>
          <div className="z-10 mt-4 ml-4 flex w-full flex-col justify-center gap-1 overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
            <div className="card-field">
              <span className="card-field-name">
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
                requestData.media[
                  requestData.isAlt ? 'statusAlt' : 'status'
                ] === MediaStatus.DELETED ? (
                <Badge
                  badgeType="warning"
                  href={`/${requestData.type}/${requestData.media.tmdbId}?manage=1`}
                >
                  {intl.formatMessage(globalMessages.pending)}
                </Badge>
              ) : (
                <StatusBadge
                  status={
                    requestData.media[
                      requestData.isAlt ? 'statusAlt' : 'status'
                    ]
                  }
                  downloadItem={
                    requestData.media[
                      requestData.isAlt ? 'downloadStatusAlt' : 'downloadStatus'
                    ]
                  }
                  title={
                    isMovie(title) || isBook(title) ? title.title : title.name
                  }
                  inProgress={
                    (
                      requestData.media[
                        requestData.isAlt
                          ? 'downloadStatusAlt'
                          : 'downloadStatus'
                      ] ?? []
                    ).length > 0
                  }
                  isAlt={requestData.isAlt}
                  mediaId={requestData.media.tmdbId || requestData.media.hcId}
                  mediaType={requestData.type}
                  plexUrl={requestData.isAlt ? plexUrlAlt : plexUrl}
                  serviceUrl={
                    requestData.isAlt
                      ? requestData.media.serviceUrlAlt
                      : requestData.media.serviceUrl
                  }
                />
              )}
            </div>
            <div className="card-field">
              {hasPermission(
                [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                { type: 'or' }
              ) ? (
                <>
                  <span className="card-field-name">
                    {intl.formatMessage(messages.requested)}
                  </span>
                  <span className="flex truncate text-sm text-gray-300">
                    {intl.formatMessage(messages.modifieduserdate, {
                      date: (
                        <FormattedRelativeTime
                          value={Math.floor(
                            (new Date(requestData.createdAt).getTime() -
                              Date.now()) /
                              1000
                          )}
                          updateIntervalInSeconds={1}
                          numeric="auto"
                        />
                      ),
                      user: (
                        <Link
                          href={`/users/${requestData.requestedBy.id}`}
                          className="group flex items-center truncate"
                        >
                          <span className="avatar-sm ml-1.5">
                            <CachedImage
                              type="avatar"
                              src={requestData.requestedBy.avatar}
                              alt=""
                              className="avatar-sm object-cover"
                              width={20}
                              height={20}
                            />
                          </span>
                          <span className="truncate text-sm font-semibold group-hover:text-white group-hover:underline">
                            {requestData.requestedBy.displayName}
                          </span>
                        </Link>
                      ),
                    })}
                  </span>
                </>
              ) : (
                <>
                  <span className="card-field-name">
                    {intl.formatMessage(messages.requesteddate)}
                  </span>
                  <span className="flex truncate text-sm text-gray-300">
                    <FormattedRelativeTime
                      value={Math.floor(
                        (new Date(requestData.createdAt).getTime() -
                          Date.now()) /
                          1000
                      )}
                      updateIntervalInSeconds={1}
                      numeric="auto"
                    />
                  </span>
                </>
              )}
            </div>
            {requestData.modifiedBy && (
              <div className="card-field">
                <span className="card-field-name">
                  {intl.formatMessage(messages.modified)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  {intl.formatMessage(messages.modifieduserdate, {
                    date: (
                      <FormattedRelativeTime
                        value={Math.floor(
                          (new Date(requestData.updatedAt).getTime() -
                            Date.now()) /
                            1000
                        )}
                        updateIntervalInSeconds={1}
                        numeric="auto"
                      />
                    ),
                    user: (
                      <Link
                        href={`/users/${requestData.modifiedBy.id}`}
                        className="group flex items-center truncate"
                      >
                        <span className="avatar-sm ml-1.5">
                          <CachedImage
                            type="avatar"
                            src={requestData.modifiedBy.avatar}
                            alt=""
                            className="avatar-sm object-cover"
                            width={20}
                            height={20}
                          />
                        </span>
                        <span className="truncate text-sm font-semibold group-hover:text-white group-hover:underline">
                          {requestData.modifiedBy.displayName}
                        </span>
                      </Link>
                    ),
                  })}
                </span>
              </div>
            )}
            {request.profileName && (
              <div className="card-field">
                <span className="card-field-name">
                  {intl.formatMessage(messages.profileName)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  {request.profileName}
                </span>
              </div>
            )}
            {request.type === 'book' && request.metadataProfileName && (
              <div className="card-field">
                <span className="card-field-name">
                  {intl.formatMessage(messages.metadataProfileName)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  {request.metadataProfileName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="z-10 mt-4 flex w-full flex-col justify-center space-y-2 pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
          {requestData.status === MediaRequestStatus.FAILED &&
            hasPermission(Permission.MANAGE_REQUESTS) && (
              <Button
                className="w-full"
                buttonType="primary"
                disabled={isRetrying}
                onClick={() => retryRequest()}
              >
                <ArrowPathIcon
                  className={isRetrying ? 'animate-spin' : ''}
                  style={{ animationDirection: 'reverse' }}
                />
                <span>
                  {intl.formatMessage(
                    isRetrying ? globalMessages.retrying : globalMessages.retry
                  )}
                </span>
              </Button>
            )}
          {requestData.status !== MediaRequestStatus.PENDING &&
            hasPermission(Permission.MANAGE_REQUESTS) && (
              <>
                <ConfirmButton
                  onClick={() => deleteRequest()}
                  confirmText={intl.formatMessage(globalMessages.areyousure)}
                  className="w-full"
                >
                  <TrashIcon />
                  <span>{intl.formatMessage(messages.deleterequest)}</span>
                </ConfirmButton>
                {request.canRemove && (
                  <ConfirmButton
                    onClick={() => deleteMediaFile()}
                    confirmText={intl.formatMessage(globalMessages.areyousure)}
                    className="w-full"
                  >
                    <TrashIcon />
                    <span>
                      {intl.formatMessage(messages.removearr, {
                        arr:
                          request.type === 'movie'
                            ? 'Radarr'
                            : request.type === 'book'
                            ? 'Readarr'
                            : 'Sonarr',
                      })}
                    </span>
                  </ConfirmButton>
                )}
              </>
            )}
          {requestData.status === MediaRequestStatus.PENDING &&
            hasPermission(Permission.MANAGE_REQUESTS) && (
              <div className="flex w-full flex-row space-x-2">
                <span className="w-full">
                  <Button
                    className="w-full"
                    buttonType="success"
                    onClick={() => modifyRequest('approve')}
                  >
                    <CheckIcon />
                    <span>{intl.formatMessage(globalMessages.approve)}</span>
                  </Button>
                </span>
                <span className="w-full">
                  <Button
                    className="w-full"
                    buttonType="danger"
                    onClick={() => modifyRequest('decline')}
                  >
                    <XMarkIcon />
                    <span>{intl.formatMessage(globalMessages.decline)}</span>
                  </Button>
                </span>
              </div>
            )}
          {requestData.status === MediaRequestStatus.PENDING &&
            (hasPermission(Permission.MANAGE_REQUESTS) ||
              (requestData.requestedBy.id === user?.id &&
                (requestData.type === 'tv' ||
                  hasPermission(Permission.REQUEST_ADVANCED)))) && (
              <span className="w-full">
                <Button
                  className="w-full"
                  buttonType="primary"
                  onClick={() => setShowEditModal(true)}
                >
                  <PencilIcon />
                  <span>{intl.formatMessage(messages.editrequest)}</span>
                </Button>
              </span>
            )}
          {requestData.status === MediaRequestStatus.PENDING &&
            !hasPermission(Permission.MANAGE_REQUESTS) &&
            requestData.requestedBy.id === user?.id && (
              <ConfirmButton
                onClick={() => deleteRequest()}
                confirmText={intl.formatMessage(globalMessages.areyousure)}
                className="w-full"
              >
                <XMarkIcon />
                <span>{intl.formatMessage(messages.cancelRequest)}</span>
              </ConfirmButton>
            )}
        </div>
      </div>
    </>
  );
};

export default RequestItem;
