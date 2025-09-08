import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import { issueOptions } from '@app/components/IssueModal/constants';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { EyeIcon } from '@heroicons/react/24/solid';
import { IssueStatus } from '@server/constants/issue';
import { MediaType } from '@server/constants/media';
import type Issue from '@server/entity/Issue';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import Link from 'next/link';
import { useInView } from 'react-intersection-observer';
import { FormattedRelativeTime, useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.IssueList.IssueItem', {
  openeduserdate: '{date} by {user}',
  seasons: '{seasonCount, plural, one {Season} other {Seasons}}',
  episodes: '{episodeCount, plural, one {Episode} other {Episodes}}',
  problemepisode: 'Affected Episode',
  issuetype: 'Type',
  issuestatus: 'Status',
  opened: 'Opened',
  viewissue: 'View Issue',
  unknownissuetype: 'Unknown',
  descriptionpreview: 'Issue Description',
});

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

interface IssueItemProps {
  issue: Issue;
}

const IssueItem = ({ issue }: IssueItemProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { ref, inView } = useInView({
    triggerOnce: true,
  });
  const url =
    issue.media.mediaType === 'movie'
      ? `/api/v1/movie/${issue.media.tmdbId}`
      : `/api/v1/tv/${issue.media.tmdbId}`;
  const { data: title, error } = useSWR<MovieDetails | TvDetails>(
    inView ? url : null
  );

  if (!title && !error) {
    return (
      <div
        className="h-64 w-full animate-pulse rounded-xl bg-gray-800 xl:h-28"
        ref={ref}
      />
    );
  }

  if (!title) {
    return <div>uh oh</div>;
  }

  const issueOption = issueOptions.find(
    (opt) => opt.issueType === issue?.issueType
  );

  const problemSeasonEpisodeLine: React.ReactNode[] = [];

  if (!isMovie(title) && issue) {
    problemSeasonEpisodeLine.push(
      <>
        <span className="card-field-name">
          {intl.formatMessage(messages.seasons, {
            seasonCount: issue.problemSeason ? 1 : 0,
          })}
        </span>
        <span className="mr-4 uppercase">
          <Badge>
            {issue.problemSeason > 0
              ? issue.problemSeason
              : intl.formatMessage(globalMessages.all)}
          </Badge>
        </span>
      </>
    );

    if (issue.problemSeason > 0) {
      problemSeasonEpisodeLine.push(
        <>
          <span className="card-field-name">
            {intl.formatMessage(messages.episodes, {
              episodeCount: issue.problemEpisode ? 1 : 0,
            })}
          </span>
          <span className="uppercase">
            <Badge>
              {issue.problemEpisode > 0
                ? issue.problemEpisode
                : intl.formatMessage(globalMessages.all)}
            </Badge>
          </span>
        </>
      );
    }
  }

  const description = issue.comments?.[0]?.message || '';
  const maxDescriptionLength = 120;
  const shouldTruncate = description.length > maxDescriptionLength;
  const truncatedDescription = shouldTruncate
    ? description.substring(0, maxDescriptionLength) + '...'
    : description;

  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-4 text-gray-400 shadow-md ring-1 ring-gray-700 xl:flex-row">
      {title.backdropPath && (
        <div className="absolute inset-0 z-0 w-full bg-cover bg-center xl:w-2/3">
          <CachedImage
            type="tmdb"
            src={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${title.backdropPath}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgba(31, 41, 55, 0.47) 0%, rgba(31, 41, 55, 1) 100%)',
            }}
          />
        </div>
      )}
      <div className="relative flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="relative z-10 flex w-full items-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          <Link
            href={
              issue.media.mediaType === MediaType.MOVIE
                ? `/movie/${issue.media.tmdbId}`
                : `/tv/${issue.media.tmdbId}`
            }
            className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105"
          >
            <CachedImage
              type="tmdb"
              src={
                title.posterPath
                  ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${title.posterPath}`
                  : '/images/jellyseerr_poster_not_found.png'
              }
              alt=""
              sizes="100vw"
              style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
              width={600}
              height={900}
            />
          </Link>
          <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
            <div className="pt-0.5 text-xs text-white sm:pt-1">
              {(isMovie(title) ? title.releaseDate : title.firstAirDate)?.slice(
                0,
                4
              )}
            </div>
            <Link
              href={
                issue.media.mediaType === MediaType.MOVIE
                  ? `/movie/${issue.media.tmdbId}`
                  : `/tv/${issue.media.tmdbId}`
              }
              className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl"
            >
              {isMovie(title) ? title.title : title.name}
            </Link>
            {description && (
              <div className="mt-1 max-w-full">
                <div className="overflow-hidden text-sm text-gray-300">
                  {shouldTruncate ? (
                    <Tooltip
                      content={
                        <div className="max-w-sm p-3">
                          <div className="mb-1 text-sm font-medium text-gray-200">
                            Issue Description
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                            {description}
                          </div>
                        </div>
                      }
                      tooltipConfig={{
                        placement: 'top',
                        offset: [0, 8],
                      }}
                    >
                      <span className="block cursor-help truncate transition-colors hover:text-gray-200">
                        {truncatedDescription}
                      </span>
                    </Tooltip>
                  ) : (
                    <span className="block break-words">{description}</span>
                  )}
                </div>
              </div>
            )}
            {problemSeasonEpisodeLine.length > 0 && (
              <div className="card-field mt-1">
                {problemSeasonEpisodeLine.map((t, k) => (
                  <span key={k}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="z-10 mt-4 ml-4 flex w-full flex-col justify-center overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(messages.issuestatus)}
            </span>
            {issue.status === IssueStatus.OPEN ? (
              <Badge badgeType="warning" href={`/issues/${issue.id}`}>
                {intl.formatMessage(globalMessages.open)}
              </Badge>
            ) : (
              <Badge badgeType="success" href={`/issues/${issue.id}`}>
                {intl.formatMessage(globalMessages.resolved)}
              </Badge>
            )}
          </div>
          <div className="card-field">
            <span className="card-field-name">
              {intl.formatMessage(messages.issuetype)}
            </span>
            <span className="flex truncate text-sm text-gray-300">
              {intl.formatMessage(
                issueOption?.name ?? messages.unknownissuetype
              )}
            </span>
          </div>
          <div className="card-field">
            {hasPermission([Permission.MANAGE_ISSUES, Permission.VIEW_ISSUES], {
              type: 'or',
            }) ? (
              <>
                <span className="card-field-name">
                  {intl.formatMessage(messages.opened)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  {intl.formatMessage(messages.openeduserdate, {
                    date: (
                      <FormattedRelativeTime
                        value={Math.floor(
                          (new Date(issue.createdAt).getTime() - Date.now()) /
                            1000
                        )}
                        updateIntervalInSeconds={1}
                        numeric="auto"
                      />
                    ),
                    user: (
                      <Link
                        href={`/users/${issue.createdBy.id}`}
                        className="group flex items-center truncate"
                      >
                        <CachedImage
                          type="avatar"
                          src={issue.createdBy.avatar}
                          alt=""
                          className="avatar-sm ml-1.5 object-cover"
                          width={20}
                          height={20}
                        />
                        <span className="truncate text-sm font-semibold group-hover:text-white group-hover:underline">
                          {issue.createdBy.displayName}
                        </span>
                      </Link>
                    ),
                  })}
                </span>
              </>
            ) : (
              <>
                <span className="card-field-name">
                  {intl.formatMessage(messages.opened)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  <FormattedRelativeTime
                    value={Math.floor(
                      (new Date(issue.createdAt).getTime() - Date.now()) / 1000
                    )}
                    updateIntervalInSeconds={1}
                    numeric="auto"
                  />
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="z-10 mt-4 flex w-full flex-col justify-center pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
        <span className="w-full">
          <Link href={`/issues/${issue.id}`} passHref legacyBehavior>
            <Button as="a" className="w-full" buttonType="primary">
              <EyeIcon />
              <span>{intl.formatMessage(messages.viewissue)}</span>
            </Button>
          </Link>
        </span>
      </div>
    </div>
  );
};

export default IssueItem;
