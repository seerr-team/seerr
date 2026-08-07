export type ReleaseEligibilityStatus = 'released' | 'future' | 'unknown';

export interface ReleaseEligibility {
  status: ReleaseEligibilityStatus;
  releaseDate?: string;
}

interface MovieReleaseDate {
  release_date: string;
  type: number;
}

interface MovieReleaseRegion {
  release_dates: MovieReleaseDate[];
}

interface MovieReleaseResult {
  results: MovieReleaseRegion[];
}

export interface ReleaseRestrictionOptions {
  enabled: boolean;
  canBypass?: boolean;
}

export interface ReleaseRestrictionDecision {
  allowed: boolean;
  bypassed: boolean;
  blockedEligibility?: ReleaseEligibility;
}

const validTimestamp = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const isoDateMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/
  );

  if (!isoDateMatch) {
    return undefined;
  }

  const [, year, month, day] = isoDateMatch;
  const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );

  if (
    calendarDate.getUTCFullYear() !== Number(year) ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? undefined : timestamp;
};

export const getMovieReleaseEligibility = (
  releases?: MovieReleaseResult,
  now = new Date()
): ReleaseEligibility => {
  const digitalReleases = (releases?.results ?? [])
    .flatMap((region) => region.release_dates ?? [])
    .filter((release) => release.type === 4)
    .map((release) => ({
      releaseDate: release.release_date,
      timestamp: validTimestamp(release.release_date),
    }))
    .filter(
      (release): release is { releaseDate: string; timestamp: number } =>
        release.timestamp !== undefined
    );

  if (digitalReleases.some((release) => release.timestamp <= now.getTime())) {
    return { status: 'released' };
  }

  const nextRelease = digitalReleases.sort(
    (first, second) => first.timestamp - second.timestamp
  )[0];

  return nextRelease
    ? { status: 'future', releaseDate: nextRelease.releaseDate }
    : { status: 'unknown' };
};

export const getTvSeasonReleaseEligibility = (
  airDate?: string | null,
  now = new Date()
): ReleaseEligibility => {
  const timestamp = validTimestamp(airDate);

  if (timestamp === undefined) {
    return { status: 'unknown' };
  }

  return timestamp <= now.getTime()
    ? { status: 'released' }
    : { status: 'future', releaseDate: airDate ?? undefined };
};

export const evaluateReleaseRestriction = (
  eligibilities: ReleaseEligibility[],
  options: ReleaseRestrictionOptions
): ReleaseRestrictionDecision => {
  if (!options.enabled) {
    return { allowed: true, bypassed: false };
  }

  const blockedEligibilities = eligibilities.filter(
    (eligibility) => eligibility.status === 'future'
  );

  const blockedEligibility =
    blockedEligibilities
      .filter(
        (
          eligibility
        ): eligibility is ReleaseEligibility & {
          status: 'future';
          releaseDate: string;
        } => eligibility.status === 'future' && !!eligibility.releaseDate
      )
      .sort(
        (first, second) =>
          (validTimestamp(first.releaseDate) ?? Number.MAX_SAFE_INTEGER) -
          (validTimestamp(second.releaseDate) ?? Number.MAX_SAFE_INTEGER)
      )[0] ?? blockedEligibilities[0];

  if (!blockedEligibility) {
    return { allowed: true, bypassed: false };
  }

  if (options.canBypass) {
    return { allowed: true, bypassed: true, blockedEligibility };
  }

  return { allowed: false, bypassed: false, blockedEligibility };
};
