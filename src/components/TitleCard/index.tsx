import Spinner from '@app/assets/spinner.svg';
import BlocklistModal from '@app/components/BlocklistModal';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import ErrorCard from '@app/components/TitleCard/ErrorCard';
import Placeholder from '@app/components/TitleCard/Placeholder';
import { useIsTouch } from '@app/hooks/useIsTouch';
import useSettings from '@app/hooks/useSettings';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { withProperties } from '@app/utils/typeHelpers';
import { Transition } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
  MinusCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import type { Watchlist } from '@server/entity/Watchlist';
import type { MovieDetails } from '@server/models/Movie';
import type { MediaType } from '@server/models/Search';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import { mutate } from 'swr';
import useSWR from 'swr';

interface TitleCardProps {
  id: number;
  image?: string;
  summary?: string;
  year?: string;
  title: string;
  userScore?: number;
  mediaType: MediaType;
  status?: MediaStatus;
  canExpand?: boolean;
  inProgress?: boolean;
  isAddedToWatchlist?: number | boolean;
  mutateParent?: () => void;
}

const messages = defineMessages('components.TitleCard', {
  addToWatchList: 'Add to watchlist',
  watchlistSuccess:
    '<strong>{title}</strong> added to watchlist  successfully!',
  watchlistDeleted:
    '<strong>{title}</strong> Removed from watchlist  successfully!',
  watchlistCancel: 'watchlist for <strong>{title}</strong> canceled.',
  watchlistError: 'Something went wrong. Please try again.',
  watchonprovider: 'Available on {provider}',
});

const TitleCard = ({
  id,
  image,
  summary,
  year,
  title,
  status,
  mediaType,
  isAddedToWatchlist = false,
  inProgress = false,
  canExpand = false,
  mutateParent,
}: TitleCardProps) => {
  const isTouch = useIsTouch();
  const intl = useIntl();
  const { currentSettings } = useSettings();
  const { user, hasPermission } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [showDetail, setShowDetail] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const { addToast } = useToasts();
  const [toggleWatchlist, setToggleWatchlist] =
    useState<boolean>(!isAddedToWatchlist);
  const [showBlocklistModal, setShowBlocklistModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Compute excluded streaming providers from user/global settings
  const streamingRegion =
    user?.settings?.streamingRegion ??
    currentSettings.streamingRegion ??
    'US';
  const excludedWatchProviderIds = (
    user?.settings?.excludedWatchProviders ??
    currentSettings.excludedWatchProviders ??
    ''
  )
    .split('|')
    .filter(Boolean)
    .map(Number);

  // Lazy-fetch full details only when excluded providers are configured and
  // the card is a movie or TV show (no extra calls when the feature is unused).
  const shouldFetchDetails =
    excludedWatchProviderIds.length > 0 &&
    (mediaType === 'movie' || mediaType === 'tv');
  const detailsUrl = shouldFetchDetails
    ? `/api/v1/${mediaType === 'movie' ? 'movie' : 'tv'}/${id}`
    : null;
  const { data: details } = useSWR<MovieDetails | TvDetails>(detailsUrl);

  const watchProvidersForRegion = details?.watchProviders?.find(
    (p) => p.iso_3166_1 === streamingRegion
  );
  const streamingProviders = watchProvidersForRegion?.flatrate ?? [];
  const watchProviderLink = watchProvidersForRegion?.link;
  const firstExcludedProvider = streamingProviders.find((p) =>
    excludedWatchProviderIds.includes(p.id)
  );
  const isAvailableOnExcludedProvider =
    excludedWatchProviderIds.length > 0 &&
    streamingProviders.some((p) => excludedWatchProviderIds.includes(p.id));

  // Just to get the year from the date
  if (year) {
    year = year.slice(0, 4);
  }

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const requestComplete = useCallback((newStatus: MediaStatus) => {
    setCurrentStatus(newStatus);
    setShowRequestModal(false);
  }, []);

  const requestUpdating = useCallback(
    (status: boolean) => setIsUpdating(status),
    []
  );

  const closeBlocklistModal = useCallback(
    () => setShowBlocklistModal(false),
    []
  );

  const onClickWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const response = await axios.post<Watchlist>('/api/v1/watchlist', {
        tmdbId: id,
        mediaType,
        title,
      });
      mutate('/api/v1/discover/watchlist');
      if (response.data) {
        addToast(
          <span>
            {intl.formatMessage(messages.watchlistSuccess, {
              title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
      setToggleWatchlist((prevState) => !prevState);
    }
  };

  const onClickDeleteWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const response = await axios.delete<Watchlist>('/api/v1/watchlist/' + id);

      if (response.status === 204) {
        addToast(
          <span>
            {intl.formatMessage(messages.watchlistDeleted, {
              title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'info', autoDismiss: true }
        );
      }
    } catch (e) {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
      mutate('/api/v1/discover/watchlist');
      if (mutateParent) {
        mutateParent();
      }
      setToggleWatchlist((prevState) => !prevState);
    }
  };

  const onClickHideItemBtn = async (): Promise<void> => {
    setIsUpdating(true);
    const topNode = cardRef.current;

    if (topNode) {
      try {
        await axios.post('/api/v1/blocklist', {
          tmdbId: id,
          mediaType,
          title,
          user: user?.id,
        });
        addToast(
          <span>
            {intl.formatMessage(globalMessages.blocklistSuccess, {
              title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
        setCurrentStatus(MediaStatus.BLOCKLISTED);
      } catch (e) {
        if (e?.response?.status === 412) {
          addToast(
            <span>
              {intl.formatMessage(globalMessages.blocklistDuplicateError, {
                title,
                strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
              })}
            </span>,
            { appearance: 'info', autoDismiss: true }
          );
        } else {
          addToast(intl.formatMessage(globalMessages.blocklistError), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      }

      setIsUpdating(false);
      closeBlocklistModal();
    } else {
      addToast(intl.formatMessage(globalMessages.blocklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const onClickShowBlocklistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    const topNode = cardRef.current;

    if (topNode) {
      const res = await axios.delete('/api/v1/blocklist/' + id);

      if (res.status === 204) {
        addToast(
          <span>
            {intl.formatMessage(globalMessages.removeFromBlocklistSuccess, {
              title,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
        setCurrentStatus(MediaStatus.UNKNOWN);
      } else {
        addToast(intl.formatMessage(globalMessages.blocklistError), {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    } else {
      addToast(intl.formatMessage(globalMessages.blocklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    setIsUpdating(false);
  };

  const closeModal = useCallback(() => setShowRequestModal(false), []);

  const showRequestButton = hasPermission(
    [
      Permission.REQUEST,
      mediaType === 'movie' || mediaType === 'collection'
        ? Permission.REQUEST_MOVIE
        : Permission.REQUEST_TV,
    ],
    { type: 'or' }
  );

  const showHideButton = hasPermission([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  });

  return (
    <div
      className={canExpand ? 'w-full' : 'w-36 sm:w-36 md:w-44'}
      data-testid="title-card"
      ref={cardRef}
    >
      <RequestModal
        tmdbId={id}
        show={showRequestModal}
        type={
          mediaType === 'movie'
            ? 'movie'
            : mediaType === 'collection'
              ? 'collection'
              : 'tv'
        }
        onComplete={requestComplete}
        onUpdating={requestUpdating}
        onCancel={closeModal}
      />
      <BlocklistModal
        tmdbId={id}
        type={
          mediaType === 'movie'
            ? 'movie'
            : mediaType === 'collection'
              ? 'collection'
              : 'tv'
        }
        show={showBlocklistModal}
        onCancel={closeBlocklistModal}
        onComplete={onClickHideItemBtn}
        isUpdating={isUpdating}
      />
      <div
        className={`relative transform-gpu cursor-default overflow-hidden rounded-xl bg-gray-800 bg-cover outline-none ring-1 transition duration-300 ${
          showDetail
            ? 'scale-105 shadow-lg ring-gray-500'
            : 'scale-100 shadow ring-gray-700'
        }`}
        style={{
          paddingBottom: '150%',
        }}
        onMouseEnter={() => {
          if (!isTouch) {
            setShowDetail(true);
          }
        }}
        onMouseLeave={() => setShowDetail(false)}
        onClick={() => setShowDetail(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setShowDetail(true);
          }
        }}
        role="link"
        tabIndex={0}
      >
        <div className="absolute inset-0 h-full w-full overflow-hidden">
          <CachedImage
            type="tmdb"
            className={`absolute inset-0 h-full w-full${isAvailableOnExcludedProvider ? ' opacity-40' : ''}`}
            alt=""
            src={
              image
                ? `https://image.tmdb.org/t/p/w300_and_h450_face${image}`
                : `/images/seerr_poster_not_found_logo_top.png`
            }
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          {isAvailableOnExcludedProvider &&
            !showDetail &&
            firstExcludedProvider?.logoPath && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <CachedImage
                  type="tmdb"
                  src={`https://image.tmdb.org/t/p/w92${firstExcludedProvider.logoPath}`}
                  alt={firstExcludedProvider.name}
                  width={64}
                  height={64}
                  className="rounded-xl shadow-lg"
                />
              </div>
            )}
          <div className="absolute left-0 right-0 flex items-center justify-between p-2">
            <div
              className={`pointer-events-none z-40 self-start rounded-full border bg-opacity-80 shadow-md ${
                mediaType === 'movie' || mediaType === 'collection'
                  ? 'border-blue-500 bg-blue-600'
                  : 'border-purple-600 bg-purple-600'
              }`}
            >
              <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-white sm:h-5">
                {mediaType === 'movie'
                  ? intl.formatMessage(globalMessages.movie)
                  : mediaType === 'collection'
                    ? intl.formatMessage(globalMessages.collection)
                    : intl.formatMessage(globalMessages.tvshow)}
              </div>
            </div>
            {showDetail && currentStatus !== MediaStatus.BLOCKLISTED && (
              <div className="flex flex-col gap-1">
                {user?.userType !== UserType.PLEX &&
                  (toggleWatchlist ? (
                    <Button
                      buttonType={'ghost'}
                      className="z-40"
                      buttonSize={'sm'}
                      onClick={onClickWatchlistBtn}
                    >
                      <StarIcon className={'h-3 text-amber-300'} />
                    </Button>
                  ) : (
                    <Button
                      className="z-40"
                      buttonSize={'sm'}
                      onClick={onClickDeleteWatchlistBtn}
                    >
                      <MinusCircleIcon className={'h-3'} />
                    </Button>
                  ))}
                {showHideButton &&
                  currentStatus !== MediaStatus.PROCESSING &&
                  currentStatus !== MediaStatus.AVAILABLE &&
                  currentStatus !== MediaStatus.PARTIALLY_AVAILABLE &&
                  currentStatus !== MediaStatus.PENDING && (
                    <Button
                      buttonType={'ghost'}
                      className="z-40"
                      buttonSize={'sm'}
                      onClick={() => setShowBlocklistModal(true)}
                    >
                      <EyeSlashIcon className={'h-3'} />
                    </Button>
                  )}
              </div>
            )}
            {showDetail &&
              showHideButton &&
              currentStatus == MediaStatus.BLOCKLISTED && (
                <Tooltip
                  content={intl.formatMessage(
                    globalMessages.removefromBlocklist
                  )}
                >
                  <Button
                    buttonType={'ghost'}
                    className="z-40"
                    buttonSize={'sm'}
                    onClick={() => onClickShowBlocklistBtn()}
                  >
                    <EyeIcon className={'h-3'} />
                  </Button>
                </Tooltip>
              )}
            {currentStatus && currentStatus !== MediaStatus.UNKNOWN && (
              <div className="flex flex-col items-center gap-1">
                <div className="pointer-events-none z-40 flex">
                  <StatusBadgeMini
                    status={currentStatus}
                    inProgress={inProgress}
                    shrink
                  />
                </div>
              </div>
            )}
          </div>
          <Transition
            as={Fragment}
            show={isUpdating}
            enter="transition-opacity ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-gray-800 bg-opacity-75 text-white">
              <Spinner className="h-10 w-10" />
            </div>
          </Transition>

          <Transition
            as={Fragment}
            show={!image || showDetail || showRequestModal}
            enter="transition-opacity"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <Link
                href={
                  mediaType === 'movie'
                    ? `/movie/${id}`
                    : mediaType === 'collection'
                      ? `/collection/${id}`
                      : `/tv/${id}`
                }
                className="absolute inset-0 h-full w-full cursor-pointer overflow-hidden text-left"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(45, 55, 72, 0.4) 0%, rgba(45, 55, 72, 0.9) 100%)',
                }}
              >
                <div className="flex h-full w-full items-end">
                  <div
                    className={`px-2 text-white ${
                      !showRequestButton ||
                      (currentStatus &&
                        currentStatus !== MediaStatus.UNKNOWN &&
                        currentStatus !== MediaStatus.DELETED)
                        ? 'pb-2'
                        : 'pb-11'
                    }`}
                  >
                    {year && <div className="text-sm font-medium">{year}</div>}

                    <h1
                      className="whitespace-normal text-xl font-bold leading-tight"
                      style={{
                        WebkitLineClamp: 3,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}
                      data-testid="title-card-title"
                    >
                      {title}
                    </h1>
                    <div
                      className="whitespace-normal text-xs"
                      style={{
                        WebkitLineClamp:
                          !showRequestButton ||
                          (currentStatus &&
                            currentStatus !== MediaStatus.UNKNOWN &&
                            currentStatus !== MediaStatus.DELETED)
                            ? 5
                            : 3,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}
                    >
                      {summary}
                    </div>
                  </div>
                </div>
              </Link>

              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-2">
                {showRequestButton &&
                  (!currentStatus ||
                    currentStatus === MediaStatus.UNKNOWN ||
                    currentStatus === MediaStatus.DELETED) &&
                  (isAvailableOnExcludedProvider &&
                  firstExcludedProvider &&
                  watchProviderLink ? (
                    <Tooltip
                      content={intl.formatMessage(messages.watchonprovider, {
                        provider: firstExcludedProvider.name,
                      })}
                    >
                      <Button
                        as="a"
                        href={watchProviderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        buttonType="primary"
                        buttonSize="sm"
                        className="h-7 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {firstExcludedProvider.logoPath && (
                          <CachedImage
                            type="tmdb"
                            src={`https://image.tmdb.org/t/p/w45${firstExcludedProvider.logoPath}`}
                            alt={firstExcludedProvider.name}
                            width={16}
                            height={16}
                            className="mr-1 rounded"
                          />
                        )}
                        <span>{firstExcludedProvider.name}</span>
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button
                      buttonType="primary"
                      buttonSize="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowRequestModal(true);
                      }}
                      className="h-7 w-full"
                    >
                      <ArrowDownTrayIcon />
                      <span>{intl.formatMessage(globalMessages.request)}</span>
                    </Button>
                  ))}
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
};

export default withProperties(TitleCard, { Placeholder, ErrorCard });
