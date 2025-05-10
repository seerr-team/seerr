import BlacklistBlock from '@app/components/BlacklistBlock';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import SlideOver from '@app/components/Common/SlideOver';
import Tooltip from '@app/components/Common/Tooltip';
import DownloadBlock from '@app/components/DownloadBlock';
import IssueBlock from '@app/components/IssueBlock';
import RequestBlock from '@app/components/RequestBlock';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Bars4Icon, ServerIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  DocumentMinusIcon,
  TrashIcon,
} from '@heroicons/react/24/solid';
import { IssueStatus } from '@server/constants/issue';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { MediaWatchDataResponse } from '@server/interfaces/api/mediaInterfaces';
import type {
  RadarrSettings,
  SonarrSettings,
} from '@server/interfaces/settings';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.ManageSlideOver', {
  manageModalTitle: 'Manage {mediaType}',
  manageModalIssues: 'Open Issues',
  manageModalRequests: 'Requests',
  manageModalMedia: 'Media',
  manageModalMedia4k: '4K Media',
  manageModalAdvanced: 'Advanced',
  manageModalNoRequests: 'No requests.',
  manageModalClearMedia: 'Clear Data',
  manageModalClearMediaWarning:
    '* This will irreversibly remove all data for this {mediaType}, including any requests. If this item exists in your {mediaServerName} library, the media information will be recreated during the next scan.',
  manageModalRemoveMediaWarning:
    '* This will irreversibly remove this {mediaType} from {arr}, including all files.',
  openarr: 'Open in {arr}',
  removearr: 'Remove from {arr}',
  openarr4k: 'Open in 4K {arr}',
  removearr4k: 'Remove from 4K {arr}',
  downloadstatus: 'Downloads',
  markavailable: 'Mark as Available',
  mark4kavailable: 'Mark as Available in 4K',
  markallseasonsavailable: 'Mark All Seasons as Available',
  markallseasons4kavailable: 'Mark All Seasons as Available in 4K',
  opentautulli: 'Open in Tautulli',
  plays:
    '<strong>{playCount, number}</strong> {playCount, plural, one {play} other {plays}}',
  pastdays: 'Past {days, number} Days',
  alltime: 'All Time',
  playedby: 'Played By',
  movie: 'movie',
  tvshow: 'series',
});

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

interface ManageSlideOverProps {
  // mediaType: 'movie' | 'tv';
  show?: boolean;
  onClose: () => void;
  revalidate: () => void;
}

interface ManageSlideOverMovieProps extends ManageSlideOverProps {
  mediaType: 'movie';
  data: MovieDetails;
}

interface ManageSlideOverTvProps extends ManageSlideOverProps {
  mediaType: 'tv';
  data: TvDetails;
}

const ManageSlideOver = ({
  show,
  mediaType,
  onClose,
  data,
  revalidate,
}: ManageSlideOverMovieProps | ManageSlideOverTvProps) => {
  const { user: currentUser, hasPermission } = useUser();
  const intl = useIntl();
  const settings = useSettings();
  const { data: watchData } = useSWR<MediaWatchDataResponse>(
    settings.currentSettings.mediaServerType === MediaServerType.PLEX &&
      data.mediaInfo &&
      hasPermission(Permission.ADMIN)
      ? `/api/v1/media/${data.mediaInfo.id}/watch_data`
      : null
  );
  const { data: radarrData } = useSWR<RadarrSettings[]>(
    hasPermission(Permission.ADMIN) ? '/api/v1/settings/radarr' : null
  );
  const { data: sonarrData } = useSWR<SonarrSettings[]>(
    hasPermission(Permission.ADMIN) ? '/api/v1/settings/sonarr' : null
  );

  const deleteMedia = async () => {
    if (data.mediaInfo) {
      await axios.delete(`/api/v1/media/${data.mediaInfo.id}`);
      revalidate();
      onClose();
    }
  };

  const deleteMediaFile = async (is4k = false) => {
    if (data.mediaInfo) {
      await axios.delete(
        `/api/v1/media/${data.mediaInfo.id}/file?is4k=${is4k}`
      );
      await axios.delete(`/api/v1/media/${data.mediaInfo.id}`);
      revalidate();
      onClose();
    }
  };

  const isDefaultService = () => {
    if (data.mediaInfo) {
      if (data.mediaInfo.mediaType === MediaType.MOVIE) {
        return (
          radarrData?.find(
            (radarr) =>
              radarr.isDefault && radarr.id === data.mediaInfo?.serviceId
          ) !== undefined
        );
      } else {
        return (
          sonarrData?.find(
            (sonarr) =>
              sonarr.isDefault && sonarr.id === data.mediaInfo?.serviceId
          ) !== undefined
        );
      }
    }
    return false;
  };

  const markAvailable = async (is4k = false) => {
    if (data.mediaInfo) {
      await axios.post(`/api/v1/media/${data.mediaInfo?.id}/available`, {
        is4k,
        ...(mediaType === 'tv' && {
          seasons: data.seasons.filter((season) => season.seasonNumber !== 0),
        }),
      });
      revalidate();
    }
  };

  const requests =
    data.mediaInfo?.requests?.filter(
      (request) => request.status !== MediaRequestStatus.DECLINED
    ) ?? [];

  const openIssues =
    data.mediaInfo?.issues?.filter(
      (issue) => issue.status === IssueStatus.OPEN
    ) ?? [];

  const styledPlayCount = (playCount: number): JSX.Element => {
    return (
      <>
        {intl.formatMessage(messages.plays, {
          playCount,
          strong: (msg: React.ReactNode) => (
            <strong className="text-2xl font-semibold">{msg}</strong>
          ),
        })}
      </>
    );
  };

  return (
    <SlideOver
      show={show}
      title={intl.formatMessage(messages.manageModalTitle, {
        mediaType: intl.formatMessage(
          mediaType === 'movie' ? globalMessages.movie : globalMessages.tvshow
        ),
      })}
      onClose={() => onClose()}
      subText={isMovie(data) ? data.title : data.name}
    >
      <div className="space-y-6">
        {((data?.mediaInfo?.downloadStatus ?? []).length > 0 ||
          (data?.mediaInfo?.downloadStatus4k ?? []).length > 0) && (
          <div>
            <h3 className="mb-2 text-xl font-bold">
              {intl.formatMessage(messages.downloadstatus)}
            </h3>
            <div className="overflow-hidden rounded-md border border-gray-700 shadow">
              <ul>
                {data.mediaInfo?.downloadStatus?.map((status, index) => (
                  <Tooltip
                    key={`dl-status-${status.externalId}-${index}`}
                    content={status.title}
                  >
                    <li className="border-b border-gray-700 last:border-b-0">
                      <DownloadBlock downloadItem={status} />
                    </li>
                  </Tooltip>
                ))}
                {data.mediaInfo?.downloadStatus4k?.map((status, index) => (
                  <Tooltip
                    key={`dl-status-${status.externalId}-${index}`}
                    content={status.title}
                  >
                    <li className="border-b border-gray-700 last:border-b-0">
                      <DownloadBlock downloadItem={status} is4k />
                    </li>
                  </Tooltip>
                ))}
              </ul>
            </div>
          </div>
        )}
        {hasPermission([Permission.MANAGE_ISSUES, Permission.VIEW_ISSUES], {
          type: 'or',
        }) &&
          openIssues.length > 0 && (
            <div>
              <h3 className="mb-2 text-xl font-bold">
                {intl.formatMessage(messages.manageModalIssues)}
              </h3>
              <div className="overflow-hidden rounded-md border border-gray-700 shadow">
                <ul>
                  {openIssues.map((issue) => (
                    <li
                      key={`manage-issue-${issue.id}`}
                      className="border-b border-gray-700 last:border-b-0"
                    >
                      <IssueBlock issue={issue} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        {requests.length > 0 && (
          <div>
            <h3 className="mb-2 text-xl font-bold">
              {intl.formatMessage(messages.manageModalRequests)}
            </h3>
            <div className="overflow-hidden rounded-md border border-gray-700 shadow">
              <ul>
                {requests.map((request) => (
                  <li
                    key={`manage-request-${request.id}`}
                    className="border-b border-gray-700 last:border-b-0"
                  >
                    <RequestBlock
                      request={request}
                      onUpdate={() => revalidate()}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {data.mediaInfo?.status === MediaStatus.BLACKLISTED && (
          <div>
            <h3 className="mb-2 text-xl font-bold">
              {intl.formatMessage(globalMessages.blacklist)}
            </h3>
            <div className="overflow-hidden rounded-md border border-gray-700 shadow">
              <BlacklistBlock
                tmdbId={data.mediaInfo.tmdbId}
                onUpdate={() => revalidate()}
                onDelete={() => onClose()}
              />
            </div>
          </div>
        )}
        {hasPermission(Permission.ADMIN) &&
          (data.mediaInfo?.serviceUrl ||
            data.mediaInfo?.tautulliUrl ||
            watchData?.data) && (
            <div>
              <h3 className="mb-2 text-xl font-bold">
                {intl.formatMessage(messages.manageModalMedia)}
              </h3>
              <div className="space-y-2">
                {(watchData?.data || data.mediaInfo?.tautulliUrl) && (
                  <div>
                    {!!watchData?.data && (
                      <div
                        className={`grid grid-cols-1 divide-y divide-gray-700 overflow-hidden border-gray-700 text-sm text-gray-300 shadow ${
                          data.mediaInfo?.tautulliUrl
                            ? 'rounded-t-md border-x border-t'
                            : 'rounded-md border'
                        }`}
                      >
                        <div className="grid grid-cols-3 divide-x divide-gray-700">
                          <div className="px-4 py-3">
                            <div className="font-bold">
                              {intl.formatMessage(messages.pastdays, {
                                days: 7,
                              })}
                            </div>
                            <div className="text-white">
                              {styledPlayCount(watchData.data.playCount7Days)}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="font-bold">
                              {intl.formatMessage(messages.pastdays, {
                                days: 30,
                              })}
                            </div>
                            <div className="text-white">
                              {styledPlayCount(watchData.data.playCount30Days)}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="font-bold">
                              {intl.formatMessage(messages.alltime)}
                            </div>
                            <div className="text-white">
                              {styledPlayCount(watchData.data.playCount)}
                            </div>
                          </div>
                        </div>
                        {!!watchData.data.users.length && (
                          <div className="flex flex-row space-x-2 px-4 pt-3 pb-2">
                            <span className="shrink-0 font-bold leading-8">
                              {intl.formatMessage(messages.playedby)}
                            </span>
                            <span className="flex flex-row flex-wrap">
                              {watchData.data.users.map((user) => (
                                <Link
                                  href={
                                    currentUser?.id === user.id
                                      ? '/profile'
                                      : `/users/${user.id}`
                                  }
                                  key={`watch-user-${user.id}`}
                                  className="z-0 mb-1 -mr-2 shrink-0 hover:z-50"
                                >
                                  <Tooltip
                                    key={`watch-user-${user.id}`}
                                    content={user.displayName}
                                  >
                                    <CachedImage
                                      type="avatar"
                                      src={user.avatar}
                                      alt={user.displayName}
                                      className="h-8 w-8 scale-100 transform-gpu rounded-full object-cover ring-1 ring-gray-500 transition duration-300 hover:scale-105"
                                      width={32}
                                      height={32}
                                    />
                                  </Tooltip>
                                </Link>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {data.mediaInfo?.tautulliUrl && (
                      <a
                        href={data.mediaInfo.tautulliUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button
                          buttonType="ghost"
                          className={`w-full ${
                            watchData?.data ? 'rounded-t-none' : ''
                          }`}
                        >
                          <Bars4Icon />
                          <span>
                            {intl.formatMessage(messages.opentautulli)}
                          </span>
                        </Button>
                      </a>
                    )}
                  </div>
                )}
                {data.mediaInfo?.serviceUrl && (
                  <a
                    href={data?.mediaInfo?.serviceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Button buttonType="ghost" className="w-full">
                      <ServerIcon />
                      <span>
                        {intl.formatMessage(messages.openarr, {
                          arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
                        })}
                      </span>
                    </Button>
                  </a>
                )}

                {hasPermission(Permission.ADMIN) &&
                  data?.mediaInfo?.serviceUrl &&
                  isDefaultService() && (
                    <div>
                      <ConfirmButton
                        onClick={() => deleteMediaFile(false)}
                        confirmText={intl.formatMessage(
                          globalMessages.areyousure
                        )}
                        className="w-full"
                      >
                        <TrashIcon />
                        <span>
                          {intl.formatMessage(messages.removearr, {
                            arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
                          })}
                        </span>
                      </ConfirmButton>
                      <div className="mt-1 text-xs text-gray-400">
                        {intl.formatMessage(
                          messages.manageModalRemoveMediaWarning,
                          {
                            mediaType: intl.formatMessage(
                              mediaType === 'movie'
                                ? messages.movie
                                : messages.tvshow
                            ),
                            arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
                          }
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        {hasPermission(Permission.ADMIN) &&
          (data.mediaInfo?.serviceUrl4k ||
            data.mediaInfo?.tautulliUrl4k ||
            watchData?.data4k) && (
            <div>
              <h3 className="mb-2 text-xl font-bold">
                {intl.formatMessage(messages.manageModalMedia4k)}
              </h3>
              <div className="space-y-2">
                {(watchData?.data4k || data.mediaInfo?.tautulliUrl4k) && (
                  <div>
                    {watchData?.data4k && (
                      <div
                        className={`grid grid-cols-1 divide-y divide-gray-700 overflow-hidden border-gray-700 text-sm text-gray-300 shadow ${
                          data.mediaInfo?.tautulliUrl4k
                            ? 'rounded-t-md border-x border-t'
                            : 'rounded-md border'
                        }`}
                      >
                        <div className="grid grid-cols-3 divide-x divide-gray-700">
                          <div className="px-4 py-3">
                            <div className="font-bold">
                              {intl.formatMessage(messages.pastdays, {
                                days: 7,
                              })}
                            </div>
                            <div className="text-white">
                              {styledPlayCount(watchData.data4k.playCount7Days)}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="font-bold">
                              {intl.formatMessage(messages.pastdays, {
                                days: 30,
                              })}
                            </div>
                            <div className="text-white">
                              {styledPlayCount(
                                watchData.data4k.playCount30Days
                              )}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="font-bold">
                              {intl.formatMessage(messages.alltime)}
                            </div>
                            <div className="text-white">
                              {styledPlayCount(watchData.data4k.playCount)}
                            </div>
                          </div>
                        </div>
                        {!!watchData.data4k.users.length && (
                          <div className="flex flex-row space-x-2 px-4 pt-3 pb-2">
                            <span className="shrink-0 font-bold leading-8">
                              {intl.formatMessage(messages.playedby)}
                            </span>
                            <span className="flex flex-row flex-wrap">
                              {watchData.data4k.users.map((user) => (
                                <Link
                                  href={
                                    currentUser?.id === user.id
                                      ? '/profile'
                                      : `/users/${user.id}`
                                  }
                                  key={`watch-user-${user.id}`}
                                  className="z-0 mb-1 -mr-2 shrink-0 hover:z-50"
                                >
                                  <Tooltip
                                    key={`watch-user-${user.id}`}
                                    content={user.displayName}
                                  >
                                    <CachedImage
                                      type="avatar"
                                      src={user.avatar}
                                      alt={user.displayName}
                                      className="h-8 w-8 scale-100 transform-gpu rounded-full object-cover ring-1 ring-gray-500 transition duration-300 hover:scale-105"
                                      width={32}
                                      height={32}
                                    />
                                  </Tooltip>
                                </Link>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {data.mediaInfo?.tautulliUrl4k && (
                      <a
                        href={data.mediaInfo.tautulliUrl4k}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button
                          buttonType="ghost"
                          className={`w-full ${
                            watchData?.data4k ? 'rounded-t-none' : ''
                          }`}
                        >
                          <Bars4Icon />
                          <span>
                            {intl.formatMessage(messages.opentautulli)}
                          </span>
                        </Button>
                      </a>
                    )}
                  </div>
                )}
                {data?.mediaInfo?.serviceUrl4k && (
                  <>
                    <a
                      href={data?.mediaInfo?.serviceUrl4k}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <Button buttonType="ghost" className="w-full">
                        <ServerIcon />
                        <span>
                          {intl.formatMessage(messages.openarr4k, {
                            arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
                          })}
                        </span>
                      </Button>
                    </a>
                    {isDefaultService() && (
                      <div>
                        <ConfirmButton
                          onClick={() => deleteMediaFile(true)}
                          confirmText={intl.formatMessage(
                            globalMessages.areyousure
                          )}
                          className="w-full"
                        >
                          <TrashIcon />
                          <span>
                            {intl.formatMessage(messages.removearr4k, {
                              arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
                            })}
                          </span>
                        </ConfirmButton>
                        <div className="mt-1 text-xs text-gray-400">
                          {intl.formatMessage(
                            messages.manageModalRemoveMediaWarning,
                            {
                              mediaType: intl.formatMessage(
                                mediaType === 'movie'
                                  ? messages.movie
                                  : messages.tvshow
                              ),
                              arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
                            }
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        {hasPermission(Permission.ADMIN) &&
          data?.mediaInfo &&
          data.mediaInfo.status !== MediaStatus.BLACKLISTED && (
            <div>
              <h3 className="mb-2 text-xl font-bold">
                {intl.formatMessage(messages.manageModalAdvanced)}
              </h3>
              <div className="space-y-2">
                {data?.mediaInfo.status !== MediaStatus.AVAILABLE && (
                  <Button
                    onClick={() => markAvailable()}
                    className="w-full"
                    buttonType="success"
                  >
                    <CheckCircleIcon />
                    <span>
                      {intl.formatMessage(
                        mediaType === 'movie'
                          ? messages.markavailable
                          : messages.markallseasonsavailable
                      )}
                    </span>
                  </Button>
                )}
                {data?.mediaInfo.status4k !== MediaStatus.AVAILABLE &&
                  settings.currentSettings.series4kEnabled && (
                    <Button
                      onClick={() => markAvailable(true)}
                      className="w-full"
                      buttonType="success"
                    >
                      <CheckCircleIcon />
                      <span>
                        {intl.formatMessage(
                          mediaType === 'movie'
                            ? messages.mark4kavailable
                            : messages.markallseasons4kavailable
                        )}
                      </span>
                    </Button>
                  )}
                <div>
                  <ConfirmButton
                    onClick={() => deleteMedia()}
                    confirmText={intl.formatMessage(globalMessages.areyousure)}
                    className="w-full"
                  >
                    <DocumentMinusIcon />
                    <span>
                      {intl.formatMessage(messages.manageModalClearMedia)}
                    </span>
                  </ConfirmButton>
                  <div className="mt-2 text-xs text-gray-400">
                    {intl.formatMessage(messages.manageModalClearMediaWarning, {
                      mediaType: intl.formatMessage(
                        mediaType === 'movie' ? messages.movie : messages.tvshow
                      ),
                      mediaServerName:
                        settings.currentSettings.mediaServerType ===
                        MediaServerType.EMBY
                          ? 'Emby'
                          : settings.currentSettings.mediaServerType ===
                            MediaServerType.PLEX
                          ? 'Plex'
                          : 'Jellyfin',
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </SlideOver>
  );
};

export default ManageSlideOver;
