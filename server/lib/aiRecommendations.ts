import { getRepository } from '../datasource';
import { MediaRequest } from '../entity/MediaRequest';
import { Watchlist } from '../entity/Watchlist';
import Media from '../entity/Media';
import { AiRecommendation } from '../entity/AiRecommendation';
import { UserFeedback } from '../entity/UserFeedback';
import { User } from '../entity/User';
import { MediaType } from '../constants/media';
import { createLLMClient, WatchHistoryItem, RecommendationFilters } from '../api/ai';
import TheMovieDb from '../api/themoviedb';
import { getSettings } from './settings';
import logger from '../logger';

interface GenerateOptions {
  limit?: number;
  filters?: RecommendationFilters;
  includeTmdb?: boolean;
}

export async function generateTasteProfile(
  userId: number,
  options?: { maxHistoryItems?: number }
): Promise<{ profile: string; keywords: string[] }> {
  try {
    // 1. Fetch user signals
    const [requests, watchlist, availableMedia] = await Promise.all([
      getRepository(MediaRequest)
        .createQueryBuilder('request')
        .where('request.requestedById = :userId', { userId })
        .andWhere('request.status IN (:...statuses)', {
          statuses: [1, 2, 5], // PENDING, APPROVED, COMPLETED
        })
        .orderBy('request.createdAt', 'DESC')
        .limit(50)
        .leftJoin('request.media', 'media')
        .addSelect(['media.tmdbId', 'media.mediaType'])
        .getMany(),
      getRepository(Watchlist)
        .createQueryBuilder('watchlist')
        .where('watchlist.requestedBy = :userId', { userId })
        .orderBy('watchlist.createdAt', 'DESC')
        .limit(50)
        .getMany(),
      getRepository(Media)
        .createQueryBuilder('media')
        .where('media.status = :status', { status: 5 }) // AVAILABLE
        .andWhere('media.mediaAddedAt IS NOT NULL')
        .orderBy('media.mediaAddedAt', 'DESC')
        .limit(50)
        .getMany(),
    ]);

    // 2. Score and sample items (similar to Recomendarr approach)
    const scoredItems = scoreMediaItems([
      ...requests.map((r) => ({
        tmdbId: r.media?.tmdbId || 0,
        mediaType: r.type,
        title: '',
        score: calculateRequestScore(r),
      })),
      ...watchlist.map((w) => ({
        tmdbId: w.tmdbId,
        mediaType: w.mediaType,
        title: w.title,
        score: 8, // Base score for watchlist items
      })),
      ...availableMedia.map((m) => ({
        tmdbId: m.tmdbId,
        mediaType: m.mediaType,
        title: '',
        score: calculateMediaScore(m),
      })),
    ]);

    const topItems = scoredItems.slice(0, options?.maxHistoryItems || 40);

    // 3. Fetch TMDb metadata for each item
    const settings = getSettings();
    const tmdb = new TheMovieDb();

    const enrichedItems: WatchHistoryItem[] = [];
    for (const item of topItems) {
      try {
        const metadata: any =
          item.mediaType === 'tv'
            ? await tmdb.getTvShow({ tvId: item.tmdbId })
            : await tmdb.getMovie({ movieId: item.tmdbId });
        enrichedItems.push({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType as 'movie' | 'tv',
          title: metadata.title || metadata.name || '',
          year: metadata.release_date
            ? new Date(metadata.release_date).getFullYear()
            : metadata.first_air_date
            ? new Date(metadata.first_air_date).getFullYear()
            : undefined,
          genres: metadata.genres?.map((g: any) => g.name) || [],
          overview: metadata.overview || undefined,
          posterPath: metadata.poster_path || undefined,
          backdropPath: metadata.backdrop_path || undefined,
          rating: metadata.vote_average,
          playCount: item.score > 10 ? Math.floor(item.score / 10) : 1,
        });
      } catch (error) {
        logger.warn(`Failed to fetch TMDb metadata for tmdbId ${item.tmdbId}:`, error);
      }
    }

    // 4. Call LLM with taste profile prompt
    const llm = createLLMClient(userId);
    const tasteProfile = await llm.generateTasteProfile(enrichedItems);

    return {
      profile: tasteProfile.profile,
      keywords: tasteProfile.keywords,
    };
  } catch (error) {
    logger.error(`Failed to generate taste profile for user ${userId}:`, error);
    throw error;
  }
}

export async function generateRecommendations(
  userId: number,
  options?: GenerateOptions
): Promise<AiRecommendation[]> {
  const logTag = { label: 'AI' };
  try {
    const settings = getSettings();

    if (!settings.ai.enabled || !settings.ai.recommendations.enabled) {
      throw new Error('AI recommendations are disabled');
    }

    // 1. Generate taste profile
    logger.info(`[user ${userId}] Step 1/8: generating taste profile...`, logTag);
    const { profile, keywords } = await generateTasteProfile(userId);
    logger.info(
      `[user ${userId}] Step 1/8 done. keywords: ${JSON.stringify(keywords)}`,
      logTag
    );

    // 2. Fetch user feedback for personalization
    const feedback = await getUserFeedback(userId);

    // 2. Get user signals for history
    const history = await getUserSignals(userId);
    logger.info(
      `[user ${userId}] Step 2/8 done. ${history.length} history items, ${feedback.length} feedback`,
      logTag
    );

    // 2b. Resolve titles the user has "liked" so they can positively bias the
    // recommendation prompt (the LLM leans toward similar content).
    const likedTitles = await getLikedTitles(feedback);
    if (likedTitles.length > 0) {
      logger.info(
        `[user ${userId}] biasing with ${likedTitles.length} liked titles`,
        logTag
      );
    }

    // 3. Build filters from settings and options
    const filters: RecommendationFilters = {
      ...options?.filters,
      mediaType: 'both',
      minRating: settings.ai.recommendations.minScore,
    };

    // 4. Call LLM for recommendations
    logger.info(`[user ${userId}] Step 3/8: calling LLM for recommendations...`, logTag);
    const llm = createLLMClient(userId);
    const aiRecs = await llm.generateRecommendations(
      { profile: profile, keywords } as any,
      history,
      filters,
      options?.limit || settings.ai.recommendations.maxResults,
      likedTitles
    );
    logger.info(`[user ${userId}] Step 3/8 done. ${aiRecs.length} AI recs`, logTag);

    // 5. Resolve AI recs to real TMDb entries (LLM titles -> tmdbId via search).
    // Small models hallucinate tmdbId values, so we look them up by title/year.
    logger.info(
      `[user ${userId}] Step 4/8: resolving ${aiRecs.length} titles via TMDb...`,
      logTag
    );
    const resolvedAiRecs = await resolveRecommendationsViaTmdb(aiRecs);
    logger.info(
      `[user ${userId}] Step 4/8 done. ${resolvedAiRecs.length} resolved`,
      logTag
    );

    // 6. If enabled, augment with TMDb recommendations using AI keywords
    let tmdbRecs: any[] = [];
    if (options?.includeTmdb && keywords && keywords.length > 0) {
      logger.info(`[user ${userId}] Step 5/8: TMDb keyword discovery...`, logTag);
      tmdbRecs = await discoverByKeywords(keywords, filters);
      logger.info(`[user ${userId}] Step 5/8 done. ${tmdbRecs.length} TMDb recs`, logTag);
    }

    // 7. Merge, deduplicate, and score
    const merged = mergeAndScoreRecommendations(resolvedAiRecs, tmdbRecs, profile, keywords);

    // 8. Filter out already watched/requested/disliked
    logger.info(
      `[user ${userId}] Step 6/8: filtering ${merged.length} merged recs...`,
      logTag
    );
    const filtered = await filterExistingContent(merged, userId);
    logger.info(
      `[user ${userId}] Step 6/8 done. ${filtered.length} recs after filtering`,
      logTag
    );

    // 9. Store in database
    logger.info(`[user ${userId}] Step 7/8: storing to database...`, logTag);
    await storeRecommendations(filtered, userId);
    logger.info(
      `[user ${userId}] Step 8/8: DONE. stored ${filtered.length} recommendations`,
      logTag
    );

    return filtered;
  } catch (error) {
    logger.error(`Failed to generate recommendations for user ${userId}:`, error);
    throw error;
  }
}

export async function aiSearch(
  userId: number,
  query: string,
  options?: { limit?: number; includeHistory?: boolean }
): Promise<{ results: any[]; interpretation: any }> {
  try {
    const settings = getSettings();

    if (!settings.ai.enabled || !settings.ai.search.enabled) {
      throw new Error('AI search is disabled');
    }

    const llm = createLLMClient(userId);
    const userHistory = options?.includeHistory ? await getUserSignals(userId) : undefined;

    // 1. Interpret query
    const interpretation = await llm.interpretSearchQuery(query, userHistory);

    // 2. Parallel search
    const [tmdbResults, suggestedTitles] = await Promise.all([
      discoverFromTmdb(interpretation.discoverParams),
      searchTmdbTitles(interpretation.suggestedTitles),
    ]);

    // 3. Merge and personalize
    const results = mergeSearchResults(tmdbResults, suggestedTitles);

    // 4. Filter out watched/disliked
    const filtered = await filterExistingContent(results, userId);

    return {
      results: filtered.slice(0, options?.limit || 20),
      interpretation,
    };
  } catch (error) {
    logger.error(`AI search failed for user ${userId}:`, error);
    throw error;
  }
}

// Helper functions

function calculateRequestScore(request: MediaRequest): number {
  let score = 5; // Base score

  // Boost based on status
  if (request.status === 5) score += 5; // COMPLETED
  else if (request.status === 2) score += 3; // APPROVED
  else if (request.status === 1) score += 1; // PENDING

  // Time decay (older requests get slightly lower score)
  const daysSinceRequest = (Date.now() - request.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  score -= Math.min(daysSinceRequest / 365, 2); // Max penalty of 2

  return score;
}

function calculateMediaScore(media: Media): number {
  let score = 6; // Base score for available media

  // Boost for recently added
  if (media.mediaAddedAt) {
    const daysSinceAdded = (Date.now() - media.mediaAddedAt.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 3 - daysSinceAdded / 30); // Decay over 90 days
  }

  return score;
}

function scoreMediaItems(items: Array<{ tmdbId: number; mediaType: string; title: string; score: number }>) {
  return items
    .map((item) => ({
      ...item,
      finalScore: item.score + Math.random() * 2, // Add small random factor
    }))
    .sort((a, b) => b.finalScore - a.finalScore);
}

async function getUserSignals(userId: number): Promise<WatchHistoryItem[]> {
  const [requests, watchlist, media] = await Promise.all([
    getRepository(MediaRequest)
      .createQueryBuilder('request')
      .where('request.requestedById = :userId', { userId })
      .leftJoin('request.media', 'm')
      .addSelect(['m.tmdbId', 'm.mediaType'])
      .limit(30)
      .getMany(),
    getRepository(Watchlist)
      .createQueryBuilder('watchlist')
      .where('watchlist.requestedBy = :userId', { userId })
      .limit(20)
      .getMany(),
    getRepository(Media)
      .createQueryBuilder('media')
      .where('media.status = :status', { status: 5 })
      .limit(30)
      .getMany(),
  ]);

  const signals: WatchHistoryItem[] = [];

  for (const request of requests) {
    if (request.media) {
      signals.push({
        tmdbId: request.media.tmdbId,
        mediaType: request.type,
        title: '',
        playCount: 1,
      });
    }
  }

  for (const item of watchlist) {
    signals.push({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      playCount: 1,
    });
  }

  for (const m of media) {
    signals.push({
      tmdbId: m.tmdbId,
      mediaType: m.mediaType,
      title: '',
      playCount: 1,
    });
  }

  return signals;
}

async function getUserFeedback(userId: number) {
  return getRepository(UserFeedback)
    .createQueryBuilder('feedback')
    .where('feedback.userId = :userId', { userId })
    .getMany();
}

/**
 * Resolve the titles the user has "liked" so the recommendation prompt can
 * lean toward similar content. Likes are stored as (tmdbId, mediaType) only,
 * so we look the names up via TMDb (capped to keep latency bounded).
 */
async function getLikedTitles(
  feedback: UserFeedback[]
): Promise<{ title: string; mediaType: 'movie' | 'tv' }[]> {
  const likes = feedback
    .filter((f) => f.feedbackType === 'like')
    .slice(0, 10);

  if (likes.length === 0) return [];

  const tmdb = new TheMovieDb();
  const result: { title: string; mediaType: 'movie' | 'tv' }[] = [];

  for (const like of likes) {
    try {
      const m: any =
        like.mediaType === MediaType.TV
          ? await tmdb.getTvShow({ tvId: like.tmdbId })
          : await tmdb.getMovie({ movieId: like.tmdbId });
      const title = m.title || m.name;
      if (title) {
        result.push({
          title,
          mediaType: like.mediaType === MediaType.TV ? 'tv' : 'movie',
        });
      }
    } catch {
      // Skip unresolved titles rather than failing the whole generation.
    }
  }

  return result;
}

async function discoverByKeywords(keywords: string[], filters: RecommendationFilters) {
  const tmdb = new TheMovieDb();
  const results: any[] = [];

  for (const keyword of keywords.slice(0, 3)) {
    // Limit to 3 keywords
    try {
      const keywordResults = await tmdb.getDiscoverMovies({
        keywords: keyword,
        voteAverageGte: String(filters.minRating || 7),
        voteCountGte: '100',
      });
      results.push(...keywordResults.results.slice(0, 5));
    } catch (error) {
      logger.warn(`Failed to discover by keyword "${keyword}":`, error);
    }
  }

  return results;
}

// TMDb genre IDs differ between the movie and TV discover endpoints (e.g.
// "Science Fiction" is 878 for movies but maps to "Sci-Fi & Fantasy" 10765
// for TV). Map the human-readable genre names the LLM emits to the IDs each
// endpoint expects. Genres with no equivalent on one side are omitted there.
const GENRE_IDS: Record<string, { movie?: number; tv?: number }> = {
  action: { movie: 28, tv: 10759 },
  adventure: { movie: 12, tv: 10759 },
  animation: { movie: 16, tv: 16 },
  anime: { movie: 16, tv: 16 },
  comedy: { movie: 35, tv: 35 },
  crime: { movie: 80, tv: 80 },
  documentary: { movie: 99, tv: 99 },
  drama: { movie: 18, tv: 18 },
  family: { movie: 10751, tv: 10751 },
  fantasy: { movie: 14, tv: 10765 },
  history: { movie: 36 },
  horror: { movie: 27 },
  music: { movie: 10402 },
  musical: { movie: 10402 },
  mystery: { movie: 9648, tv: 9648 },
  reality: { tv: 10764 },
  romance: { movie: 10749 },
  'science fiction': { movie: 878, tv: 10765 },
  'sci-fi': { movie: 878, tv: 10765 },
  'sci-fi & fantasy': { movie: 878, tv: 10765 },
  thriller: { movie: 53 },
  'tv movie': { movie: 10770 },
  war: { movie: 10752, tv: 10768 },
  'war & politics': { tv: 10768 },
  western: { movie: 37, tv: 37 },
};

/** Resolve genre names to TMDb IDs for a given discover endpoint type. */
function genreIdsFor(
  names: string[] | undefined,
  type: 'movie' | 'tv'
): number[] {
  if (!names) return [];
  const ids = new Set<number>();
  for (const name of names) {
    const id = GENRE_IDS[name.toLowerCase().trim()]?.[type];
    if (id) ids.add(id);
  }
  return [...ids];
}

async function discoverFromTmdb(params: any) {
  const tmdb = new TheMovieDb();
  const results: any[] = [];

  try {
    if (params.genres || params.year_from || params.min_rating) {
      // Movie and TV discover take different genre IDs (see GENRE_IDS) and
      // different date parameter names, so build params per type.
      const buildParams = (type: 'movie' | 'tv') => {
        const p: any = {};
        const genreIds = genreIdsFor(params.genres, type);
        if (genreIds.length) p.genre = genreIds.join('|');
        if (params.year_from) {
          const d = `${params.year_from}-01-01`;
          if (type === 'movie') p.primaryReleaseDateGte = d;
          else p.firstAirDateGte = d;
        }
        if (params.year_to) {
          const d = `${params.year_to}-12-31`;
          if (type === 'movie') p.primaryReleaseDateLte = d;
          else p.firstAirDateLte = d;
        }
        if (params.min_rating) p.voteAverageGte = params.min_rating;
        if (params.original_language) p.originalLanguage = params.original_language;
        if (params.sort_by) p.sortBy = params.sort_by;
        return p;
      };

      const [movieResults, tvResults] = await Promise.all([
        tmdb.getDiscoverMovies(buildParams('movie')),
        tmdb.getDiscoverTv(buildParams('tv')),
      ]);

      results.push(
        ...movieResults.results.map((r: any) => ({ ...r, media_type: 'movie' })),
        ...tvResults.results.map((r: any) => ({ ...r, media_type: 'tv' }))
      );
    }
  } catch (error) {
    logger.warn('Failed to discover from TMDb:', error);
  }

  return results;
}

async function searchTmdbTitles(
  titles: Array<{ title: string; year?: number; type: string; rationale?: string }>
) {
  const tmdb = new TheMovieDb();
  const results: any[] = [];

  for (const titleInfo of titles) {
    try {
      const searchResults = await tmdb.searchMulti({ query: titleInfo.title });
      const matched = searchResults.results.find(
        (r: any) =>
          r.title?.toLowerCase() === titleInfo.title.toLowerCase() ||
          r.name?.toLowerCase() === titleInfo.title.toLowerCase()
      );

      if (matched) {
        results.push({
          ...matched,
          media_type: matched.media_type,
          rationale: titleInfo.rationale,
        });
      }
    } catch (error) {
      logger.warn(`Failed to search for title "${titleInfo.title}":`, error);
    }
  }

  return results;
}

/**
 * Resolve AI-generated recommendations to real TMDb entries by searching the
 * title (and matching the year when available). Small LLMs cannot reliably
 * produce correct tmdbId values, so we trust the title/year instead and look
 * the ID up — the same approach SuggestArr and Recomendarr use.
 *
 * Returns only recommendations that resolved to a real TMDb entry.
 */
async function resolveRecommendationsViaTmdb(
  recs: Array<{
    title: string;
    year?: number;
    type?: string;
    rationale?: string;
    tmdbId?: number;
  }>
): Promise<any[]> {
  const tmdb = new TheMovieDb();
  const resolved: any[] = [];

  for (const rec of recs) {
    // If the LLM already gave a plausible tmdbId, keep it.
    if (rec.tmdbId && rec.tmdbId > 0) {
      resolved.push(rec);
      continue;
    }

    try {
      const searchResults = await tmdb.searchMulti({ query: rec.title });
      if (!searchResults.results || searchResults.results.length === 0) {
        continue;
      }

      // Prefer results whose media_type matches and whose release year matches.
      const candidates: any[] = searchResults.results.filter(
        (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
      );
      if (candidates.length === 0) {
        continue;
      }

      const matched: any =
        candidates.find((r: any) => {
          const dateStr = r.release_date || r.first_air_date;
          if (!dateStr || !rec.year) return false;
          return new Date(dateStr).getFullYear() === rec.year;
        }) ||
        candidates.find((r: any) =>
          rec.type
            ? r.media_type ===
              (rec.type === 'tv' ? 'tv' : 'movie')
            : true
        ) ||
        candidates[0];

      const dateStr = matched.release_date || matched.first_air_date;
      resolved.push({
        tmdbId: matched.id,
        title: matched.title || matched.name || rec.title,
        year: dateStr ? new Date(dateStr).getFullYear() : rec.year,
        mediaType: matched.media_type === 'tv' ? 'tv' : 'movie',
        rationale: rec.rationale,
      });
    } catch (error) {
      logger.warn(
        `TMDb resolution failed for "${rec.title}": ${error.message}`
      );
    }
  }

  logger.info(
    `TMDb resolution: ${resolved.length}/${recs.length} recommendations resolved to real entries`
  );
  return resolved;
}

function mergeAndScoreRecommendations(aiRecs: any[], tmdbRecs: any[], profile: string, keywords: string[]) {
  const merged = new Map<number, any>();

  // Add AI recommendations with higher base score
  for (const rec of aiRecs) {
    if (!rec.tmdbId) continue; // skip unresolved entries
    merged.set(rec.tmdbId, {
      tmdbId: rec.tmdbId,
      title: rec.title,
      year: rec.year,
      mediaType: rec.mediaType || rec.type,
      rationale: rec.rationale,
      score: 0.8, // Higher score for AI recommendations
      source: 'ai',
      metadata: {
        source: 'ai',
        keywords,
        generatedAt: new Date().toISOString(),
      },
    });
  }

  // Add TMDb recommendations with lower base score
  for (const rec of tmdbRecs) {
    const id = rec.id || rec.tmdbId;
    if (!merged.has(id)) {
      merged.set(id, {
        tmdbId: id,
        title: rec.title || rec.name,
        year: rec.release_date
          ? new Date(rec.release_date).getFullYear()
          : rec.first_air_date
          ? new Date(rec.first_air_date).getFullYear()
          : undefined,
        mediaType: rec.media_type === 'tv' ? 'tv' : 'movie',
        rationale: `Popular in genres related to your interests`,
        score: 0.6,
        source: 'tmdb',
        metadata: {
          source: 'tmdb',
          keywords,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  }

  return Array.from(merged.values());
}

function mergeSearchResults(tmdbResults: any[], suggestedTitles: any[]) {
  const merged = new Map<number, any>();

  for (const result of tmdbResults) {
    const id = result.id;
    merged.set(id, {
      ...result,
      matchScore: 0.7,
    });
  }

  for (const title of suggestedTitles) {
    const id = title.id || title.tmdbId;
    if (!merged.has(id)) {
      merged.set(id, {
        ...title,
        matchScore: 0.9,
      });
    }
  }

  // Sort by relevance: LLM-suggested titles (0.9) above discover results (0.7).
  return Array.from(merged.values()).sort(
    (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)
  );
}

async function filterExistingContent(recommendations: any[], userId: number) {
  // Get existing media, requests, and feedback
  const [existingMedia, existingRequests, feedback] = await Promise.all([
    getRepository(Media)
      .createQueryBuilder('media')
      .where('media.status IN (:...statuses)', { statuses: [4, 5] }) // PARTIALLY_AVAILABLE, AVAILABLE
      .select(['media.tmdbId', 'media.mediaType'])
      .getMany(),
    getRepository(MediaRequest)
      .createQueryBuilder('request')
      .where('request.requestedById = :userId', { userId })
      .leftJoin('request.media', 'media')
      .addSelect(['media.tmdbId', 'media.mediaType'])
      .getMany(),
    getRepository(UserFeedback)
      .createQueryBuilder('feedback')
      .where('feedback.userId = :userId', { userId })
      .andWhere('feedback.feedbackType IN (:...types)', { types: ['dislike', 'seen'] })
      .getMany(),
  ]);

  const excludedTmdbIds = new Set<number>();
  const excludedWithTypes = new Set<string>();

  // Add existing media
  for (const media of existingMedia) {
    excludedWithTypes.add(`${media.tmdbId}-${media.mediaType}`);
  }

  // Add existing requests
  for (const request of existingRequests) {
    if (request.media) {
      excludedWithTypes.add(`${request.media.tmdbId}-${request.type}`);
    }
  }

  // Add disliked/seen content
  for (const fb of feedback) {
    excludedTmdbIds.add(fb.tmdbId);
    excludedWithTypes.add(`${fb.tmdbId}-${fb.mediaType}`);
  }

  // Filter recommendations
  return recommendations.filter((rec) => {
    const key = `${rec.tmdbId}-${rec.mediaType}`;
    return !excludedWithTypes.has(key) && !excludedTmdbIds.has(rec.tmdbId);
  });
}

/**
 * Store recommendations using upsert semantics:
 *  - If a (userId, tmdbId, mediaType) row already exists, refresh its score,
 *    rationale, metadata, and updatedAt (this extends its TTL — a title that
 *    keeps getting recommended stays alive).
 *  - Otherwise insert a new row.
 *
 * This replaces the previous "delete all then insert" behaviour so that
 * recommendations persist across runs and age out via TTL cleanup instead of
 * vanishing on every refresh.
 */
async function storeRecommendations(recommendations: any[], userId: number) {
  const repository = getRepository(AiRecommendation);
  const now = new Date();

  for (const rec of recommendations) {
    const mediaType =
      rec.mediaType === 'tv' ? MediaType.TV : MediaType.MOVIE;

    const existing = await repository.findOne({
      where: { userId, tmdbId: rec.tmdbId, mediaType },
    });

    if (existing) {
      // Refresh: keep the original createdAt, bump updatedAt to extend TTL.
      existing.score = rec.score || 0.7;
      existing.rationale = rec.rationale || existing.rationale;
      existing.metadata = rec.metadata ?? existing.metadata;
      existing.updatedAt = now;
      await repository.save(existing);
    } else {
      await repository.save(
        repository.create({
          userId,
          tmdbId: rec.tmdbId,
          mediaType,
          tvdbId: rec.tvdbId || null,
          score: rec.score || 0.7,
          rationale: rec.rationale || '',
          metadata: rec.metadata,
          createdAt: now,
          updatedAt: now,
        })
      );
    }
  }
}

/**
 * Delete recommendations older than the configured TTL. A recommendation's age
 * is measured from `updatedAt` (refreshed on every run that re-recommends it),
 * so titles that keep matching the user's taste survive indefinitely while
 * stale ones expire.
 */
export async function cleanupExpiredRecommendations(): Promise<number> {
  const settings = getSettings();
  const ttlDays = settings.ai.recommendations.ttlDays ?? 14;

  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
  const result = await getRepository(AiRecommendation)
    .createQueryBuilder()
    .delete()
    .where('updatedAt < :cutoff', { cutoff })
    .execute();

  return result.affected || 0;
}
