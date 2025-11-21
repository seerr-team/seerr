import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbKeyword,
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import OverrideRule from '@server/entity/OverrideRule';
import type { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

export type OverrideRulesResult = {
  rootFolder: string | null;
  profileId: number | null;
  tags: number[] | null;
};

async function overrideRules({
  mediaType,
  is4k,
  tmdbMedia,
  requestUser,
}: {
  mediaType: MediaType;
  is4k: boolean;
  tmdbMedia: TmdbMovieDetails | TmdbTvDetails;
  requestUser: User;
}): Promise<OverrideRulesResult> {
  const settings = getSettings();

  let rootFolder: string | null = null;
  let profileId: number | null = null;
  let tags: number[] | null = null;

  const defaultRadarrId = is4k
    ? settings.radarr.findIndex((r) => r.is4k && r.isDefault)
    : settings.radarr.findIndex((r) => !r.is4k && r.isDefault);
  const defaultSonarrId = is4k
    ? settings.sonarr.findIndex((s) => s.is4k && s.isDefault)
    : settings.sonarr.findIndex((s) => !s.is4k && s.isDefault);

  const overrideRuleRepository = getRepository(OverrideRule);
  const overrideRules = await overrideRuleRepository.find({
    where:
      mediaType === MediaType.MOVIE
        ? { radarrServiceId: defaultRadarrId }
        : { sonarrServiceId: defaultSonarrId },
  });

  const appliedOverrideRules = overrideRules.filter((rule) => {
    const hasAnimeKeyword =
      'results' in tmdbMedia.keywords &&
      tmdbMedia.keywords.results.some(
        (keyword: TmdbKeyword) => keyword.id === ANIME_KEYWORD_ID
      );

    // Skip override rules if the media is an anime TV show as anime TV
    // is handled by default and override rules do not explicitly include
    // the anime keyword
    if (
      mediaType === MediaType.TV &&
      hasAnimeKeyword &&
      (!rule.keywords ||
        !rule.keywords.split(',').map(Number).includes(ANIME_KEYWORD_ID))
    ) {
      return false;
    }

    if (
      rule.users &&
      !rule.users.split(',').some((userId) => Number(userId) === requestUser.id)
    ) {
      return false;
    }
    if (
      rule.genre &&
      !rule.genre
        .split(',')
        .some((genreId) =>
          tmdbMedia.genres.map((genre) => genre.id).includes(Number(genreId))
        )
    ) {
      return false;
    }
    if (
      rule.language &&
      !rule.language
        .split('|')
        .some((languageId) => languageId === tmdbMedia.original_language)
    ) {
      return false;
    }
    if (
      rule.keywords &&
      !rule.keywords.split(',').some((keywordId) => {
        let keywordList: TmdbKeyword[] = [];

        if ('keywords' in tmdbMedia.keywords) {
          keywordList = tmdbMedia.keywords.keywords;
        } else if ('results' in tmdbMedia.keywords) {
          keywordList = tmdbMedia.keywords.results;
        }

        return keywordList
          .map((keyword: TmdbKeyword) => keyword.id)
          .includes(Number(keywordId));
      })
    ) {
      return false;
    }
    return true;
  });

  // hacky way to prioritize rules
  // TODO: make this better
  const prioritizedRule = appliedOverrideRules.sort((a, b) => {
    const keys: (keyof OverrideRule)[] = ['genre', 'language', 'keywords'];

    const aSpecificity = keys.filter((key) => a[key] !== null).length;
    const bSpecificity = keys.filter((key) => b[key] !== null).length;

    // Take the rule with the most specific condition first
    return bSpecificity - aSpecificity;
  })[0];

  if (prioritizedRule) {
    if (prioritizedRule.rootFolder) {
      rootFolder = prioritizedRule.rootFolder;
    }
    if (prioritizedRule.profileId) {
      profileId = prioritizedRule.profileId;
    }
    if (prioritizedRule.tags) {
      tags = [
        ...new Set([
          ...(tags || []),
          ...prioritizedRule.tags.split(',').map((tag) => Number(tag)),
        ]),
      ];
    }

    logger.debug('Override rule applied.', {
      label: 'Media Request',
      overrides: prioritizedRule,
    });
  }

  return { rootFolder, profileId, tags };
}

export default overrideRules;
