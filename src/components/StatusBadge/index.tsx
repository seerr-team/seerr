import Spinner from '@app/assets/spinner.svg';
import Badge from '@app/components/Common/Badge';
import Tooltip from '@app/components/Common/Tooltip';
import DownloadBlock from '@app/components/DownloadBlock';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { MediaStatus } from '@server/constants/media';
import { MediaServerType } from '@server/constants/server';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import type { IntlShape } from 'react-intl';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.StatusBadge', {
  status: '{status}',
  status4k: '4K {status}',
  playonplex: 'Play on {mediaServerName}',
  openinarr: 'Open in {arr}',
  managemedia: 'Manage {mediaType}',
  seasonnumber: 'S{seasonNumber}',
  seasonepisodenumber: 'S{seasonNumber}E{episodeNumber}',
});

export const getStatusLabel = (
  intl: IntlShape,
  status?: MediaStatus,
  inProgress = false
): string => {
  if (inProgress) {
    return intl.formatMessage(globalMessages.processing);
  }

  switch (status) {
    case MediaStatus.AVAILABLE:
      return intl.formatMessage(globalMessages.available);
    case MediaStatus.PARTIALLY_AVAILABLE:
      return intl.formatMessage(globalMessages.partiallyavailable);
    case MediaStatus.PROCESSING:
      return intl.formatMessage(globalMessages.requested);
    case MediaStatus.PENDING:
      return intl.formatMessage(globalMessages.pending);
    case MediaStatus.BLOCKLISTED:
      return intl.formatMessage(globalMessages.blocklisted);
    case MediaStatus.DELETED:
      return intl.formatMessage(globalMessages.deleted);
    default:
      return '';
  }
};

interface StatusBadgeProps {
  status?: MediaStatus;
  downloadItem?: DownloadingItem[];
  is4k?: boolean;
  inProgress?: boolean;
  plexUrl?: string;
  serviceUrl?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  title?: string | string[];
  statusLabelOverride?: string;
}

const StatusBadge = ({
  status,
  downloadItem = [],
  is4k = false,
  inProgress = false,
  plexUrl,
  serviceUrl,
  tmdbId,
  mediaType,
  title,
  statusLabelOverride,
}: StatusBadgeProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const settings = useSettings();

  let mediaLink: string | undefined;
  let mediaLinkDescription: string | undefined;

  const calculateDownloadProgress = (media: DownloadingItem) => {
    return Math.round(((media?.size - media?.sizeLeft) / media?.size) * 100);
  };

  if (
    mediaType &&
    plexUrl &&
    hasPermission(
      is4k
        ? [
            Permission.REQUEST_4K,
            mediaType === 'movie'
              ? Permission.REQUEST_4K_MOVIE
              : Permission.REQUEST_4K_TV,
          ]
        : [
            Permission.REQUEST,
            mediaType === 'movie'
              ? Permission.REQUEST_MOVIE
              : Permission.REQUEST_TV,
          ],
      {
        type: 'or',
      }
    ) &&
    (!is4k ||
      (mediaType === 'movie'
        ? settings.currentSettings.movie4kEnabled
        : settings.currentSettings.series4kEnabled))
  ) {
    mediaLink = plexUrl;
    mediaLinkDescription = intl.formatMessage(messages.playonplex, {
      mediaServerName:
        settings.currentSettings.mediaServerType === MediaServerType.EMBY
          ? 'Emby'
          : settings.currentSettings.mediaServerType === MediaServerType.PLEX
            ? 'Plex'
            : 'Jellyfin',
    });
  } else if (hasPermission(Permission.MANAGE_REQUESTS)) {
    if (mediaType && tmdbId) {
      mediaLink = `/${mediaType}/${tmdbId}?manage=1`;
      mediaLinkDescription = intl.formatMessage(messages.managemedia, {
        mediaType: intl.formatMessage(
          mediaType === 'movie' ? globalMessages.movie : globalMessages.tvshow
        ),
      });
    } else if (hasPermission(Permission.ADMIN) && serviceUrl) {
      mediaLink = serviceUrl;
      mediaLinkDescription = intl.formatMessage(messages.openinarr, {
        arr: mediaType === 'movie' ? 'Radarr' : 'Sonarr',
      });
    }
  }

  const tooltipContent =
    mediaType === 'tv' &&
    downloadItem.length > 1 &&
    downloadItem.every(
      (item) =>
        item.downloadId && item.downloadId === downloadItem[0].downloadId
    ) ? (
      <DownloadBlock
        downloadItem={downloadItem[0]}
        title={Array.isArray(title) ? title[0] : title}
        is4k={is4k}
      />
    ) : (
      <ul>
        {downloadItem.map((status, index) => (
          <li
            key={`dl-status-${status.externalId}-${index}`}
            className="border-b border-gray-700 last:border-b-0"
          >
            <DownloadBlock
              downloadItem={status}
              title={Array.isArray(title) ? title[index] : title}
              is4k={is4k}
            />
          </li>
        ))}
      </ul>
    );

  const badgeDownloadProgress = (
    <div
      className={`absolute left-0 top-0 z-10 flex h-full ${
        status === MediaStatus.DELETED
          ? 'bg-red-600/80'
          : status === MediaStatus.PROCESSING
            ? 'bg-indigo-500/80'
            : 'bg-green-500/80'
      } transition-all duration-200 ease-in-out`}
      style={{
        width: `${
          downloadItem ? calculateDownloadProgress(downloadItem[0]) : 0
        }%`,
      }}
    />
  );

  const badgeLabel =
    statusLabelOverride ??
    intl.formatMessage(is4k ? messages.status4k : messages.status, {
      status: getStatusLabel(intl, status, inProgress),
    });

  if (status === MediaStatus.PENDING) {
    return (
      <Tooltip content={mediaLinkDescription}>
        <Badge badgeType="warning" href={mediaLink}>
          {badgeLabel}
        </Badge>
      </Tooltip>
    );
  }

  if (status === MediaStatus.BLOCKLISTED) {
    return (
      <Tooltip content={mediaLinkDescription}>
        <Badge badgeType="danger" href={mediaLink}>
          {intl.formatMessage(is4k ? messages.status4k : messages.status, {
            status:
              statusLabelOverride ??
              intl.formatMessage(globalMessages.blocklisted),
          })}
        </Badge>
      </Tooltip>
    );
  }

  const badgeTypeByStatus: Partial<
    Record<MediaStatus, 'success' | 'primary' | 'danger'>
  > = {
    [MediaStatus.AVAILABLE]: 'success',
    [MediaStatus.PARTIALLY_AVAILABLE]: 'success',
    [MediaStatus.PROCESSING]: 'primary',
    [MediaStatus.DELETED]: 'danger',
  };

  const badgeType =
    status !== undefined ? badgeTypeByStatus[status] : undefined;

  if (!badgeType) {
    return null;
  }

  return (
    <Tooltip
      content={inProgress ? tooltipContent : mediaLinkDescription}
      className={`${
        inProgress && 'hidden max-h-96 w-96 overflow-y-auto sm:block'
      }`}
      tooltipConfig={{
        ...(inProgress && { interactive: true, delayHide: 100 }),
      }}
    >
      <Badge
        badgeType={badgeType}
        href={mediaLink}
        className={`${
          inProgress && 'relative !bg-gray-700/80 !px-0 hover:!bg-gray-700'
        } overflow-hidden`}
      >
        {inProgress && badgeDownloadProgress}
        <div
          className={`relative z-20 flex items-center ${inProgress && 'px-2'}`}
        >
          <span>{badgeLabel}</span>
          {inProgress && (
            <>
              {mediaType === 'tv' &&
                downloadItem[0].episode &&
                (downloadItem.length > 1 &&
                downloadItem.every(
                  (item) =>
                    item.downloadId &&
                    item.downloadId === downloadItem[0].downloadId
                ) ? (
                  <span className="ml-1">
                    {intl.formatMessage(messages.seasonnumber, {
                      seasonNumber: downloadItem[0].episode.seasonNumber,
                    })}
                  </span>
                ) : (
                  <span className="ml-1">
                    {intl.formatMessage(messages.seasonepisodenumber, {
                      seasonNumber: downloadItem[0].episode.seasonNumber,
                      episodeNumber: downloadItem[0].episode.episodeNumber,
                    })}
                  </span>
                ))}
              <Spinner className="ml-1 h-3 w-3" />
            </>
          )}
        </div>
      </Badge>
    </Tooltip>
  );
};

export default StatusBadge;
