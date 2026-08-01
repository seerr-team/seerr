import AirDateBadge from '@app/components/AirDateBadge';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Tooltip from '@app/components/Common/Tooltip';
import defineMessages from '@app/utils/defineMessages';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { TraktEpisodeWatchStatusItem } from '@server/interfaces/api/traktInterfaces';
import type { SeasonWithEpisodes } from '@server/models/Tv';
import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.TvDetails.Season', {
  somethingwentwrong: 'Something went wrong while retrieving season data.',
  noepisodes: 'Episode list unavailable.',
  watchedBy: 'Watched by {count, plural, one {# user} other {# users}}',
});

type SeasonProps = {
  seasonNumber: number;
  tvId: number;
  traktEpisodes?: TraktEpisodeWatchStatusItem[];
};

const Season = ({ seasonNumber, tvId, traktEpisodes }: SeasonProps) => {
  const intl = useIntl();
  const { data, error } = useSWR<SeasonWithEpisodes>(
    `/api/v1/tv/${tvId}/season/${seasonNumber}`
  );

  const watchersByEpisode = useMemo(
    () =>
      new Map(
        (traktEpisodes ?? []).map((episode) => [
          episode.episodeNumber,
          episode.watchedBy,
        ])
      ),
    [traktEpisodes]
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <div>{intl.formatMessage(messages.somethingwentwrong)}</div>;
  }

  return (
    <div className="flex flex-col justify-center divide-y divide-gray-700">
      {data.episodes.length === 0 ? (
        <p>{intl.formatMessage(messages.noepisodes)}</p>
      ) : (
        data.episodes
          .slice()
          .reverse()
          .map((episode) => {
            const watchers = watchersByEpisode.get(episode.episodeNumber) ?? [];

            return (
              <div
                className="flex flex-col space-y-4 py-4 xl:flex-row xl:space-x-4 xl:space-y-4"
                key={`season-${seasonNumber}-episode-${episode.episodeNumber}`}
              >
                <div className="flex-1">
                  <div className="flex flex-col space-y-2 xl:flex-row xl:items-center xl:space-x-2 xl:space-y-0">
                    <h3 className="text-lg">
                      {episode.episodeNumber} - {episode.name}
                    </h3>
                    {watchers.length > 0 && (
                      <Tooltip
                        content={
                          <ul>
                            {watchers.map((watcher) => (
                              <li key={watcher.userId}>
                                {watcher.displayName}
                              </li>
                            ))}
                          </ul>
                        }
                      >
                        <span className="flex items-center gap-1 text-green-500">
                          <CheckCircleIcon
                            className="h-5 w-5"
                            aria-label={intl.formatMessage(messages.watchedBy, {
                              count: watchers.length,
                            })}
                          />
                          {watchers.length > 1 && (
                            <span className="text-sm">{watchers.length}</span>
                          )}
                        </span>
                      </Tooltip>
                    )}
                    {episode.airDate && (
                      <AirDateBadge airDate={episode.airDate} />
                    )}
                  </div>
                  {episode.overview && <p>{episode.overview}</p>}
                </div>
                {episode.stillPath && (
                  <div className="relative aspect-video xl:h-32">
                    <CachedImage
                      type="tmdb"
                      className="rounded-lg object-contain"
                      src={episode.stillPath}
                      alt=""
                      fill
                    />
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
};

export default Season;
