import Spinner from '@app/assets/spinner.svg';
import BlacklistModal from '@app/components/BlacklistModal';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import type { PlayButtonLink } from '@app/components/Common/PlayButton';
import PlayButton from '@app/components/Common/PlayButton';
import Tooltip from '@app/components/Common/Tooltip';
import IssueModal from '@app/components/IssueModal';
import ManageSlideOver from '@app/components/ManageSlideOver';
import MediaSlider from '@app/components/MediaSlider';
import RequestButton from '@app/components/RequestButton';
import StatusBadge from '@app/components/StatusBadge';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import {
  CogIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { MinusCircleIcon, StarIcon } from '@heroicons/react/24/solid';
import { IssueStatus } from '@server/constants/issue';
import { MediaStatus, MediaType } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { MusicDetails as MusicDetailsType } from '@server/models/Music';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.MusicDetails', {
  biography: 'Biography',
  runtime: '{minutes} minutes',
  album: 'Album',
  releasedate: 'Release Date',
  play: 'Play on {mediaServerName}',
  reportissue: 'Report an Issue',
  managemusic: 'Manage Music',
  biographyunavailable: 'Biography unavailable.',
  trackstitle: 'Tracks',
  tracksunavailable: 'No tracks available.',
  watchlistSuccess: '<strong>{title}</strong> added to watchlist successfully!',
  watchlistDeleted:
    '<strong>{title}</strong> removed from watchlist successfully!',
  watchlistError: 'Something went wrong try again.',
  removefromwatchlist: 'Remove From Watchlist',
  addtowatchlist: 'Add To Watchlist',
  status: 'Status',
  label: 'Label',
  artisttype: 'Artist Type',
  artiststatus: 'Artist Status',
  discography: "{artistName}'s discography",
  similarArtists: 'Similar Artists',
});

interface MusicDetailsProps {
  music?: MusicDetailsType;
}

const MusicDetails = ({ music }: MusicDetailsProps) => {
  const settings = useSettings();
  const { user, hasPermission } = useUser();
  const router = useRouter();
  const intl = useIntl();
  const [showManager, setShowManager] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [toggleWatchlist, setToggleWatchlist] = useState<boolean>(
    !music?.onUserWatchlist
  );
  const [isBlacklistUpdating, setIsBlacklistUpdating] =
    useState<boolean>(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const { addToast } = useToasts();

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<MusicDetailsType>(`/api/v1/music/${router.query.musicId}`, {
    fallbackData: music,
    refreshInterval: refreshIntervalHelper(
      {
        downloadStatus: music?.mediaInfo?.downloadStatus,
        downloadStatus4k: undefined,
      },
      15000
    ),
  });

  useEffect(() => {
    setShowManager(router.query.manage == '1' ? true : false);
  }, [router.query.manage]);

  const closeBlacklistModal = useCallback(
    () => setShowBlacklistModal(false),
    []
  );

  const { mediaUrl: plexUrl } = useDeepLinks({
    mediaUrl: data?.mediaInfo?.mediaUrl,
    mediaUrl4k: data?.mediaInfo?.mediaUrl4k,
    iOSPlexUrl: data?.mediaInfo?.iOSPlexUrl,
    iOSPlexUrl4k: data?.mediaInfo?.iOSPlexUrl4k,
  });

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={404} />;
  }

  const mediaLinks: PlayButtonLink[] = [];

  if (
    plexUrl &&
    hasPermission([Permission.REQUEST, Permission.REQUEST_MOVIE], {
      type: 'or',
    })
  ) {
    mediaLinks.push({
      text: getAvalaibleMediaServerName(),
      url: plexUrl,
      svg: <PlayIcon />,
    });
  }

  const formatDuration = (milliseconds: number): string => {
    if (!milliseconds) return '';

    const totalMinutes = Math.floor(milliseconds / 1000 / 60);

    return `${totalMinutes} Minute${totalMinutes > 1 ? 's' : ''}`;
  };

  function getAvalaibleMediaServerName() {
    if (settings.currentSettings.mediaServerType === MediaServerType.EMBY) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Emby' });
    }

    if (settings.currentSettings.mediaServerType === MediaServerType.PLEX) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Plex' });
    }

    return intl.formatMessage(messages.play, { mediaServerName: 'Jellyfin' });
  }

  const onClickWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);

    const res = await fetch('/api/v1/watchlist', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mbId: music?.id,
        mediaType: MediaType.MUSIC,
        title: music?.title,
      }),
    });

    if (!res.ok) {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });

      setIsUpdating(false);
      return;
    }

    const data = await res.json();

    if (data) {
      addToast(
        <span>
          {intl.formatMessage(messages.watchlistSuccess, {
            title: music?.title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );
    }

    setIsUpdating(false);
    setToggleWatchlist((prevState) => !prevState);
  };

  const onClickDeleteWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/v1/watchlist/${music?.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();

      if (res.status === 204) {
        addToast(
          <span>
            {intl.formatMessage(messages.watchlistDeleted, {
              title: music?.title,
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
      setToggleWatchlist((prevState) => !prevState);
    }
  };

  const onClickHideItemBtn = async (): Promise<void> => {
    setIsBlacklistUpdating(true);

    const res = await fetch('/api/v1/blacklist', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mbId: music?.id,
        mediaType: 'music',
        title: music?.title,
        user: user?.id,
      }),
    });

    if (res.status === 201) {
      addToast(
        <span>
          {intl.formatMessage(globalMessages.blacklistSuccess, {
            title: music?.title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      revalidate();
    } else if (res.status === 412) {
      addToast(
        <span>
          {intl.formatMessage(globalMessages.blacklistDuplicateError, {
            title: music?.title,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'info', autoDismiss: true }
      );
    } else {
      addToast(intl.formatMessage(globalMessages.blacklistError), {
        appearance: 'error',
        autoDismiss: true,
      });
    }

    setIsBlacklistUpdating(false);
    closeBlacklistModal();
  };

  const showHideButton = hasPermission([Permission.MANAGE_BLACKLIST], {
    type: 'or',
  });

  const totalDurationMs = data.releases?.[0]?.tracks?.reduce(
    (sum, track) => sum + (track.durationMs || 0),
    0
  );

  const truncateOverview = (text: string): string => {
    const maxLength = 800;
    if (!text || text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);
    return truncated.substring(0, truncated.lastIndexOf('.') + 1);
  };

  return (
    <div
      className="media-page"
      style={{
        height: 493,
      }}
    >
      <div className="media-page-bg-image">
        <CachedImage
          type="music"
          alt=""
          src={
            data.artist.images?.find((img) => img.CoverType === 'Fanart')
              ?.Url ||
            data.artist.images?.find((img) => img.CoverType === 'Poster')
              ?.Url ||
            data.images?.find((img) => img.CoverType.toLowerCase() === 'cover')
              ?.Url ||
            '/images/overseerr_poster_not_found.png'
          }
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          fill
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 100%)',
          }}
        />
      </div>
      <PageTitle title={`${data.title} - ${data.artist.artistName}`} />
      <IssueModal
        onCancel={() => setShowIssueModal(false)}
        show={showIssueModal}
        mediaType="music"
        mbId={data.id}
      />
      <ManageSlideOver
        data={data}
        mediaType="music"
        onClose={() => {
          setShowManager(false);
          router.push({
            pathname: router.pathname,
            query: { musicId: router.query.musicId },
          });
        }}
        revalidate={() => revalidate()}
        show={showManager}
      />
      <BlacklistModal
        mbId={data.mbId}
        type="music"
        show={showBlacklistModal}
        onCancel={closeBlacklistModal}
        onComplete={onClickHideItemBtn}
        isUpdating={isBlacklistUpdating}
      />
      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="music"
            src={
              data.images?.find(
                (img) => img.CoverType.toLowerCase() === 'cover'
              )?.Url || '/images/overseerr_poster_not_found.png'
            }
            alt=""
            sizes="100vw"
            style={{ width: '100%', height: 'auto' }}
            width={600}
            height={600}
            priority
          />
        </div>
        <div className="media-title">
          <div className="media-status">
            <StatusBadge
              status={data.mediaInfo?.status}
              downloadItem={data.mediaInfo?.downloadStatus}
              title={data.title}
              inProgress={(data.mediaInfo?.downloadStatus ?? []).length > 0}
              mbId={data.mediaInfo?.mbId}
              mediaType="music"
              serviceUrl={data.mediaInfo?.serviceUrl}
            />
          </div>
          <h1 data-testid="media-title">
            {data.title} - {data.artist.artistName}{' '}
            {data.releaseDate && (
              <span className="media-year">
                ({new Date(data.releaseDate).getFullYear()})
              </span>
            )}
          </h1>
          <span className="media-attributes">
            {[
              <span className="rounded-md border p-0.5 py-0">{data.type}</span>,
              totalDurationMs ? formatDuration(totalDurationMs) : null,
              data.genres.length > 0 ? data.genres.join(', ') : null,
            ]
              .filter(Boolean)
              .map((t, k) => <span key={k}>{t}</span>)
              .reduce((prev, curr) => (
                <>
                  {prev}
                  <span>|</span>
                  {curr}
                </>
              ))}
          </span>
        </div>
        <div className="media-actions">
          {showHideButton &&
            data?.mediaInfo?.status !== MediaStatus.PROCESSING &&
            data?.mediaInfo?.status !== MediaStatus.AVAILABLE &&
            data?.mediaInfo?.status !== MediaStatus.PENDING &&
            data?.mediaInfo?.status !== MediaStatus.BLACKLISTED && (
              <Tooltip
                content={intl.formatMessage(globalMessages.addToBlacklist)}
              >
                <Button
                  buttonType="ghost"
                  className="z-40 mr-2"
                  buttonSize="md"
                  onClick={() => setShowBlacklistModal(true)}
                >
                  <EyeSlashIcon className="h-3" />
                </Button>
              </Tooltip>
            )}
          {data?.mediaInfo?.status !== MediaStatus.BLACKLISTED && (
            <>
              {toggleWatchlist ? (
                <Tooltip content={intl.formatMessage(messages.addtowatchlist)}>
                  <Button
                    buttonType="ghost"
                    className="z-40 mr-2"
                    buttonSize="md"
                    onClick={onClickWatchlistBtn}
                  >
                    {isUpdating ? (
                      <Spinner className="h-3" />
                    ) : (
                      <StarIcon className="h-3 text-amber-300" />
                    )}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip
                  content={intl.formatMessage(messages.removefromwatchlist)}
                >
                  <Button
                    className="z-40 mr-2"
                    buttonSize="md"
                    onClick={onClickDeleteWatchlistBtn}
                  >
                    {isUpdating ? (
                      <Spinner className="h-3" />
                    ) : (
                      <MinusCircleIcon className="h-3" />
                    )}
                  </Button>
                </Tooltip>
              )}
            </>
          )}
          <PlayButton links={mediaLinks} />
          <RequestButton
            mediaType="music"
            media={data.mediaInfo}
            mbId={data.mbId}
            onUpdate={() => revalidate()}
          />
          {data.mediaInfo?.status === MediaStatus.AVAILABLE &&
            hasPermission(
              [Permission.CREATE_ISSUES, Permission.MANAGE_ISSUES],
              {
                type: 'or',
              }
            ) && (
              <Tooltip content={intl.formatMessage(messages.reportissue)}>
                <Button
                  buttonType="warning"
                  onClick={() => setShowIssueModal(true)}
                  className="ml-2 first:ml-0"
                >
                  <ExclamationTriangleIcon />
                </Button>
              </Tooltip>
            )}
          {hasPermission(Permission.MANAGE_REQUESTS) &&
            data.mediaInfo &&
            (data.mediaInfo.jellyfinMediaId ||
              data.mediaInfo.jellyfinMediaId4k ||
              data.mediaInfo.status !== MediaStatus.UNKNOWN ||
              data.mediaInfo.status4k !== MediaStatus.UNKNOWN) && (
              <Tooltip content={intl.formatMessage(messages.managemusic)}>
                <Button
                  buttonType="ghost"
                  onClick={() => setShowManager(true)}
                  className="relative ml-2 first:ml-0"
                >
                  <CogIcon className="!mr-0" />
                  {hasPermission(
                    [Permission.MANAGE_ISSUES, Permission.VIEW_ISSUES],
                    {
                      type: 'or',
                    }
                  ) &&
                    (data.mediaInfo?.issues ?? []).filter(
                      (issue) => issue.status === IssueStatus.OPEN
                    ).length > 0 && (
                      <>
                        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-600" />
                        <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-600" />
                      </>
                    )}
                </Button>
              </Tooltip>
            )}
        </div>
      </div>
      <div className="media-overview">
        <div className="media-overview-left">
          <h2>{intl.formatMessage(messages.biography)}</h2>
          <p>
            {data.artist.overview
              ? truncateOverview(data.artist.overview)
              : intl.formatMessage(messages.biographyunavailable)}
          </p>
          <h2 className="py-4">{intl.formatMessage(messages.trackstitle)}</h2>
          {data.releases?.[0]?.tracks?.length > 0 ? (
            <div className="divide-y divide-gray-700 rounded-lg border border-gray-700">
              {data.releases[0].tracks.map((track, index) => (
                <div
                  key={track.id ?? index}
                  className="flex items-center justify-between px-4 py-2 text-sm transition duration-150 hover:bg-gray-700"
                >
                  <div className="flex flex-1 items-center space-x-4">
                    <span className="w-8 text-gray-500">{index + 1}</span>
                    <span className="flex-1 truncate text-gray-300">
                      {track.trackName}
                    </span>
                    <span className="text-right text-gray-500">
                      {Math.floor((track.durationMs ?? 0) / 1000 / 60)}:
                      {String(
                        Math.floor(((track.durationMs ?? 0) / 1000) % 60)
                      ).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400">
              {intl.formatMessage(messages.tracksunavailable)}
            </div>
          )}
        </div>
        <div className="media-overview-right">
          <div className="media-facts">
            {data.releases?.[0]?.status && (
              <div className="media-fact">
                <span>{intl.formatMessage(globalMessages.status)}</span>
                <span className="media-fact-value">
                  {data.releases[0].status}
                </span>
              </div>
            )}
            {data.releases?.[0]?.label?.length > 0 && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.label)}</span>
                <span className="media-fact-value">
                  {data.releases[0].label.map((label) => (
                    <span key={label} className="block">
                      {label}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {data.artist.type && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.artisttype)}</span>
                <span className="media-fact-value">{data.artist.type}</span>
              </div>
            )}
            {data.artist.status && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.artiststatus)}</span>
                <span className="media-fact-value">
                  {data.artist.status.charAt(0).toUpperCase() +
                    data.artist.status.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <MediaSlider
        sliderKey="artist-discography"
        title={intl.formatMessage(messages.discography, {
          artistName: data?.artist.artistName ?? '',
        })}
        url={`/api/v1/music/${router.query.musicId}/discography`}
        linkUrl={`/music/${data.id}/discography`}
        hideWhenEmpty
      />
      <MediaSlider
        sliderKey="similar-artists"
        title={intl.formatMessage(messages.similarArtists)}
        url={`/api/v1/music/${router.query.musicId}/similar`}
        linkUrl={`/music/${data.id}/similar`}
        hideWhenEmpty
      />
      <div className="extra-bottom-space relative" />
    </div>
  );
};

export default MusicDetails;
