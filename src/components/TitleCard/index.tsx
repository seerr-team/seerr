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
import useToasts from '@app/hooks/useToasts';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { withProperties } from '@app/utils/typeHelpers';
import { Transition } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon,
  MinusCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import type { Watchlist } from '@server/entity/Watchlist';
import type { MediaType } from '@server/models/Search';
import axios from 'axios';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { mutate } from 'swr';

interface TitleCardProps {
  id: number;
  image?: string;
  summary?: string;
  year?: string;
  title: string;
  userScore?: number;
  mediaType: MediaType;
  status?: MediaStatus;
  status4k?: MediaStatus;
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
  available4k: '4K Available',
  partiallyavailable4k: '4K Partially Available',
  requested4k: '4K Requested',
});

const TitleCard = ({
  id,
  image,
  summary,
  year,
  title,
  status,
  status4k,
  mediaType,
  isAddedToWatchlist = false,
  inProgress = false,
  canExpand = false,
  mutateParent,
}: TitleCardProps) => {
  const isTouch = useIsTouch();
  const intl = useIntl();
  const settings = useSettings();
  const { user, hasPermission } = useUser();
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentStatus4k, setCurrentStatus4k] = useState(status4k);
  const [showDetail, setShowDetail] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRequest4kModal, setShowRequest4kModal] = useState(false);
  const { addToast } = useToasts();
  const [toggleWatchlist, setToggleWatchlist] =
    useState<boolean>(!isAddedToWatchlist);
  const [showBlocklistModal, setShowBlocklistModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Just to get the year from the date
  if (year) {
    year = year.slice(0, 4);
  }

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    setCurrentStatus4k(status4k);
  }, [status4k]);

  const requestComplete = useCallback((newStatus: MediaStatus) => {
    setCurrentStatus(newStatus);
    setShowRequestModal(false);
  }, []);

  const request4kComplete = useCallback((newStatus: MediaStatus) => {
    setCurrentStatus4k(newStatus);
    setShowRequest4kModal(false);
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
    } catch {
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
      const response = await axios.delete<Watchlist>(
        `/api/v1/watchlist/${id}?mediaType=${mediaType}`
      );

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
    } catch {
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
        if (mediaType === 'collection') {
          await axios.post(`/api/v1/blocklist/collection/${id}`);
        } else {
          await axios.post('/api/v1/blocklist', {
            tmdbId: id,
            mediaType,
            title,
            user: user?.id,
          });
        }
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
        if (mutateParent) {
          mutateParent();
        }
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
      try {
        if (mediaType === 'collection') {
          const res = await axios.delete(`/api/v1/blocklist/collection/${id}`);

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
            if (mutateParent) {
              mutateParent();
            }
          } else {
            addToast(intl.formatMessage(globalMessages.blocklistError), {
              appearance: 'error',
              autoDismiss: true,
            });
          }
        } else {
          const res = await axios.delete(
            `/api/v1/blocklist/${id}?mediaType=${mediaType}`
          );

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
            if (mutateParent) {
              mutateParent();
            }
          } else {
            addToast(intl.formatMessage(globalMessages.blocklistError), {
              appearance: 'error',
              autoDismiss: true,
            });
          }
        }
      } catch {
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
  const closeModal4k = useCallback(() => setShowRequest4kModal(false), []);

  const showRequestButton = hasPermission(
    [
      Permission.REQUEST,
      mediaType === 'movie' || mediaType === 'collection'
        ? Permission.REQUEST_MOVIE
        : Permission.REQUEST_TV,
    ],
    { type: 'or' }
  );

  const is4kEnabled =
    mediaType === 'tv'
      ? settings.currentSettings.series4kEnabled
      : settings.currentSettings.movie4kEnabled;

  const show4k =
    is4kEnabled &&
    hasPermission(
      [
        Permission.REQUEST_4K,
        mediaType === 'tv'
          ? Permission.REQUEST_4K_TV
          : Permission.REQUEST_4K_MOVIE,
      ],
      { type: 'or' }
    );

  const isAvailableStatus = (mediaStatus?: MediaStatus) =>
    mediaStatus === MediaStatus.AVAILABLE ||
    mediaStatus === MediaStatus.PARTIALLY_AVAILABLE;

  const isRequestableStatus = (mediaStatus?: MediaStatus) =>
    !mediaStatus ||
    mediaStatus === MediaStatus.UNKNOWN ||
    mediaStatus === MediaStatus.DELETED;

  const isRequestedStatus = (mediaStatus?: MediaStatus) =>
    mediaStatus === MediaStatus.PENDING ||
    mediaStatus === MediaStatus.PROCESSING;

  const showRequest = showRequestButton && isRequestableStatus(currentStatus);
  const showAvailable = isAvailableStatus(currentStatus);
  const showRequested = isRequestedStatus(currentStatus);
  const showRequest4k = show4k && isRequestableStatus(currentStatus4k);
  const showAvailable4k = show4k && isAvailableStatus(currentStatus4k);
  const showRequested4k = show4k && isRequestedStatus(currentStatus4k);

  const bottomButtonCount =
    (showRequest || showAvailable || showRequested ? 1 : 0) +
    (showRequest4k || showAvailable4k || showRequested4k ? 1 : 0);

  const detailUrl =
    mediaType === 'movie'
      ? `/movie/${id}`
      : mediaType === 'collection'
        ? `/collection/${id}`
        : `/tv/${id}`;

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
      <RequestModal
        tmdbId={id}
        show={showRequest4kModal}
        type={
          mediaType === 'movie'
            ? 'movie'
            : mediaType === 'collection'
              ? 'collection'
              : 'tv'
        }
        is4k
        onComplete={request4kComplete}
        onUpdating={requestUpdating}
        onCancel={closeModal4k}
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
            className="absolute inset-0 h-full w-full"
            alt=""
            src={
              image
                ? `https://image.tmdb.org/t/p/w300_and_h450_face${image}`
                : `/images/seerr_poster_not_found_logo_top.png`
            }
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          <div className="absolute left-0 right-0 flex items-start justify-between p-2">
            <div
              className={`pointer-events-none z-40 self-start rounded-full border shadow-md ${
                mediaType === 'movie' || mediaType === 'collection'
                  ? 'border-blue-500 bg-blue-600/80'
                  : 'border-purple-600 bg-purple-600/80'
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
            <div className="flex flex-col items-end gap-1">
              {showDetail && currentStatus !== MediaStatus.BLOCKLISTED && (
                <>
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
                </>
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
                <div className="pointer-events-none z-40 flex">
                  <StatusBadgeMini
                    status={currentStatus}
                    inProgress={inProgress}
                    shrink
                  />
                </div>
              )}
              {show4k &&
                currentStatus4k &&
                currentStatus4k !== MediaStatus.UNKNOWN && (
                  <div className="pointer-events-none z-40 flex">
                    <StatusBadgeMini
                      status={currentStatus4k}
                      inProgress={inProgress}
                      is4k
                      shrink
                    />
                  </div>
                )}
            </div>
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
            <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-gray-800/75 text-white">
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
            <div
              className="absolute inset-0 flex flex-col justify-end overflow-hidden rounded-xl"
              style={{
                background:
                  'linear-gradient(180deg, rgba(45, 55, 72, 0.4) 0%, rgba(45, 55, 72, 0.9) 100%)',
              }}
            >
              <Link
                href={detailUrl}
                className="flex min-h-0 flex-1 cursor-pointer flex-col justify-end overflow-hidden px-2 pb-1 text-left text-white"
              >
                {year && <div className="text-sm font-medium">{year}</div>}
                <h1
                  className="whitespace-normal text-xl font-bold leading-tight"
                  style={{
                    WebkitLineClamp: bottomButtonCount >= 2 ? 2 : 3,
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
                      bottomButtonCount === 0
                        ? 5
                        : bottomButtonCount === 1
                          ? 3
                          : 2,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    wordBreak: 'break-word',
                  }}
                >
                  {summary}
                </div>
              </Link>

              {bottomButtonCount > 0 && (
                <div className="flex shrink-0 flex-col gap-1 px-2 pb-2 pt-1">
                  {showRequest ? (
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
                  ) : showAvailable ? (
                    <Link href={detailUrl} passHref legacyBehavior>
                      <Button
                        as="a"
                        buttonType="success"
                        buttonSize="sm"
                        className="min-h-7 w-full whitespace-normal py-1 text-center leading-tight"
                      >
                        <CheckCircleIcon className="shrink-0" />
                        <span className="min-w-0">
                          {intl.formatMessage(
                            currentStatus === MediaStatus.PARTIALLY_AVAILABLE
                              ? globalMessages.partiallyavailable
                              : globalMessages.available
                          )}
                        </span>
                      </Button>
                    </Link>
                  ) : showRequested ? (
                    <Link href={detailUrl} passHref legacyBehavior>
                      <Button
                        as="a"
                        buttonType={
                          currentStatus === MediaStatus.PROCESSING
                            ? 'primary'
                            : 'warning'
                        }
                        buttonSize="sm"
                        className="min-h-7 w-full whitespace-normal py-1 text-center leading-tight"
                      >
                        <ClockIcon className="shrink-0" />
                        <span className="min-w-0">
                          {intl.formatMessage(globalMessages.requested)}
                        </span>
                      </Button>
                    </Link>
                  ) : null}
                  {showRequest4k ? (
                    <Button
                      buttonType="primary"
                      buttonSize="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowRequest4kModal(true);
                      }}
                      className="h-7 w-full"
                    >
                      <ArrowDownTrayIcon />
                      <span>
                        {intl.formatMessage(globalMessages.request4k)}
                      </span>
                    </Button>
                  ) : showAvailable4k ? (
                    <Link href={detailUrl} passHref legacyBehavior>
                      <Button
                        as="a"
                        buttonType="success"
                        buttonSize="sm"
                        className="min-h-7 w-full whitespace-normal py-1 text-center leading-tight"
                      >
                        <CheckCircleIcon className="shrink-0" />
                        <span className="min-w-0">
                          {intl.formatMessage(
                            currentStatus4k === MediaStatus.PARTIALLY_AVAILABLE
                              ? messages.partiallyavailable4k
                              : messages.available4k
                          )}
                        </span>
                      </Button>
                    </Link>
                  ) : showRequested4k ? (
                    <Link href={detailUrl} passHref legacyBehavior>
                      <Button
                        as="a"
                        buttonType={
                          currentStatus4k === MediaStatus.PROCESSING
                            ? 'primary'
                            : 'warning'
                        }
                        buttonSize="sm"
                        className="min-h-7 w-full whitespace-normal py-1 text-center leading-tight"
                      >
                        <ClockIcon className="shrink-0" />
                        <span className="min-w-0">
                          {intl.formatMessage(messages.requested4k)}
                        </span>
                      </Button>
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
};

export default withProperties(TitleCard, { Placeholder, ErrorCard });
