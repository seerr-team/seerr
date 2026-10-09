import Spinner from '@app/assets/spinner.svg';
import BlocklistModal from '@app/components/BlocklistModal';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import Tooltip from '@app/components/Common/Tooltip';
import RequestModal from '@app/components/RequestModal';
import AvailabilityPopover from '@app/components/TitleCard/AvailabilityPopover';
import ErrorCard from '@app/components/TitleCard/ErrorCard';
import Placeholder from '@app/components/TitleCard/Placeholder';
import QualitySelect from '@app/components/TitleCard/QualitySelect';
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
  inProgress4k?: boolean;
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
  inProgress4k = false,
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
  const [showQualityBackdrop, setShowQualityBackdrop] = useState(false);
  const [requestIs4k, setRequestIs4k] = useState(false);
  const [requestBoth, setRequestBoth] = useState(false);
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

  const requestComplete = useCallback(
    (newStatus: MediaStatus) => {
      if (requestIs4k) {
        setCurrentStatus4k(newStatus);
      } else {
        setCurrentStatus(newStatus);
      }

      if (requestBoth && !requestIs4k) {
        setRequestBoth(false);
        setRequestIs4k(true);
        return;
      }

      setShowRequestModal(false);
    },
    [requestIs4k, requestBoth]
  );

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

  const closeModal = useCallback(() => {
    setShowRequestModal(false);
    setRequestBoth(false);
  }, []);

  const isMovieLike = mediaType === 'movie' || mediaType === 'collection';

  const showRequestButton = hasPermission(
    [
      Permission.REQUEST,
      isMovieLike ? Permission.REQUEST_MOVIE : Permission.REQUEST_TV,
    ],
    { type: 'or' }
  );

  const is4kEnabled = isMovieLike
    ? settings.currentSettings.movie4kEnabled
    : settings.currentSettings.series4kEnabled;

  const canRequest4kQuality =
    hasPermission(
      [
        Permission.REQUEST_4K,
        isMovieLike ? Permission.REQUEST_4K_MOVIE : Permission.REQUEST_4K_TV,
      ],
      { type: 'or' }
    ) && is4kEnabled;

  const canView4kStatus =
    hasPermission(
      [
        Permission.MANAGE_REQUESTS,
        Permission.REQUEST_4K,
        isMovieLike ? Permission.REQUEST_4K_MOVIE : Permission.REQUEST_4K_TV,
      ],
      { type: 'or' }
    ) && is4kEnabled;

  const showHideButton = hasPermission([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  });

  const isBlocklisted = currentStatus === MediaStatus.BLOCKLISTED;
  const isBlocklisted4k = currentStatus4k === MediaStatus.BLOCKLISTED;

  // RequestButton decides "more" from the season data behind isShowComplete,
  // which discover results don't carry, so an unfinished status stands in.
  const gapKind = (gapStatus?: MediaStatus): 'new' | 'more' | null => {
    if (
      !gapStatus ||
      gapStatus === MediaStatus.UNKNOWN ||
      gapStatus === MediaStatus.DELETED
    ) {
      return 'new';
    }

    if (
      mediaType === 'tv' &&
      gapStatus !== MediaStatus.AVAILABLE &&
      gapStatus !== MediaStatus.BLOCKLISTED
    ) {
      return 'more';
    }

    return null;
  };

  const hdGap =
    showRequestButton && !isBlocklisted ? gapKind(currentStatus) : null;
  const gap4k =
    canRequest4kQuality && !isBlocklisted4k ? gapKind(currentStatus4k) : null;

  const canRequest = hdGap !== null;
  const canRequest4k = gap4k !== null;

  const has4kState =
    canView4kStatus &&
    !!currentStatus4k &&
    [
      MediaStatus.PENDING,
      MediaStatus.PROCESSING,
      MediaStatus.PARTIALLY_AVAILABLE,
      MediaStatus.AVAILABLE,
    ].includes(currentStatus4k);

  const showStatusBadge =
    (!!currentStatus && currentStatus !== MediaStatus.UNKNOWN) || has4kState;

  const openRequestModal = (is4k: boolean, both = false) => {
    setRequestBoth(both);
    setRequestIs4k(is4k);
    setShowRequestModal(true);
  };

  return (
    <div
      className={canExpand ? 'w-full' : 'w-36 sm:w-36 md:w-44'}
      data-testid="title-card"
      ref={cardRef}
    >
      <RequestModal
        key={requestIs4k ? 'request-4k' : 'request-hd'}
        tmdbId={id}
        show={showRequestModal}
        is4k={requestIs4k}
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
              {showStatusBadge &&
                (canView4kStatus ? (
                  <Tooltip
                    content={
                      <AvailabilityPopover
                        status={currentStatus}
                        status4k={currentStatus4k}
                        show4k
                        inProgress={inProgress}
                        inProgress4k={inProgress4k}
                      />
                    }
                    tooltipConfig={{
                      followCursor: false,
                      trigger: ['hover', 'click'],
                      placement: 'bottom-end',
                      delayShow: 250,
                      offset: [0, 8],
                    }}
                    className="!px-3 !py-2"
                  >
                    <div
                      className={`z-40 flex origin-top-right cursor-help transition duration-300 ${
                        showDetail ? 'scale-[0.952]' : 'scale-100'
                      }`}
                    >
                      <StatusBadgeMini
                        status={currentStatus ?? MediaStatus.UNKNOWN}
                        ringStatus4k={currentStatus4k}
                        inProgress={inProgress}
                        shrink
                      />
                    </div>
                  </Tooltip>
                ) : (
                  <div
                    className={`pointer-events-none z-40 flex origin-top-right transition duration-300 ${
                      showDetail ? 'scale-[0.952]' : 'scale-100'
                    }`}
                  >
                    <StatusBadgeMini
                      status={currentStatus ?? MediaStatus.UNKNOWN}
                      inProgress={inProgress}
                      shrink
                    />
                  </div>
                ))}
              {showDetail && !isBlocklisted && (
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
              {showDetail && showHideButton && isBlocklisted && (
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
                      canRequest || canRequest4k ? 'pb-11' : 'pb-2'
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
                        WebkitLineClamp: canRequest || canRequest4k ? 3 : 5,
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

              {showQualityBackdrop && (
                <div className="absolute inset-0 z-40 bg-gray-900/75 backdrop-blur-sm md:hidden" />
              )}

              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-2">
                {canRequest && canRequest4k ? (
                  <>
                    <div className="hidden h-7 w-full overflow-hidden rounded-md md:flex">
                      <Button
                        buttonType="primary"
                        buttonSize="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          openRequestModal(false);
                        }}
                        className="h-7 flex-1 rounded-none"
                      >
                        <ArrowDownTrayIcon />
                        <span>
                          {intl.formatMessage(
                            hdGap === 'more'
                              ? globalMessages.requestmore
                              : globalMessages.request
                          )}
                        </span>
                      </Button>
                      <Button
                        buttonType="primary"
                        buttonSize="sm"
                        aria-label={intl.formatMessage(
                          globalMessages.request4k
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          openRequestModal(true);
                        }}
                        className="-ml-px h-7 w-11 rounded-none"
                      >
                        <span>4K</span>
                      </Button>
                    </div>
                    <QualitySelect
                      label={intl.formatMessage(
                        hdGap === 'more'
                          ? globalMessages.requestmore
                          : globalMessages.request
                      )}
                      onSelect={openRequestModal}
                      onSelectBoth={() => openRequestModal(false, true)}
                      onOpenChange={setShowQualityBackdrop}
                    />
                  </>
                ) : canRequest ? (
                  <Button
                    buttonType="primary"
                    buttonSize="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      openRequestModal(false);
                    }}
                    className="h-7 w-full"
                  >
                    <ArrowDownTrayIcon />
                    <span>
                      {intl.formatMessage(
                        hdGap === 'more'
                          ? globalMessages.requestmore
                          : globalMessages.request
                      )}
                    </span>
                  </Button>
                ) : canRequest4k ? (
                  <Button
                    buttonType="primary"
                    buttonSize="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      openRequestModal(true);
                    }}
                    className="h-7 w-full"
                  >
                    <ArrowDownTrayIcon />
                    <span>
                      {intl.formatMessage(
                        gap4k === 'more'
                          ? globalMessages.requestmore4k
                          : globalMessages.request4k
                      )}
                    </span>
                  </Button>
                ) : null}
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
};

export default withProperties(TitleCard, { Placeholder, ErrorCard });
