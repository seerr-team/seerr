import { ANIME_KEYWORD_ID } from '@server/api/themoviedb/constants';
import type {
  TmdbMovieDetails,
  TmdbTvDetails,
} from '@server/api/themoviedb/interfaces';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import OverrideRule from '@server/entity/OverrideRule';
import type { User } from '@server/entity/User';
import type { RuleCoverage } from '@server/lib/serviceDefaults';
import {
  isAnimeMedia,
  mediaKeywords,
  resolveService,
  resolveServiceDefaults,
  servicesFor,
} from '@server/lib/serviceDefaults';

export type OverrideRulesResult = {
  rootFolder: string | null;
  profileId: number | null;
  tags: number[] | null;
  covered: RuleCoverage;
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
  serviceId?: number | null;
}): Promise<OverrideRulesResult> {
  let rootFolder: string | null = null;
  let profileId: number | null = null;

  const serviceIdField =
    mediaType === MediaType.MOVIE ? 'radarrServiceId' : 'sonarrServiceId';
  const { service } = resolveService(servicesFor(mediaType), is4k, serviceId);
  const isAnime = isAnimeMedia(tmdbMedia);

  const overrideRuleRepository = getRepository(OverrideRule);
  const rules = service
    ? await overrideRuleRepository.find({
        where: { [serviceIdField]: service.id },
      })
    : [];

  const appliedOverrideRules = rules.filter((rule) => {
    // Skip override rules if the media is an anime TV show as anime TV
    // is handled by default and override rules do not explicitly include
    // the anime keyword
    if (
      mediaType === MediaType.TV &&
      isAnime &&
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
      !rule.keywords.split(',').some((keywordId) =>
        mediaKeywords(tmdbMedia)
          .map((keyword) => keyword.id)
          .includes(Number(keywordId))
      )
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
      // Rule tags extend the server's defaults unless the request has its own
      const baseTags =
        tags ??
        (service
          ? resolveServiceDefaults(mediaType, service, isAnime).tags
          : []);
      tags = [
        ...new Set([
          ...baseTags,
          ...prioritizedRule.tags.split(',').map((tag) => Number(tag)),
        ]),
      ];
    }
  }

  return {
    rootFolder,
    profileId,
    tags,
    covered: {
      rootFolder: !!prioritizedRule?.rootFolder,
      profileId: !!prioritizedRule?.profileId,
      tags: !!prioritizedRule?.tags,
    },
  };
}

export default overrideRules;
