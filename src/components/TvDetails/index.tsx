import RTAudFresh from '@app/assets/rt_aud_fresh.svg';
import RTAudRotten from '@app/assets/rt_aud_rotten.svg';
import RTFresh from '@app/assets/rt_fresh.svg';
import RTRotten from '@app/assets/rt_rotten.svg';
import Spinner from '@app/assets/spinner.svg';
import TmdbLogo from '@app/assets/tmdb_logo.svg';
import BlocklistModal from '@app/components/BlocklistModal';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import type { PlayButtonLink } from '@app/components/Common/PlayButton';
import PlayButton from '@app/components/Common/PlayButton';
import StatusBadgeMini from '@app/components/Common/StatusBadgeMini';
import Tag from '@app/components/Common/Tag';
import Tooltip from '@app/components/Common/Tooltip';
import ExternalLinkBlock from '@app/components/ExternalLinkBlock';
import IssueModal from '@app/components/IssueModal';
import ManageSlideOver from '@app/components/ManageSlideOver';
import MediaSlider from '@app/components/MediaSlider';
import PersonCard from '@app/components/PersonCard';
import RequestButton from '@app/components/RequestButton';
import RequestModal from '@app/components/RequestModal';
import Slider from '@app/components/Slider';
import StatusBadge from '@app/components/StatusBadge';
import Season from '@app/components/TvDetails/Season';
import useDeepLinks from '@app/hooks/useDeepLinks';
import useLocale from '@app/hooks/useLocale';
import useSettings from '@app/hooks/useSettings';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import ErrorPage from '@app/pages/_error';
import { sortCrewPriority } from '@app/utils/creditHelpers';
import defineMessages from '@app/utils/defineMessages';
import { refreshIntervalHelper } from '@app/utils/refreshIntervalHelper';
import { Disclosure, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import {
  ArrowRightCircleIcon,
  CogIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  FilmIcon,
  MinusCircleIcon,
  PlayIcon,
  StarIcon,
} from '@heroicons/react/24/solid';
import type { RTRating } from '@server/api/rating/rottentomatoes';
import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import { IssueStatus } from '@server/constants/issue';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { Crew } from '@server/models/common';
import type { TvDetails as TvDetailsType } from '@server/models/Tv';
import axios from 'axios';
import { countries } from 'country-flag-icons';
import 'country-flag-icons/3x2/flags.css';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';

const messages = defineMessages('components.TvDetails', {
  firstAirDate: 'First Air Date',
  nextAirDate: 'Next Air Date',
  originallanguage: 'Original Language',
  overview: 'Overview',
  cast: 'Cast',
  recommendations: 'Recommendations',
  similar: 'Similar Series',
  watchtrailer: 'Watch Trailer',
  overviewunavailable: 'Overview unavailable.',
  originaltitle: 'Original Title',
  showtype: 'Series Type',
  anime: 'Anime',
  network: '{networkCount, plural, one {Network} other {Networks}}',
  viewfullcrew: 'View Full Crew',
  crew: 'Crew',
  keywords: 'Keywords',
  ratings: 'Ratings',
  details: 'Details',
  play: 'Play on {mediaServerName}',
  play4k: 'Play 4K on {mediaServerName}',
  seasons: '{seasonCount, plural, one {# Season} other {# Seasons}}',
  episodeRuntime: 'Episode Runtime',
  episodeRuntimeMinutes: '{runtime} minutes',
  streamingproviders: 'Currently Streaming On',
  productioncountries:
    'Production {countryCount, plural, one {Country} other {Countries}}',
  reportissue: 'Report an Issue',
  manageseries: 'Manage Series',
  seasonstitle: 'Seasons',
  episodeCount: '{episodeCount, plural, one {# Episode} other {# Episodes}}',
  seasonnumber: 'Season {seasonNumber}',
  status4k: '4K {status}',
  rtcriticsscore: 'Rotten Tomatoes Tomatometer',
  rtaudiencescore: 'Rotten Tomatoes Audience Score',
  tmdbuserscore: 'TMDB User Score',
  watchlistSuccess: '<strong>{title}</strong> added to watchlist successfully!',
  watchlistDeleted:
    '<strong>{title}</strong> Removed from watchlist successfully!',
  watchlistError: 'Something went wrong. Please try again.',
  removefromwatchlist: 'Remove From Watchlist',
  addtowatchlist: 'Add To Watchlist',
});

interface TvDetailsProps {
  tv?: TvDetailsType;
}

const TvDetails = ({ tv }: TvDetailsProps) => {
  const settings = useSettings();
  const { user, hasPermission } = useUser();
  const router = useRouter();
  const intl = useIntl();
  const { locale } = useLocale();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showManager, setShowManager] = useState(router.query.manage == '1');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [toggleWatchlist, setToggleWatchlist] = useState<boolean>(
    !tv?.onUserWatchlist
  );
  const [isBlocklistUpdating, setIsBlocklistUpdating] =
    useState<boolean>(false);
  const [showBlocklistModal, setShowBlocklistModal] = useState(false);
  const { addToast } = useToasts();

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<TvDetailsType>(`/api/v1/tv/${router.query.tvId}`, {
    fallbackData: tv,
    refreshInterval: refreshIntervalHelper(
      {
        downloadStatus: tv?.mediaInfo?.downloadStatus,
        downloadStatus4k: tv?.mediaInfo?.downloadStatus4k,
      },
      15000
    ),
  });

  const { data: ratingData } = useSWR<RTRating>(
    `/api/v1/tv/${router.query.tvId}/ratings`
  );

  const sortedCrew = useMemo(
    () => sortCrewPriority(data?.credits.crew ?? []),
    [data]
  );

  useEffect(() => {
    setShowManager(router.query.manage == '1');
  }, [router.query.manage]);

  const closeBlocklistModal = useCallback(
    () => setShowBlocklistModal(false),
    []
  );

  const { mediaUrl: plexUrl, mediaUrl4k: plexUrl4k } = useDeepLinks({
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
    hasPermission([Permission.REQUEST, Permission.REQUEST_TV], {
      type: 'or',
    })
  ) {
    mediaLinks.push({
      text: getAvailableMediaServerName(),
      url: plexUrl,
      svg: <PlayIcon />,
    });
  }

  if (
    settings.currentSettings.series4kEnabled &&
    plexUrl4k &&
    hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_TV], {
      type: 'or',
    })
  ) {
    mediaLinks.push({
      text: getAvailable4kMediaServerName(),
      url: plexUrl4k,
      svg: <PlayIcon />,
    });
  }

  const trailerVideo = data.relatedVideos
    ?.filter((r) => r.type === 'Trailer')
    .sort((a, b) => a.size - b.size)
    .pop();
  const trailerUrl =
    trailerVideo?.site === 'YouTube' &&
    settings.currentSettings.youtubeUrl != ''
      ? `${settings.currentSettings.youtubeUrl}${trailerVideo?.key}`
      : trailerVideo?.url;

  if (trailerUrl) {
    mediaLinks.push({
      text: intl.formatMessage(messages.watchtrailer),
      url: trailerUrl,
      svg: <FilmIcon />,
    });
  }

  const discoverRegion = user?.settings?.discoverRegion
    ? user.settings.discoverRegion
    : settings.currentSettings.discoverRegion
      ? settings.currentSettings.discoverRegion
      : 'US';
  const seriesAttributes: React.ReactNode[] = [];

  const contentRating = data.contentRatings.results.find(
    (r) => r.iso_3166_1 === discoverRegion
  )?.rating;
  if (contentRating) {
    seriesAttributes.push(
      <span className="rounded-md border p-0.5 py-0">{contentRating}</span>
    );
  }

  // Does NOT include "Specials"
  const seasonCount = data.seasons.filter(
    (season) => season.seasonNumber !== 0 && season.episodeCount !== 0
  ).length;

  if (seasonCount) {
    seriesAttributes.push(
      intl.formatMessage(messages.seasons, { seasonCount: seasonCount })
    );
  }

  if (data.genres.length) {
    seriesAttributes.push(
      data.genres
        .map((g) => (
          <Link
            href={`/discover/tv?genre=${g.id}`}
            key={`genre-${g.id}`}
            className="hover:underline"
          >
            {g.name}
          </Link>
        ))
        .reduce((prev, curr) => (
          <>
            {intl.formatMessage(globalMessages.delimitedlist, {
              a: prev,
              b: curr,
            })}
          </>
        ))
    );
  }

  const getAllRequestedSeasons = (is4k: boolean): number[] => {
    const requestedSeasons = (data?.mediaInfo?.requests ?? [])
      .filter(
        (request) =>
          request.is4k === is4k &&
          request.status !== MediaRequestStatus.DECLINED &&
          request.status !== MediaRequestStatus.COMPLETED
      )
      .reduce((requestedSeasons, request) => {
        return [
          ...requestedSeasons,
          ...request.seasons.map((sr) => sr.seasonNumber),
        ];
      }, [] as number[]);

    const availableSeasons = (data?.mediaInfo?.seasons ?? [])
      .filter(
        (season) =>
          (season[is4k ? 'status4k' : 'status'] === MediaStatus.AVAILABLE ||
            season[is4k ? 'status4k' : 'status'] ===
              MediaStatus.PARTIALLY_AVAILABLE ||
            season[is4k ? 'status4k' : 'status'] === MediaStatus.PROCESSING) &&
          !requestedSeasons.includes(season.seasonNumber)
      )
      .map((season) => season.seasonNumber);

    return [...requestedSeasons, ...availableSeasons];
  };

  const showHasSpecials = data.seasons.some(
    (season) =>
      season.seasonNumber === 0 &&
      settings.currentSettings.enableSpecialEpisodes
  );

  const isComplete =
    (showHasSpecials ? seasonCount + 1 : seasonCount) <=
    getAllRequestedSeasons(false).length;

  const is4kComplete =
    (showHasSpecials ? seasonCount + 1 : seasonCount) <=
    getAllRequestedSeasons(true).length;

  const streamingRegion = user?.settings?.streamingRegion
    ? user.settings.streamingRegion
    : settings.currentSettings.streamingRegion
      ? settings.currentSettings.streamingRegion
      : 'US';
  const streamingProviders =
    data?.watchProviders?.find(
      (provider) => provider.iso_3166_1 === streamingRegion
    )?.flatrate ?? [];

  function getAvailableMediaServerName() {
    if (settings.currentSettings.mediaServerType === MediaServerType.EMBY) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Emby' });
    }

    if (settings.currentSettings.mediaServerType === MediaServerType.PLEX) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Plex' });
    }

    return intl.formatMessage(messages.play, { mediaServerName: 'Jellyfin' });
  }

  function getAvailable4kMediaServerName() {
    if (settings.currentSettings.mediaServerType === MediaServerType.EMBY) {
      return intl.formatMessage(messages.play, { mediaServerName: 'Emby' });
    }

    if (settings.currentSettings.mediaServerType === MediaServerType.PLEX) {
      return intl.formatMessage(messages.play4k, { mediaServerName: 'Plex' });
    }

    return intl.formatMessage(messages.play, { mediaServerName: 'Jellyfin' });
  }

  const onClickWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);

    try {
      await axios.post('/api/v1/watchlist', {
        tmdbId: tv?.id,
        mediaType: MediaType.TV,
        title: tv?.name,
      });
      addToast(
        <span>
          {intl.formatMessage(messages.watchlistSuccess, {
            title: tv?.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );

      setIsUpdating(false);
      setToggleWatchlist((prevState) => !prevState);
    } catch {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });

      setIsUpdating(false);
    }
  };

  const onClickDeleteWatchlistBtn = async (): Promise<void> => {
    setIsUpdating(true);

    try {
      await axios.delete('/api/v1/watchlist/' + tv?.id);

      addToast(
        <span>
          {intl.formatMessage(messages.watchlistDeleted, {
            title: tv?.name,
            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
          })}
        </span>,
        { appearance: 'info', autoDismiss: true }
      );

      setIsUpdating(false);
      setToggleWatchlist((prevState) => !prevState);
    } catch {
      addToast(intl.formatMessage(messages.watchlistError), {
        appearance: 'error',
        autoDismiss: true,
      });

      setIsUpdating(false);
    }
  };

  const onClickHideItemBtn = async (): Promise<void> => {
    setIsBlocklistUpdating(true);

    try {
      const res = await axios.post('/api/v1/blocklist', {
        tmdbId: tv?.id,
        mediaType: 'tv',
        title: tv?.name,
        user: user?.id,
      });

      if (res.status === 201) {
        addToast(
          <span>
            {intl.formatMessage(globalMessages.blocklistSuccess, {
              title: tv?.name,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );

        revalidate();
      }
    } catch (e) {
      if (e?.response?.status === 412) {
        addToast(
          <span>
            {intl.formatMessage(globalMessages.blocklistDuplicateError, {
              title: tv?.name,
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

    setIsBlocklistUpdating(false);
    closeBlocklistModal();
  };

  const showHideButton = hasPermission([Permission.MANAGE_BLOCKLIST], {
    type: 'or',
  });

  return (
    <>
    <div
      className="tv-details-backdrop-section media-page"
      style={{
        height: 493,
      }}
    >
      {data.backdropPath && (
        <div className="media-page-bg-image">
          <CachedImage
            type="tmdb"
            alt=""
            src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data.backdropPath}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900" />
        </div>
      )}
      <PageTitle title={data.name} />
      <BlocklistModal
        tmdbId={data.id}
        type="tv"
        show={showBlocklistModal}
        onCancel={closeBlocklistModal}
        onComplete={onClickHideItemBtn}
        isUpdating={isBlocklistUpdating}
      />
      <IssueModal
        onCancel={() => setShowIssueModal(false)}
        show={showIssueModal}
        mediaType="tv"
        tmdbId={data.id}
      />
      <RequestModal
        tmdbId={data.id}
        show={showRequestModal}
        type="tv"
        onComplete={() => {
          revalidate();
          setShowRequestModal(false);
        }}
        onCancel={() => setShowRequestModal(false)}
      />
      <ManageSlideOver
        data={data}
        mediaType="tv"
        onClose={() => {
          setShowManager(false);
          router.push({
            pathname: router.pathname,
            query: { tvId: router.query.tvId },
          });
        }}
        revalidate={() => revalidate()}
        show={showManager}
      />
      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="tmdb"
            src={
              data.posterPath
                ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.posterPath}`
                : '/images/seerr_poster_not_found.png'
            }
            alt=""
            sizes="100vw"
            style={{ width: '100%', height: 'auto' }}
            width={600}
            height={900}
            priority
          />
        </div>
        <div className="media-title">
          <div className="media-status">
            <StatusBadge
              status={data.mediaInfo?.status}
              downloadItem={data.mediaInfo?.downloadStatus}
              title={data.name}
              inProgress={(data.mediaInfo?.downloadStatus ?? []).length > 0}
              tmdbId={data.mediaInfo?.tmdbId}
              mediaType="tv"
              plexUrl={plexUrl}
              serviceUrl={data.mediaInfo?.serviceUrl}
            />
            {settings.currentSettings.series4kEnabled &&
              hasPermission(
                [
                  Permission.MANAGE_REQUESTS,
                  Permission.REQUEST_4K,
                  Permission.REQUEST_4K_TV,
                ],
                {
                  type: 'or',
                }
              ) && (
                <StatusBadge
                  status={data.mediaInfo?.status4k}
                  downloadItem={data.mediaInfo?.downloadStatus4k}
                  title={data.name}
                  is4k
                  inProgress={
                    (data.mediaInfo?.downloadStatus4k ?? []).length > 0
                  }
                  tmdbId={data.mediaInfo?.tmdbId}
                  mediaType="tv"
                  plexUrl={plexUrl4k}
                  serviceUrl={data.mediaInfo?.serviceUrl4k}
                />
              )}
          </div>
          <h1 data-testid="media-title">
            {data.name}{' '}
            {data.firstAirDate && (
              <span className="media-year">
                ({data.firstAirDate.slice(0, 4)})
              </span>
            )}
          </h1>
          <span className="media-attributes">
            {seriesAttributes.length > 0 &&
              seriesAttributes
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
            data?.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE &&
            data?.mediaInfo?.status !== MediaStatus.PENDING &&
            data?.mediaInfo?.status !== MediaStatus.BLOCKLISTED && (
              <Tooltip
                content={intl.formatMessage(globalMessages.addToBlocklist)}
              >
                <Button
                  buttonType={'ghost'}
                  className="z-40 mr-2"
                  buttonSize={'md'}
                  onClick={() => setShowBlocklistModal(true)}
                >
                  <EyeSlashIcon />
                </Button>
              </Tooltip>
            )}
          {data?.mediaInfo?.status !== MediaStatus.BLOCKLISTED &&
            user?.userType !== UserType.PLEX && (
              <>
                {toggleWatchlist ? (
                  <Tooltip
                    content={intl.formatMessage(messages.addtowatchlist)}
                  >
                    <Button
                      buttonType={'ghost'}
                      className="z-40 mr-2"
                      buttonSize={'md'}
                      onClick={onClickWatchlistBtn}
                    >
                      {isUpdating ? (
                        <Spinner />
                      ) : (
                        <StarIcon className={'text-amber-300'} />
                      )}
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip
                    content={intl.formatMessage(messages.removefromwatchlist)}
                  >
                    <Button
                      className="z-40 mr-2"
                      buttonSize={'md'}
                      onClick={onClickDeleteWatchlistBtn}
                    >
                      {isUpdating ? <Spinner /> : <MinusCircleIcon />}
                    </Button>
                  </Tooltip>
                )}
              </>
            )}
          <div className="z-20">
            <PlayButton links={mediaLinks} />
          </div>
          <RequestButton
            mediaType="tv"
            onUpdate={() => revalidate()}
            tmdbId={data?.id}
            media={data?.mediaInfo}
            isShowComplete={isComplete}
            is4kShowComplete={is4kComplete}
          />
          {(data.mediaInfo?.status === MediaStatus.AVAILABLE ||
            data.mediaInfo?.status === MediaStatus.PARTIALLY_AVAILABLE ||
            (settings.currentSettings.series4kEnabled &&
              hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_TV], {
                type: 'or',
              }) &&
              (data.mediaInfo?.status4k === MediaStatus.AVAILABLE ||
                data?.mediaInfo?.status4k ===
                  MediaStatus.PARTIALLY_AVAILABLE))) &&
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
          {hasPermission(Permission.MANAGE_REQUESTS) && data.mediaInfo && (
            <Tooltip content={intl.formatMessage(messages.manageseries)}>
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
                  (
                    data.mediaInfo?.issues.filter(
                      (issue) => issue.status === IssueStatus.OPEN
                    ) ?? []
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
          {data.tagline && <div className="tagline">{data.tagline}</div>}
          <h2>{intl.formatMessage(messages.overview)}</h2>
          <p>
            {data.overview
              ? data.overview
              : intl.formatMessage(messages.overviewunavailable)}
          </p>
          {sortedCrew.length > 0 && (
            <>
              <ul className="media-crew">
                {(data.createdBy.length > 0
                  ? [
                      ...data.createdBy.map(
                        (person): Partial<Crew> => ({
                          id: person.id,
                          job: 'Creator',
                          name: person.name,
                        })
                      ),
                      ...sortedCrew,
                    ]
                  : sortedCrew
                )
                  .slice(0, 6)
                  .map((person) => (
                    <li key={`crew-${person.job}-${person.id}`}>
                      <span>{person.job}</span>
                      <Link href={`/person/${person.id}`} className="crew-name">
                        {person.name}
                      </Link>
                    </li>
                  ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <Link
                  href={`/tv/${data.id}/crew`}
                  className="flex items-center text-gray-400 transition duration-300 hover:text-gray-100"
                >
                  <span>{intl.formatMessage(messages.viewfullcrew)}</span>
                  <ArrowRightCircleIcon className="ml-1.5 inline-block h-5 w-5" />
                </Link>
              </div>
            </>
          )}
          {data.keywords.length > 0 && (
            <div className="mt-6">
              {data.keywords.map((keyword) => (
                <Link
                  href={`/discover/tv?keywords=${keyword.id}`}
                  key={`keyword-id-${keyword.id}`}
                  className="mb-2 mr-2 inline-flex last:mr-0"
                >
                  <Tag>{keyword.name}</Tag>
                </Link>
              ))}
            </div>
          )}
          <h2 className="py-4">{intl.formatMessage(messages.seasonstitle)}</h2>
          <div className="flex w-full flex-col space-y-2">
            {data.seasons
              .slice()
              .reverse()
              .filter(
                (season) =>
                  settings.currentSettings.enableSpecialEpisodes ||
                  season.seasonNumber !== 0
              )
              .map((season) => {
                const show4k =
                  settings.currentSettings.series4kEnabled &&
                  hasPermission(
                    [
                      Permission.MANAGE_REQUESTS,
                      Permission.REQUEST_4K,
                      Permission.REQUEST_4K_TV,
                    ],
                    {
                      type: 'or',
                    }
                  );
                const mSeason = (data.mediaInfo?.seasons ?? []).find(
                  (s) =>
                    season.seasonNumber === s.seasonNumber &&
                    s.status !== MediaStatus.UNKNOWN
                );
                const mSeason4k = (data.mediaInfo?.seasons ?? []).find(
                  (s) =>
                    season.seasonNumber === s.seasonNumber &&
                    s.status4k !== MediaStatus.UNKNOWN
                );
                const request = (data.mediaInfo?.requests ?? [])
                  .filter(
                    (r) =>
                      !!r.seasons.find(
                        (s) => s.seasonNumber === season.seasonNumber
                      ) && !r.is4k
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )[0];
                const request4k = (data.mediaInfo?.requests ?? [])
                  .filter(
                    (r) =>
                      !!r.seasons.find(
                        (s) => s.seasonNumber === season.seasonNumber
                      ) && r.is4k
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )[0];

                if (season.episodeCount === 0) {
                  return null;
                }

                return (
                  <Disclosure key={`season-discoslure-${season.seasonNumber}`}>
                    {({ open }) => (
                      <>
                        <Disclosure.Button
                          className={`mt-2 flex w-full items-center justify-between space-x-2 border-gray-700 bg-gray-800 px-4 py-2 text-gray-200 ${
                            open
                              ? 'rounded-t-md border-l border-r border-t'
                              : 'rounded-md border'
                          }`}
                        >
                          <div className="flex flex-1 items-center space-x-2 text-lg">
                            <span>
                              {season.seasonNumber === 0
                                ? intl.formatMessage(globalMessages.specials)
                                : intl.formatMessage(messages.seasonnumber, {
                                    seasonNumber: season.seasonNumber,
                                  })}
                            </span>
                            <Badge badgeType="dark">
                              {intl.formatMessage(messages.episodeCount, {
                                episodeCount: season.episodeCount,
                              })}
                            </Badge>
                          </div>
                          {((!mSeason &&
                            request?.status === MediaRequestStatus.APPROVED) ||
                            mSeason?.status === MediaStatus.PROCESSING ||
                            (request?.status === MediaRequestStatus.APPROVED &&
                              mSeason?.status === MediaStatus.DELETED)) && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="primary">
                                  {intl.formatMessage(globalMessages.requested)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini
                                  status={MediaStatus.PROCESSING}
                                />
                              </div>
                            </>
                          )}
                          {((!mSeason &&
                            request?.status === MediaRequestStatus.PENDING) ||
                            mSeason?.status === MediaStatus.PENDING) && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="warning">
                                  {intl.formatMessage(globalMessages.pending)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.PENDING} />
                              </div>
                            </>
                          )}
                          {mSeason?.status ===
                            MediaStatus.PARTIALLY_AVAILABLE && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="success">
                                  {intl.formatMessage(
                                    globalMessages.partiallyavailable
                                  )}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini
                                  status={MediaStatus.PARTIALLY_AVAILABLE}
                                />
                              </div>
                            </>
                          )}
                          {mSeason?.status === MediaStatus.AVAILABLE && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="success">
                                  {intl.formatMessage(globalMessages.available)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini
                                  status={MediaStatus.AVAILABLE}
                                />
                              </div>
                            </>
                          )}
                          {mSeason?.status === MediaStatus.DELETED &&
                            request?.status !== MediaRequestStatus.APPROVED && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="danger">
                                    {intl.formatMessage(globalMessages.deleted)}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini
                                    status={MediaStatus.DELETED}
                                  />
                                </div>
                              </>
                            )}
                          {((!mSeason4k &&
                            request4k?.status ===
                              MediaRequestStatus.APPROVED) ||
                            mSeason4k?.status4k === MediaStatus.PROCESSING ||
                            (request4k?.status ===
                              MediaRequestStatus.APPROVED &&
                              mSeason4k?.status4k === MediaStatus.DELETED)) &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="primary">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(
                                        globalMessages.requested
                                      ),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini
                                    status={MediaStatus.PROCESSING}
                                    is4k={true}
                                  />
                                </div>
                              </>
                            )}
                          {((!mSeason4k &&
                            request4k?.status === MediaRequestStatus.PENDING) ||
                            mSeason?.status4k === MediaStatus.PENDING) &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="warning">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(
                                        globalMessages.pending
                                      ),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini
                                    status={MediaStatus.PENDING}
                                    is4k={true}
                                  />
                                </div>
                              </>
                            )}
                          {mSeason4k?.status4k ===
                            MediaStatus.PARTIALLY_AVAILABLE &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="success">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(
                                        globalMessages.partiallyavailable
                                      ),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini
                                    status={MediaStatus.PARTIALLY_AVAILABLE}
                                    is4k={true}
                                  />
                                </div>
                              </>
                            )}
                          {mSeason4k?.status4k === MediaStatus.AVAILABLE &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="success">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(
                                        globalMessages.available
                                      ),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini
                                    status={MediaStatus.AVAILABLE}
                                    is4k={true}
                                  />
                                </div>
                              </>
                            )}
                          {mSeason4k?.status4k === MediaStatus.DELETED &&
                            request4k?.status !== MediaRequestStatus.APPROVED &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="danger">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(
                                        globalMessages.deleted
                                      ),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini
                                    status={MediaStatus.DELETED}
                                    is4k={true}
                                  />
                                </div>
                              </>
                            )}
                          <ChevronDownIcon
                            className={`${
                              open ? 'rotate-180' : ''
                            } h-6 w-6 text-gray-500`}
                          />
                        </Disclosure.Button>
                        <Transition
                          show={open}
                          enter="transition-opacity duration-100 ease-out"
                          enterFrom="opacity-0"
                          enterTo="opacity-100"
                          leave="transition-opacity duration-75 ease-out"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                          // Not sure why this transition is adding a margin without this here
                          style={{ margin: '0px' }}
                        >
                          <Disclosure.Panel className="w-full rounded-b-md border-b border-l border-r border-gray-700 px-4 pb-2">
                            <Season
                              tvId={data.id}
                              seasonNumber={season.seasonNumber}
                            />
                          </Disclosure.Panel>
                        </Transition>
                      </>
                    )}
                  </Disclosure>
                );
              })}
          </div>
        </div>
        <div className="media-overview-right">
          <div className="media-facts">
            {(!!data.voteCount ||
              (ratingData?.criticsRating && !!ratingData?.criticsScore) ||
              (ratingData?.audienceRating && !!ratingData?.audienceScore)) && (
              <div className="media-ratings">
                {ratingData?.criticsRating && !!ratingData?.criticsScore && (
                  <Tooltip
                    content={intl.formatMessage(messages.rtcriticsscore)}
                  >
                    <a
                      href={ratingData.url}
                      className="media-rating"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ratingData.criticsRating === 'Rotten' ? (
                        <RTRotten className="mr-1 w-6" />
                      ) : (
                        <RTFresh className="mr-1 w-6" />
                      )}
                      <span>{ratingData.criticsScore}%</span>
                    </a>
                  </Tooltip>
                )}
                {ratingData?.audienceRating && !!ratingData?.audienceScore && (
                  <Tooltip
                    content={intl.formatMessage(messages.rtaudiencescore)}
                  >
                    <a
                      href={ratingData.url}
                      className="media-rating"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ratingData.audienceRating === 'Spilled' ? (
                        <RTAudRotten className="mr-1 w-6" />
                      ) : (
                        <RTAudFresh className="mr-1 w-6" />
                      )}
                      <span>{ratingData.audienceScore}%</span>
                    </a>
                  </Tooltip>
                )}
                {!!data.voteCount && (
                  <Tooltip content={intl.formatMessage(messages.tmdbuserscore)}>
                    <a
                      href={`https://www.themoviedb.org/tv/${data.id}?language=${locale}`}
                      className="media-rating"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <TmdbLogo className="mr-1 w-6" />
                      <span>{Math.round(data.voteAverage * 10)}%</span>
                    </a>
                  </Tooltip>
                )}
              </div>
            )}
            {data.originalName &&
              data.originalLanguage !== locale.slice(0, 2) && (
                <div className="media-fact">
                  <span>{intl.formatMessage(messages.originaltitle)}</span>
                  <span className="media-fact-value">{data.originalName}</span>
                </div>
              )}
            {data.keywords.some(
              (keyword) => keyword.id === ANIME_KEYWORD_ID
            ) && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.showtype)}</span>
                <span className="media-fact-value">
                  {intl.formatMessage(messages.anime)}
                </span>
              </div>
            )}
            <div className="media-fact">
              <span>{intl.formatMessage(globalMessages.status)}</span>
              <span className="media-fact-value">{data.status}</span>
            </div>
            {data.firstAirDate && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.firstAirDate)}</span>
                <span className="media-fact-value">
                  {intl.formatDate(data.firstAirDate, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
              </div>
            )}
            {data.nextEpisodeToAir &&
              data.nextEpisodeToAir.airDate &&
              data.nextEpisodeToAir.airDate !== data.firstAirDate && (
                <div className="media-fact">
                  <span>{intl.formatMessage(messages.nextAirDate)}</span>
                  <span className="media-fact-value">
                    {intl.formatDate(data.nextEpisodeToAir.airDate, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                </div>
              )}
            {data.episodeRunTime.length > 0 && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.episodeRuntime)}</span>
                <span className="media-fact-value">
                  {intl.formatMessage(messages.episodeRuntimeMinutes, {
                    runtime: data.episodeRunTime[0],
                  })}
                </span>
              </div>
            )}
            {data.originalLanguage && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.originallanguage)}</span>
                <span className="media-fact-value">
                  <Link href={`/discover/tv/language/${data.originalLanguage}`}>
                    {intl.formatDisplayName(data.originalLanguage, {
                      type: 'language',
                      fallback: 'none',
                    }) ??
                      data.spokenLanguages.find(
                        (lng) => lng.iso_639_1 === data.originalLanguage
                      )?.name}
                  </Link>
                </span>
              </div>
            )}
            {data.productionCountries.length > 0 && (
              <div className="media-fact">
                <span>
                  {intl.formatMessage(messages.productioncountries, {
                    countryCount: data.productionCountries.length,
                  })}
                </span>
                <span className="media-fact-value">
                  {data.productionCountries.map((c) => {
                    return (
                      <span
                        className="flex items-center justify-end"
                        key={`prodcountry-${c.iso_3166_1}`}
                      >
                        {countries.includes(c.iso_3166_1) && (
                          <span
                            className={`mr-1.5 text-xs leading-5 flag:${c.iso_3166_1}`}
                          />
                        )}
                        <span>
                          {intl.formatDisplayName(c.iso_3166_1, {
                            type: 'region',
                            fallback: 'none',
                          }) ?? c.name}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </div>
            )}
            {data.networks.length > 0 && (
              <div className="media-fact">
                <span>
                  {intl.formatMessage(messages.network, {
                    networkCount: data.networks.length,
                  })}
                </span>
                <span className="media-fact-value">
                  {data.networks
                    .map((n) => (
                      <Link
                        href={`/discover/tv/network/${n.id}`}
                        key={`network-${n.id}`}
                      >
                        {n.name}
                      </Link>
                    ))
                    .reduce((prev, curr) => (
                      <>
                        {intl.formatMessage(globalMessages.delimitedlist, {
                          a: prev,
                          b: curr,
                        })}
                      </>
                    ))}
                </span>
              </div>
            )}
            {!!streamingProviders.length && (
              <div className="media-fact flex-col gap-1">
                <span>{intl.formatMessage(messages.streamingproviders)}</span>
                <span className="media-fact-value flex flex-row flex-wrap gap-5">
                  {streamingProviders.map((p) => {
                    return (
                      <Tooltip content={p.name}>
                        <span
                          className="opacity-50 transition duration-300 hover:opacity-100"
                          key={`provider-${p.id}`}
                        >
                          <CachedImage
                            type="tmdb"
                            src={'https://image.tmdb.org/t/p/w45/' + p.logoPath}
                            alt={p.name}
                            width={32}
                            height={32}
                            className="rounded-md"
                          />
                        </span>
                      </Tooltip>
                    );
                  })}
                </span>
              </div>
            )}
            <div className="media-fact">
              <ExternalLinkBlock
                mediaType="tv"
                tmdbId={data.id}
                tvdbId={data.externalIds.tvdbId}
                imdbId={data.externalIds.imdbId}
                rtUrl={ratingData?.url}
                mediaUrl={plexUrl ?? plexUrl4k}
              />
            </div>
          </div>
        </div>
      </div>
      {data.credits.cast.length > 0 && (
        <>
          <div className="slider-header">
            <Link
              href="/tv/[tvId]/cast"
              as={`/tv/${data.id}/cast`}
              className="slider-title"
            >
              <span>{intl.formatMessage(messages.cast)}</span>
              <ArrowRightCircleIcon />
            </Link>
          </div>
          <Slider
            sliderKey="cast"
            isLoading={false}
            isEmpty={false}
            items={data.credits.cast.slice(0, 20).map((person) => (
              <PersonCard
                key={`cast-item-${person.id}`}
                personId={person.id}
                name={person.name}
                subName={person.character}
                profilePath={person.profilePath}
              />
            ))}
          />
        </>
      )}
      <MediaSlider
        sliderKey="recommendations"
        title={intl.formatMessage(messages.recommendations)}
        url={`/api/v1/tv/${router.query.tvId}/recommendations`}
        linkUrl={`/tv/${data.id}/recommendations`}
        hideWhenEmpty
      />
      <MediaSlider
        sliderKey="similar"
        title={intl.formatMessage(messages.similar)}
        url={`/api/v1/tv/${router.query.tvId}/similar`}
        linkUrl={`/tv/${data.id}/similar`}
        hideWhenEmpty
      />
      <div className="extra-bottom-space relative" />
    </div>
    ) : (
    /* ── AMOLED full-bleed layout ── */
    <div className="relative bg-black">
      <PageTitle title={data.name} />
      <BlocklistModal
        tmdbId={data.id}
        type="tv"
        show={showBlocklistModal}
        onCancel={closeBlocklistModal}
        onComplete={onClickHideItemBtn}
        isUpdating={isBlocklistUpdating}
      />
      <IssueModal
        onCancel={() => setShowIssueModal(false)}
        show={showIssueModal}
        mediaType="tv"
        tmdbId={data.id}
      />
      <RequestModal
        tmdbId={data.id}
        show={showRequestModal}
        type="tv"
        onComplete={() => {
          revalidate();
          setShowRequestModal(false);
        }}
        onCancel={() => setShowRequestModal(false)}
      />
      <ManageSlideOver
        data={data}
        mediaType="tv"
        onClose={() => {
          setShowManager(false);
          router.push({
            pathname: router.pathname,
            query: { tvId: router.query.tvId },
          });
        }}
        revalidate={() => revalidate()}
        show={showManager}
      />

      {/* Hero — cinematic full-bleed */}
      <div className="relative -mx-4 -mt-16 min-h-[100svh] sm:h-[82vh] sm:min-h-[520px] overflow-visible sm:overflow-hidden">
        <CachedImage
          type="tmdb"
          alt=""
          src={
            data.backdropPath
              ? `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data.backdropPath}`
              : data.posterPath
                ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.posterPath}`
                : '/images/seerr_poster_not_found.png'
          }
          fill
          style={{
            objectFit: 'cover',
            objectPosition: data.backdropPath ? 'center top' : 'center center',
          }}
          priority
        />
        <div className="absolute inset-0 bg-black/25" />
        {/* Mobile: blur + black overlay from middle to bottom */}
        <div
          className="absolute inset-0 sm:hidden"
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: 'rgba(0,0,0,0.55)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 50%)',
          }}
        />
        {/* Desktop top vignette */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/70 to-transparent hidden sm:block" />
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '65%',
            background:
              'linear-gradient(to top, #000 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.4) 70%, transparent 100%)',
          }}
        />

        {/* Poster + title + actions */}
        <div className="absolute inset-0 flex flex-col justify-center gap-3 px-4 pt-28 sm:inset-auto sm:bottom-0 sm:left-0 sm:right-0 sm:flex-row sm:items-end sm:gap-5 sm:pb-8 sm:pt-0 sm:px-6 lg:px-8">
          <div className="w-2/5 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-2xl mt-[50px] sm:mt-0 sm:w-32 lg:w-36">
            <CachedImage
              type="tmdb"
              src={
                data.posterPath
                  ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.posterPath}`
                  : '/images/seerr_poster_not_found.png'
              }
              alt=""
              width={600}
              height={900}
              style={{ width: '100%', height: 'auto' }}
              priority
            />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap gap-2 mb-3">
              <StatusBadge
                status={data.mediaInfo?.status}
                downloadItem={data.mediaInfo?.downloadStatus}
                title={data.name}
                inProgress={(data.mediaInfo?.downloadStatus ?? []).length > 0}
                tmdbId={data.mediaInfo?.tmdbId}
                mediaType="tv"
                plexUrl={plexUrl}
                serviceUrl={data.mediaInfo?.serviceUrl}
              />
              {settings.currentSettings.series4kEnabled &&
                hasPermission(
                  [
                    Permission.MANAGE_REQUESTS,
                    Permission.REQUEST_4K,
                    Permission.REQUEST_4K_TV,
                  ],
                  { type: 'or' }
                ) && (
                  <StatusBadge
                    status={data.mediaInfo?.status4k}
                    downloadItem={data.mediaInfo?.downloadStatus4k}
                    title={data.name}
                    is4k
                    inProgress={
                      (data.mediaInfo?.downloadStatus4k ?? []).length > 0
                    }
                    tmdbId={data.mediaInfo?.tmdbId}
                    mediaType="tv"
                    plexUrl={plexUrl4k}
                    serviceUrl={data.mediaInfo?.serviceUrl4k}
                  />
                )}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight mb-2" data-testid="media-title">
              {data.name}
              {data.firstAirDate && (
                <span className="ml-3 text-2xl sm:text-3xl font-normal text-white/40">
                  ({data.firstAirDate.slice(0, 4)})
                </span>
              )}
            </h1>
            {seriesAttributes.length > 0 && (
              <div className="flex items-center flex-wrap text-sm text-white/60 mb-5">
                {seriesAttributes
                  .map((t, k) => <span key={k}>{t}</span>)
                  .reduce((prev, curr) => (
                    <>
                      {prev}
                      <span className="mx-2 text-white/20">|</span>
                      {curr}
                    </>
                  ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              {showHideButton &&
                data?.mediaInfo?.status !== MediaStatus.PROCESSING &&
                data?.mediaInfo?.status !== MediaStatus.AVAILABLE &&
                data?.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE &&
                data?.mediaInfo?.status !== MediaStatus.PENDING &&
                data?.mediaInfo?.status !== MediaStatus.BLOCKLISTED && (
                  <Tooltip content={intl.formatMessage(globalMessages.addToBlocklist)}>
                    <button
                      onClick={() => setShowBlocklistModal(true)}
                      className="z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/[0.12] text-white/70 hover:text-white transition"
                    >
                      <EyeSlashIcon className="h-5 w-5" />
                    </button>
                  </Tooltip>
                )}
              {data?.mediaInfo?.status !== MediaStatus.BLOCKLISTED &&
                user?.userType !== UserType.PLEX && (
                  <>
                    {toggleWatchlist ? (
                      <Tooltip content={intl.formatMessage(messages.addtowatchlist)}>
                        <button
                          onClick={onClickWatchlistBtn}
                          className="z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/[0.12] text-white/70 hover:text-white transition"
                        >
                          {isUpdating ? <Spinner className="h-5 w-5" /> : <StarIcon className="h-5 w-5 text-amber-300" />}
                        </button>
                      </Tooltip>
                    ) : (
                      <Tooltip content={intl.formatMessage(messages.removefromwatchlist)}>
                        <button
                          onClick={onClickDeleteWatchlistBtn}
                          className="z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/[0.12] text-white/70 hover:text-white transition"
                        >
                          {isUpdating ? <Spinner className="h-5 w-5" /> : <MinusCircleIcon className="h-5 w-5" />}
                        </button>
                      </Tooltip>
                    )}
                  </>
                )}
              <div className="z-20">
                <PlayButton links={mediaLinks} />
              </div>
              <RequestButton
                mediaType="tv"
                onUpdate={() => revalidate()}
                tmdbId={data?.id}
                media={data?.mediaInfo}
                isShowComplete={isComplete}
                is4kShowComplete={is4kComplete}
              />
              {(data.mediaInfo?.status === MediaStatus.AVAILABLE ||
                data.mediaInfo?.status === MediaStatus.PARTIALLY_AVAILABLE ||
                (settings.currentSettings.series4kEnabled &&
                  hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_TV], {
                    type: 'or',
                  }) &&
                  (data.mediaInfo?.status4k === MediaStatus.AVAILABLE ||
                    data?.mediaInfo?.status4k === MediaStatus.PARTIALLY_AVAILABLE))) &&
                hasPermission(
                  [Permission.CREATE_ISSUES, Permission.MANAGE_ISSUES],
                  { type: 'or' }
                ) && (
                  <Tooltip content={intl.formatMessage(messages.reportissue)}>
                    <button
                      onClick={() => setShowIssueModal(true)}
                      className="z-40 relative flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/[0.12] text-white/70 hover:text-white transition"
                    >
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      {(data.mediaInfo?.issues.filter((issue) => issue.status === IssueStatus.OPEN) ?? []).length > 0 && (
                        <>
                          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-600" />
                          <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-600" />
                        </>
                      )}
                    </button>
                  </Tooltip>
                )}
              {hasPermission(Permission.MANAGE_REQUESTS) && data.mediaInfo && (
                <Tooltip content={intl.formatMessage(messages.manageseries)}>
                  <button
                    onClick={() => setShowManager(true)}
                    className="z-40 relative flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-md ring-1 ring-white/[0.12] text-white/70 hover:text-white transition"
                  >
                    <CogIcon className="h-5 w-5" />
                    {hasPermission(
                      [Permission.MANAGE_ISSUES, Permission.VIEW_ISSUES],
                      { type: 'or' }
                    ) &&
                      (
                        data.mediaInfo?.issues.filter(
                          (issue) => issue.status === IssueStatus.OPEN
                        ) ?? []
                      ).length > 0 && (
                        <>
                          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-600" />
                          <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-600" />
                        </>
                      )}
                  </button>
                </Tooltip>
              )}
            </div>
            {/* Overview — mobile only, shown in hero */}
            <div className="sm:hidden mt-4">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  {intl.formatMessage(messages.overview)}
                </p>
                {data.tagline && (
                  <>
                    <span className="text-white/20">|</span>
                    <p className="text-violet-400/80 text-xs font-medium italic truncate">{data.tagline}</p>
                  </>
                )}
              </div>
              <p className="text-xs leading-relaxed text-white/60">
                {data.overview || intl.formatMessage(messages.overviewunavailable)}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute absolute-bottom-shift inset-x-0 flex justify-center animate-bounce opacity-30 pointer-events-none">
          <ChevronDownIcon className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Content sections */}
      <div className="divide-y divide-white/[0.06] pt-6 pb-8">
        {/* Overview + crew + keywords */}
        <div className="py-6">
          <div className="hidden sm:flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
              {intl.formatMessage(messages.overview)}
            </h2>
            {data.tagline && (
              <>
                <span className="text-white/20">|</span>
                <p className="text-violet-400/80 text-sm font-medium italic">
                  {data.tagline}
                </p>
              </>
            )}
          </div>
          <p className="hidden sm:block text-white/70 text-sm leading-relaxed">
            {data.overview || intl.formatMessage(messages.overviewunavailable)}
          </p>
          {sortedCrew.length > 0 && (
            <div className="relative -mt-[50px] pt-6 sm:mt-3">
              <div className="absolute inset-x-0 top-0 border-t border-white/[0.12]" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">{intl.formatMessage(messages.crew)}</h3>
                  <Link
                    href={`/tv/${data.id}/crew`}
                    className="flex items-center gap-1 text-xs text-violet-400/70 hover:text-violet-300 transition-colors"
                  >
                    {intl.formatMessage(messages.viewfullcrew)}
                    <ArrowRightCircleIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                  {(data.createdBy.length > 0
                    ? [
                        ...data.createdBy.map(
                          (person): Partial<Crew> => ({
                            id: person.id,
                            job: 'Creator',
                            name: person.name,
                          })
                        ),
                        ...sortedCrew,
                      ]
                    : sortedCrew
                  )
                    .slice(0, 6)
                    .map((person) => (
                      <div key={`crew-${person.job}-${person.id}`}>
                        <div className="text-[11px] text-white/35 mb-0.5 uppercase tracking-wide">{person.job}</div>
                        <Link href={`/person/${person.id}`} className="text-sm text-white/80 hover:text-violet-300 transition-colors">
                          {person.name}
                        </Link>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          {data.keywords.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2.5">{intl.formatMessage(messages.keywords)}</h3>
              <div className="flex flex-wrap gap-1.5">
                {data.keywords.slice(0, 8).map((keyword) => (
                  <Link
                    href={`/discover/tv?keywords=${keyword.id}`}
                    key={`keyword-id-${keyword.id}`}
                    className="rounded-full px-2.5 py-0.5 text-xs text-white/50 ring-1 ring-white/10 hover:text-white/80 hover:ring-white/25 transition-colors"
                  >
                    {keyword.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ratings + Facts */}
        <div className="py-6 grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
          {(!!data.voteCount ||
            (ratingData?.criticsRating && !!ratingData?.criticsScore) ||
            (ratingData?.audienceRating && !!ratingData?.audienceScore)) && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">{intl.formatMessage(messages.ratings)}</h2>
              <div className="flex flex-wrap gap-5">
                {ratingData?.criticsRating && !!ratingData?.criticsScore && (
                  <Tooltip content={intl.formatMessage(messages.rtcriticsscore)}>
                    <a
                      href={ratingData.url}
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ratingData.criticsRating === 'Rotten' ? <RTRotten className="w-6" /> : <RTFresh className="w-6" />}
                      <span>{ratingData.criticsScore}%</span>
                    </a>
                  </Tooltip>
                )}
                {ratingData?.audienceRating && !!ratingData?.audienceScore && (
                  <Tooltip content={intl.formatMessage(messages.rtaudiencescore)}>
                    <a
                      href={ratingData.url}
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {ratingData.audienceRating === 'Spilled' ? <RTAudRotten className="w-6" /> : <RTAudFresh className="w-6" />}
                      <span>{ratingData.audienceScore}%</span>
                    </a>
                  </Tooltip>
                )}
                {!!data.voteCount && (
                  <Tooltip content={intl.formatMessage(messages.tmdbuserscore)}>
                    <a
                      href={`https://www.themoviedb.org/tv/${data.id}?language=${locale}`}
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <TmdbLogo className="mr-1 w-6" />
                      <span>{Math.round(data.voteAverage * 10)}%</span>
                    </a>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">{intl.formatMessage(messages.details)}</h2>
            <dl className="space-y-2.5">
              {data.originalName && data.originalLanguage !== locale.slice(0, 2) && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">{intl.formatMessage(messages.originaltitle)}</dt>
                  <dd className="text-white/80 text-right ml-4">{data.originalName}</dd>
                </div>
              )}
              {data.keywords.some((keyword) => keyword.id === ANIME_KEYWORD_ID) && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">{intl.formatMessage(messages.showtype)}</dt>
                  <dd className="text-white/80">{intl.formatMessage(messages.anime)}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="text-white/40">{intl.formatMessage(globalMessages.status)}</dt>
                <dd className="text-white/80">{data.status}</dd>
              </div>
              {data.firstAirDate && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">{intl.formatMessage(messages.firstAirDate)}</dt>
                  <dd className="text-white/80">
                    {intl.formatDate(data.firstAirDate, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </dd>
                </div>
              )}
              {data.nextEpisodeToAir &&
                data.nextEpisodeToAir.airDate &&
                data.nextEpisodeToAir.airDate !== data.firstAirDate && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-white/40">{intl.formatMessage(messages.nextAirDate)}</dt>
                    <dd className="text-white/80">
                      {intl.formatDate(data.nextEpisodeToAir.airDate, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </dd>
                  </div>
                )}
              {data.episodeRunTime.length > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">{intl.formatMessage(messages.episodeRuntime)}</dt>
                  <dd className="text-white/80">
                    {intl.formatMessage(messages.episodeRuntimeMinutes, {
                      runtime: data.episodeRunTime[0],
                    })}
                  </dd>
                </div>
              )}
              {data.originalLanguage && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">{intl.formatMessage(messages.originallanguage)}</dt>
                  <dd className="text-white/80">
                    <Link href={`/discover/tv/language/${data.originalLanguage}`} className="hover:text-violet-300 transition-colors">
                      {intl.formatDisplayName(data.originalLanguage, {
                        type: 'language',
                        fallback: 'none',
                      }) ??
                        data.spokenLanguages.find(
                          (lng) => lng.iso_639_1 === data.originalLanguage
                        )?.name}
                    </Link>
                  </dd>
                </div>
              )}
              {data.productionCountries.length > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">
                    {intl.formatMessage(messages.productioncountries, {
                      countryCount: data.productionCountries.length,
                    })}
                  </dt>
                  <dd className="text-white/80 text-right">
                    {data.productionCountries.map((c) => (
                      <span className="flex items-center justify-end" key={`prodcountry-${c.iso_3166_1}`}>
                        {countries.includes(c.iso_3166_1) && (
                          <span className={`mr-1.5 text-xs leading-5 flag:${c.iso_3166_1}`} />
                        )}
                        <span>
                          {intl.formatDisplayName(c.iso_3166_1, {
                            type: 'region',
                            fallback: 'none',
                          }) ?? c.name}
                        </span>
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {data.networks.length > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-white/40">
                    {intl.formatMessage(messages.network, {
                      networkCount: data.networks.length,
                    })}
                  </dt>
                  <dd className="text-white/80 text-right">
                    {data.networks
                      .map((n) => (
                        <Link
                          href={`/discover/tv/network/${n.id}`}
                          key={`network-${n.id}`}
                          className="block hover:text-violet-300 transition-colors"
                        >
                          {n.name}
                        </Link>
                      ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Seasons */}
        <div className="py-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
            {intl.formatMessage(messages.seasonstitle)}
          </h2>
          <div className="flex w-full flex-col space-y-2">
            {data.seasons
              .slice()
              .reverse()
              .filter(
                (season) =>
                  settings.currentSettings.enableSpecialEpisodes ||
                  season.seasonNumber !== 0
              )
              .map((season) => {
                const show4k =
                  settings.currentSettings.series4kEnabled &&
                  hasPermission(
                    [
                      Permission.MANAGE_REQUESTS,
                      Permission.REQUEST_4K,
                      Permission.REQUEST_4K_TV,
                    ],
                    { type: 'or' }
                  );
                const mSeason = (data.mediaInfo?.seasons ?? []).find(
                  (s) =>
                    season.seasonNumber === s.seasonNumber &&
                    s.status !== MediaStatus.UNKNOWN
                );
                const mSeason4k = (data.mediaInfo?.seasons ?? []).find(
                  (s) =>
                    season.seasonNumber === s.seasonNumber &&
                    s.status4k !== MediaStatus.UNKNOWN
                );
                const request = (data.mediaInfo?.requests ?? [])
                  .filter(
                    (r) =>
                      !!r.seasons.find(
                        (s) => s.seasonNumber === season.seasonNumber
                      ) && !r.is4k
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )[0];
                const request4k = (data.mediaInfo?.requests ?? [])
                  .filter(
                    (r) =>
                      !!r.seasons.find(
                        (s) => s.seasonNumber === season.seasonNumber
                      ) && r.is4k
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )[0];

                if (season.episodeCount === 0) {
                  return null;
                }

                return (
                  <Disclosure key={`season-discoslure-${season.seasonNumber}`}>
                    {({ open }) => (
                      <>
                        <Disclosure.Button
                          className={`mt-2 flex w-full items-center justify-between space-x-2 border-gray-700 bg-gray-800 px-4 py-2 text-gray-200 ${
                            open
                              ? 'rounded-t-md border-l border-r border-t'
                              : 'rounded-md border'
                          }`}
                        >
                          <div className="flex flex-1 items-center space-x-2 text-lg">
                            <span>
                              {season.seasonNumber === 0
                                ? intl.formatMessage(globalMessages.specials)
                                : intl.formatMessage(messages.seasonnumber, {
                                    seasonNumber: season.seasonNumber,
                                  })}
                            </span>
                            <Badge badgeType="dark">
                              {intl.formatMessage(messages.episodeCount, {
                                episodeCount: season.episodeCount,
                              })}
                            </Badge>
                          </div>
                          {((!mSeason &&
                            request?.status === MediaRequestStatus.APPROVED) ||
                            mSeason?.status === MediaStatus.PROCESSING ||
                            (request?.status === MediaRequestStatus.APPROVED &&
                              mSeason?.status === MediaStatus.DELETED)) && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="primary">
                                  {intl.formatMessage(globalMessages.requested)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.PROCESSING} />
                              </div>
                            </>
                          )}
                          {((!mSeason &&
                            request?.status === MediaRequestStatus.PENDING) ||
                            mSeason?.status === MediaStatus.PENDING) && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="warning">
                                  {intl.formatMessage(globalMessages.pending)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.PENDING} />
                              </div>
                            </>
                          )}
                          {mSeason?.status === MediaStatus.PARTIALLY_AVAILABLE && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="success">
                                  {intl.formatMessage(globalMessages.partiallyavailable)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.PARTIALLY_AVAILABLE} />
                              </div>
                            </>
                          )}
                          {mSeason?.status === MediaStatus.AVAILABLE && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="success">
                                  {intl.formatMessage(globalMessages.available)}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.AVAILABLE} />
                              </div>
                            </>
                          )}
                          {mSeason?.status === MediaStatus.DELETED &&
                            request?.status !== MediaRequestStatus.APPROVED && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="danger">
                                    {intl.formatMessage(globalMessages.deleted)}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini status={MediaStatus.DELETED} />
                                </div>
                              </>
                            )}
                          {((!mSeason4k &&
                            request4k?.status === MediaRequestStatus.APPROVED) ||
                            mSeason4k?.status4k === MediaStatus.PROCESSING ||
                            (request4k?.status === MediaRequestStatus.APPROVED &&
                              mSeason4k?.status4k === MediaStatus.DELETED)) &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="primary">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(globalMessages.requested),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini status={MediaStatus.PROCESSING} is4k={true} />
                                </div>
                              </>
                            )}
                          {((!mSeason4k &&
                            request4k?.status === MediaRequestStatus.PENDING) ||
                            mSeason?.status4k === MediaStatus.PENDING) &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="warning">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(globalMessages.pending),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini status={MediaStatus.PENDING} is4k={true} />
                                </div>
                              </>
                            )}
                          {mSeason4k?.status4k === MediaStatus.PARTIALLY_AVAILABLE && show4k && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="success">
                                  {intl.formatMessage(messages.status4k, {
                                    status: intl.formatMessage(globalMessages.partiallyavailable),
                                  })}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.PARTIALLY_AVAILABLE} is4k={true} />
                              </div>
                            </>
                          )}
                          {mSeason4k?.status4k === MediaStatus.AVAILABLE && show4k && (
                            <>
                              <div className="hidden md:flex">
                                <Badge badgeType="success">
                                  {intl.formatMessage(messages.status4k, {
                                    status: intl.formatMessage(globalMessages.available),
                                  })}
                                </Badge>
                              </div>
                              <div className="flex md:hidden">
                                <StatusBadgeMini status={MediaStatus.AVAILABLE} is4k={true} />
                              </div>
                            </>
                          )}
                          {mSeason4k?.status4k === MediaStatus.DELETED &&
                            request4k?.status !== MediaRequestStatus.APPROVED &&
                            show4k && (
                              <>
                                <div className="hidden md:flex">
                                  <Badge badgeType="danger">
                                    {intl.formatMessage(messages.status4k, {
                                      status: intl.formatMessage(globalMessages.deleted),
                                    })}
                                  </Badge>
                                </div>
                                <div className="flex md:hidden">
                                  <StatusBadgeMini status={MediaStatus.DELETED} is4k={true} />
                                </div>
                              </>
                            )}
                          <ChevronDownIcon
                            className={`${open ? 'rotate-180' : ''} h-6 w-6 text-gray-500`}
                          />
                        </Disclosure.Button>
                        <Transition
                          show={open}
                          enter="transition-opacity duration-100 ease-out"
                          enterFrom="opacity-0"
                          enterTo="opacity-100"
                          leave="transition-opacity duration-75 ease-out"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                          style={{ margin: '0px' }}
                        >
                          <Disclosure.Panel className="w-full rounded-b-md border-b border-l border-r border-gray-700 px-4 pb-2">
                            <Season
                              tvId={data.id}
                              seasonNumber={season.seasonNumber}
                            />
                          </Disclosure.Panel>
                        </Transition>
                      </>
                    )}
                  </Disclosure>
                );
              })}
          </div>
        </div>

        {/* Streaming providers */}
        {!!streamingProviders.length && (
          <div className="py-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-4">
              {intl.formatMessage(messages.streamingproviders)}
            </h2>
            <div className="flex flex-wrap gap-4">
              {streamingProviders.map((p) => (
                <Tooltip content={p.name} key={`provider-${p.id}`}>
                  <span className="opacity-60 hover:opacity-100 transition-opacity">
                    <CachedImage
                      type="tmdb"
                      src={'https://image.tmdb.org/t/p/w45/' + p.logoPath}
                      alt={p.name}
                      width={40}
                      height={40}
                      className="rounded-lg"
                    />
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* External links */}
        <div className="py-6">
          <ExternalLinkBlock
            mediaType="tv"
            tmdbId={data.id}
            tvdbId={data.externalIds.tvdbId}
            imdbId={data.externalIds.imdbId}
            rtUrl={ratingData?.url}
            mediaUrl={plexUrl ?? plexUrl4k}
          />
        </div>
      </div>

      {/* Cast */}
      {data.credits.cast.length > 0 && (
        <>
          <div className="slider-header">
            <Link
              href="/tv/[tvId]/cast"
              as={`/tv/${data.id}/cast`}
              className="slider-title"
            >
              <span>{intl.formatMessage(messages.cast)}</span>
              <ArrowRightCircleIcon />
            </Link>
          </div>
          <Slider
            sliderKey="cast"
            isLoading={false}
            isEmpty={false}
            items={data.credits.cast.slice(0, 20).map((person) => (
              <PersonCard
                key={`cast-item-${person.id}`}
                personId={person.id}
                name={person.name}
                subName={person.character}
                profilePath={person.profilePath}
              />
            ))}
          />
        </>
      )}
      <MediaSlider
        sliderKey="recommendations"
        title={intl.formatMessage(messages.recommendations)}
        url={`/api/v1/tv/${router.query.tvId}/recommendations`}
        linkUrl={`/tv/${data.id}/recommendations`}
        hideWhenEmpty
      />
      <MediaSlider
        sliderKey="similar"
        title={intl.formatMessage(messages.similar)}
        url={`/api/v1/tv/${router.query.tvId}/similar`}
        linkUrl={`/tv/${data.id}/similar`}
        hideWhenEmpty
      />
      <div className="extra-bottom-space relative" />
    </div>
    </>
  );
};

export default TvDetails;
