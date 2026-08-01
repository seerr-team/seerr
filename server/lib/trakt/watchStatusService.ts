import TraktAPI, { type TraktSeasonProgress } from '@server/api/trakt';
import { getRepository } from '@server/datasource';
import {
  TraktConnection,
  TraktConnectionStatus,
} from '@server/entity/TraktConnection';
import type { User } from '@server/entity/User';
import type {
  TraktSeasonWatchStatusItem,
  TraktSeasonWatchStatusResponse,
  TraktWatchStatusItem,
  TraktWatchStatusResponse,
  TraktWatcher,
} from '@server/interfaces/api/traktInterfaces';
import cacheManager from '@server/lib/cache';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { isTraktConfigured } from '@server/lib/trakt/config';
import { TraktConnectionService } from '@server/lib/trakt/connectionService';

const LOOKUP_TIMEOUT_MS = 10_000;
const MAPPING_HIT_TTL_SECONDS = 86_400;
const MAPPING_MISS_TTL_SECONDS = 3_600;
const WATCH_STATUS_TTL_SECONDS = 300;
const CONNECTION_CONCURRENCY = 4;

type MediaType = 'movie' | 'tv';

type CachedMapping = { kind: 'hit'; traktId: number } | { kind: 'miss' };

interface CachedWatchResult {
  watched: boolean;
  watchedAt: string | null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    }
  );
  await Promise.all(runners);
  return results;
}

export class TraktWatchStatusService {
  public constructor(
    private readonly lookupTimeoutMs: number = LOOKUP_TIMEOUT_MS
  ) {}

  public async getWatchStatus(input: {
    viewer: User;
    mediaType: MediaType;
    tmdbId: number;
  }): Promise<TraktWatchStatusResponse> {
    const connections = await this.getVisibleConnections(input.viewer);
    const response = {
      mediaType: input.mediaType,
      tmdbId: input.tmdbId,
    };

    if (connections.length === 0) {
      return { ...response, items: [] };
    }

    const mapping = await this.getMapping(input.mediaType, input.tmdbId);

    if (mapping === 'temporarily_unavailable') {
      return {
        ...response,
        items: connections.map((connection) =>
          this.toItem(connection, {
            watched: false,
            watchedAt: null,
            status: 'temporarily_unavailable',
          })
        ),
      };
    }

    if (mapping.kind === 'miss') {
      return {
        ...response,
        items: connections.map((connection) =>
          this.toItem(connection, {
            watched: false,
            watchedAt: null,
            status: 'ok',
          })
        ),
      };
    }

    const items = await mapWithConcurrency(
      connections,
      CONNECTION_CONCURRENCY,
      (connection) =>
        this.getConnectionStatus(
          connection,
          input.mediaType,
          input.tmdbId,
          mapping.traktId
        )
    );
    return { ...response, items };
  }

  public async getSeasonWatchStatus(input: {
    viewer: User;
    tmdbId: number;
  }): Promise<TraktSeasonWatchStatusResponse> {
    const connections = await this.getVisibleConnections(input.viewer);
    const response = {
      tmdbId: input.tmdbId,
      householdSize: connections.length,
    };

    if (connections.length === 0) {
      return { ...response, status: 'ok', seasons: [] };
    }

    const mapping = await this.getMapping('tv', input.tmdbId);

    if (mapping === 'temporarily_unavailable') {
      return { ...response, status: 'temporarily_unavailable', seasons: [] };
    }

    if (mapping.kind === 'miss') {
      return { ...response, status: 'ok', seasons: [] };
    }

    const progressByConnection = await mapWithConcurrency(
      connections,
      CONNECTION_CONCURRENCY,
      async (connection) => ({
        watcher: {
          userId: connection.userId,
          displayName: this.displayNameFor(connection),
        },
        // A single failing connection must not blank the whole household view.
        progress: await this.getConnectionProgress(connection, mapping.traktId),
      })
    );

    // With every lookup failed there is nothing to distinguish "nobody watched this" from
    // "we could not ask", so report it as unavailable rather than as an empty result.
    if (progressByConnection.every((entry) => entry.progress === null)) {
      return { ...response, status: 'temporarily_unavailable', seasons: [] };
    }

    return {
      ...response,
      status: 'ok',
      seasons: this.aggregateSeasons(progressByConnection),
    };
  }

  private async getConnectionProgress(
    connection: TraktConnection,
    traktShowId: number
  ): Promise<TraktSeasonProgress[] | null> {
    const cache = cacheManager.getCache('trakt-watch-status').data;
    const key = `connection:${connection.id}:version:${connection.tokenVersion}:progress:${traktShowId}`;
    const cached = cache.get<TraktSeasonProgress[]>(key);

    if (cached) {
      return cached;
    }

    try {
      const progress = await new TraktConnectionService().withAuthenticatedApi(
        connection.userId,
        (api) =>
          api.getShowProgress(
            traktShowId,
            AbortSignal.timeout(this.lookupTimeoutMs)
          )
      );
      cache.set(key, progress, WATCH_STATUS_TTL_SECONDS);

      return progress;
    } catch {
      return null;
    }
  }

  private aggregateSeasons(
    entries: {
      watcher: TraktWatcher;
      progress: TraktSeasonProgress[] | null;
    }[]
  ): TraktSeasonWatchStatusItem[] {
    // Members are cached independently, so one can still report the episode count from
    // before a new episode aired. Completion is judged against the household's highest
    // count, or a stale member would be credited with a season they have not finished.
    const airedBySeason = new Map<number, number>();
    for (const { progress } of entries) {
      for (const season of progress ?? []) {
        airedBySeason.set(
          season.seasonNumber,
          Math.max(
            airedBySeason.get(season.seasonNumber) ?? 0,
            season.airedEpisodes
          )
        );
      }
    }

    const seasons = new Map<number, TraktSeasonWatchStatusItem>();

    for (const { watcher, progress } of entries) {
      for (const season of progress ?? []) {
        const airedEpisodes =
          airedBySeason.get(season.seasonNumber) ?? season.airedEpisodes;
        let entry = seasons.get(season.seasonNumber);
        if (!entry) {
          entry = {
            seasonNumber: season.seasonNumber,
            airedEpisodes,
            watchedBy: [],
            episodes: [],
          };
          seasons.set(season.seasonNumber, entry);
        }

        if (airedEpisodes > 0 && season.watchedEpisodes >= airedEpisodes) {
          entry.watchedBy.push(watcher);
        }

        for (const episode of season.episodes) {
          if (!episode.watched) {
            continue;
          }
          let episodeEntry = entry.episodes.find(
            (candidate) => candidate.episodeNumber === episode.episodeNumber
          );
          if (!episodeEntry) {
            episodeEntry = {
              episodeNumber: episode.episodeNumber,
              watchedBy: [],
            };
            entry.episodes.push(episodeEntry);
          }
          episodeEntry.watchedBy.push(watcher);
        }
      }
    }

    return [...seasons.values()]
      .map((season) => ({
        ...season,
        episodes: season.episodes.sort(
          (a, b) => a.episodeNumber - b.episodeNumber
        ),
      }))
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  private getVisibleConnections(viewer: User): Promise<TraktConnection[]> {
    const query = getRepository(TraktConnection)
      .createQueryBuilder('connection')
      .innerJoinAndSelect('connection.user', 'user')
      .select([
        'connection.id',
        'connection.userId',
        'connection.username',
        'connection.tokenVersion',
        'user.id',
        'user.username',
        'user.plexUsername',
        'user.jellyfinUsername',
      ])
      .where('connection.status = :status', {
        status: TraktConnectionStatus.ACTIVE,
      })
      .orderBy('connection.userId', 'ASC');

    if (!viewer.hasPermission(Permission.ADMIN)) {
      query.andWhere('connection.userId = :viewerId', {
        viewerId: viewer.id,
      });
    }

    return query.getMany();
  }

  private async getMapping(
    mediaType: MediaType,
    tmdbId: number
  ): Promise<CachedMapping | 'temporarily_unavailable'> {
    const cache = cacheManager.getCache('trakt-media').data;
    const key = `${mediaType}:${tmdbId}`;
    const cached = cache.get<CachedMapping>(key);
    if (cached) {
      return cached;
    }

    try {
      const settings = getSettings().trakt;
      if (!isTraktConfigured(settings)) {
        throw new Error('Trakt application is not configured');
      }
      const traktId = await new TraktAPI(
        settings.clientId.trim(),
        settings.clientSecret
      ).findByTmdbId(
        mediaType,
        tmdbId,
        AbortSignal.timeout(this.lookupTimeoutMs)
      );
      const mapping: CachedMapping =
        traktId === null ? { kind: 'miss' } : { kind: 'hit', traktId };
      cache.set(
        key,
        mapping,
        mapping.kind === 'hit'
          ? MAPPING_HIT_TTL_SECONDS
          : MAPPING_MISS_TTL_SECONDS
      );
      return mapping;
    } catch {
      return 'temporarily_unavailable';
    }
  }

  private async getConnectionStatus(
    connection: TraktConnection,
    mediaType: MediaType,
    tmdbId: number,
    traktId: number
  ): Promise<TraktWatchStatusItem> {
    const cache = cacheManager.getCache('trakt-watch-status').data;
    const key = `connection:${connection.id}:version:${connection.tokenVersion}:${mediaType}:${tmdbId}`;
    const cached = cache.get<CachedWatchResult>(key);
    if (cached) {
      return this.toItem(connection, { ...cached, status: 'ok' });
    }

    try {
      const history = await new TraktConnectionService().withAuthenticatedApi(
        connection.userId,
        (api) =>
          api.getWatchHistory(
            mediaType,
            traktId,
            AbortSignal.timeout(this.lookupTimeoutMs)
          )
      );
      const result: CachedWatchResult = {
        watched: history !== null,
        watchedAt: history?.watchedAt ?? null,
      };
      await this.cacheForCurrentConnectionVersion(
        connection,
        mediaType,
        tmdbId,
        result
      );
      return this.toItem(connection, { ...result, status: 'ok' });
    } catch {
      return this.toItem(connection, {
        watched: false,
        watchedAt: null,
        status: 'temporarily_unavailable',
      });
    }
  }

  private async cacheForCurrentConnectionVersion(
    connection: TraktConnection,
    mediaType: MediaType,
    tmdbId: number,
    result: CachedWatchResult
  ): Promise<void> {
    const repository = getRepository(TraktConnection);
    const loadCurrent = () =>
      repository.findOne({
        select: {
          id: true,
          userId: true,
          status: true,
          tokenVersion: true,
        },
        where: {
          id: connection.id,
          userId: connection.userId,
          status: TraktConnectionStatus.ACTIVE,
        },
      });
    const current = await loadCurrent();
    if (!current) {
      return;
    }

    const cache = cacheManager.getCache('trakt-watch-status').data;
    const key = `connection:${current.id}:version:${current.tokenVersion}:${mediaType}:${tmdbId}`;
    cache.set(key, result, WATCH_STATUS_TTL_SECONDS);

    const confirmed = await loadCurrent();
    if (
      !confirmed ||
      confirmed.id !== current.id ||
      confirmed.status !== current.status ||
      confirmed.tokenVersion !== current.tokenVersion
    ) {
      cache.del(key);
    }
  }

  private displayNameFor(connection: TraktConnection): string {
    const user = connection.user;

    return (
      user.displayName ||
      user.username ||
      user.plexUsername ||
      user.jellyfinUsername ||
      'Seerr user'
    );
  }

  private toItem(
    connection: TraktConnection,
    status: Pick<TraktWatchStatusItem, 'watched' | 'watchedAt' | 'status'>
  ): TraktWatchStatusItem {
    return {
      userId: connection.userId,
      displayName: this.displayNameFor(connection),
      traktUsername: connection.username ?? null,
      ...status,
    };
  }
}
