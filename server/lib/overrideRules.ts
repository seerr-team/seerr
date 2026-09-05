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
  tags = null,
  serviceId,
}: {
  mediaType: MediaType;
  is4k: boolean;
  tmdbMedia: TmdbMovieDetails | TmdbTvDetails;
  requestUser: User;
  tags?: number[] | null;
  serviceId?: number;
}): Promise<OverrideRulesResult> {
  const settings = getSettings();

  let rootFolder: string | null = null;
  let profileId: number | null = null;

  const serviceIdField =
    mediaType === MediaType.MOVIE ? 'radarrServiceId' : 'sonarrServiceId';
  if (serviceId === undefined) {
    const defaultRadarrId = is4k
      ? settings.radarr.find((r) => r.is4k && r.isDefault)?.id
      : settings.radarr.find((r) => !r.is4k && r.isDefault)?.id;
    const defaultSonarrId = is4k
      ? settings.sonarr.find((s) => s.is4k && s.isDefault)?.id
      : settings.sonarr.find((s) => !s.is4k && s.isDefault)?.id;
    serviceId =
      mediaType === MediaType.MOVIE ? defaultRadarrId : defaultSonarrId;
  }

  const overrideRuleRepository = getRepository(OverrideRule);
  const rules =
    serviceId === undefined
      ? []
      : await overrideRuleRepository.find({
          where: { [serviceIdField]: serviceId },
        });

  const appliedOverrideRules = rules.filter((rule) => {
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
  const hasSpecificOverrideValue = (
    rule: OverrideRule,
    key: keyof OverrideRule
  ) => {
    const value = rule[key];
    if (value == null) return false;
    return typeof value !== 'string' || value.trim() !== '';
  };
  const prioritizedRule = appliedOverrideRules.sort((a, b) => {
    const keys: (keyof OverrideRule)[] = ['genre', 'language', 'keywords'];
    const aSpecificity = keys.filter((key) =>
      hasSpecificOverrideValue(a, key)
    ).length;
    const bSpecificity = keys.filter((key) =>
      hasSpecificOverrideValue(b, key)
    ).length;
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
