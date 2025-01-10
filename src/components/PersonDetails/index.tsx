import Ellipsis from '@app/assets/ellipsis.svg';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ImageFader from '@app/components/Common/ImageFader';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { CircleStackIcon } from '@heroicons/react/24/solid';
import type { PersonCombinedCreditsResponse } from '@server/interfaces/api/personInterfaces';
import type { PersonDetails as PersonDetailsType } from '@server/models/Person';
import { groupBy } from 'lodash';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import TruncateMarkup from 'react-truncate-markup';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

interface Album {
  id: string;
  title: string;
  type: string;
  releasedate: string;
  images: {
    CoverType: string;
    Url: string;
  }[];
  mediaInfo?: {
    status?: number;
    downloadStatus?: unknown[];
    watchlists?: unknown[];
  };
}

interface DiscographyResponse {
  page: number;
  pageInfo: {
    total: number;
    totalPages: number;
  };
  results: Album[];
}

const messages = defineMessages('components.PersonDetails', {
  birthdate: 'Born {birthdate}',
  lifespan: '{birthdate} – {deathdate}',
  alsoknownas: 'Also Known As: {names}',
  appearsin: 'Appearances',
  crewmember: 'Crew',
  ascharacter: 'as {character}',
  albums: 'Albums',
  singles: 'Singles',
  eps: 'EPs',
  otherReleases: 'Other',
  loadmore: 'Load More',
});

type MediaType = 'all' | 'movie' | 'tv';

const PersonDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const [currentMediaType, setCurrentMediaType] = useState<string>('all');
  const { data, error } = useSWR<PersonDetailsType>(
    `/api/v1/person/${router.query.personId}`
  );
  const [showBio, setShowBio] = useState(false);

  const { data: combinedCredits, error: errorCombinedCredits } =
    useSWR<PersonCombinedCreditsResponse>(
      `/api/v1/person/${router.query.personId}/combined_credits`
    );

  const {
    data: albumData,
    size: albumSize,
    setSize: setAlbumSize,
    isValidating: isLoadingAlbums,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      data?.mbArtistId
        ? `/api/v1/person/${router.query.personId}/discography?page=${
            index + 1
          }&type=Album&artistId=${data.mbArtistId}`
        : null,
    { revalidateFirstPage: false }
  );

  const {
    data: singlesData,
    size: singlesSize,
    setSize: setSinglesSize,
    isValidating: isLoadingSingles,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      data?.mbArtistId
        ? `/api/v1/person/${router.query.personId}/discography?page=${
            index + 1
          }&type=Single&artistId=${data.mbArtistId}`
        : null,
    { revalidateFirstPage: false }
  );

  const {
    data: epsData,
    size: epsSize,
    setSize: setEpsSize,
    isValidating: isLoadingEps,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      data?.mbArtistId
        ? `/api/v1/person/${router.query.personId}/discography?page=${
            index + 1
          }&type=EP&artistId=${data.mbArtistId}`
        : null,
    { revalidateFirstPage: false }
  );

  const {
    data: otherData,
    size: otherSize,
    setSize: setOtherSize,
    isValidating: isLoadingOther,
  } = useSWRInfinite<DiscographyResponse>(
    (index) =>
      data?.mbArtistId
        ? `/api/v1/person/${router.query.personId}/discography?page=${
            index + 1
          }&type=Other&artistId=${data.mbArtistId}`
        : null,
    { revalidateFirstPage: false }
  );

  const sortedCast = useMemo(() => {
    const filtered = (combinedCredits?.cast ?? []).filter(
      (media) =>
        currentMediaType === 'all' || media.mediaType === currentMediaType
    );
    const grouped = groupBy(filtered, 'id');

    const reduced = Object.values(grouped).map((objs) => ({
      ...objs[0],
      character: objs.map((pos) => pos.character).join(', '),
    }));

    return reduced.sort((a, b) => {
      const aVotes = a.voteCount ?? 0;
      const bVotes = b.voteCount ?? 0;
      if (aVotes > bVotes) {
        return -1;
      }
      return 1;
    });
  }, [combinedCredits, currentMediaType]);

  const sortedCrew = useMemo(() => {
    const filtered = (combinedCredits?.crew ?? []).filter(
      (media) =>
        currentMediaType === 'all' || media.mediaType === currentMediaType
    );
    const grouped = groupBy(filtered, 'id');

    const reduced = Object.values(grouped).map((objs) => ({
      ...objs[0],
      job: objs.map((pos) => pos.job).join(', '),
    }));

    return reduced.sort((a, b) => {
      const aVotes = a.voteCount ?? 0;
      const bVotes = b.voteCount ?? 0;
      if (aVotes > bVotes) {
        return -1;
      }
      return 1;
    });
  }, [combinedCredits, currentMediaType]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  const personAttributes: string[] = [];

  if (data.birthday) {
    if (data.deathday) {
      personAttributes.push(
        intl.formatMessage(messages.lifespan, {
          birthdate: intl.formatDate(data.birthday, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          deathdate: intl.formatDate(data.deathday, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          }),
        })
      );
    } else {
      personAttributes.push(
        intl.formatMessage(messages.birthdate, {
          birthdate: intl.formatDate(data.birthday, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          }),
        })
      );
    }
  }

  if (data.placeOfBirth) {
    personAttributes.push(data.placeOfBirth);
  }

  const isLoading = !combinedCredits && !errorCombinedCredits;

  const mediaTypePicker = (
    <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
      <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
        <CircleStackIcon className="h-6 w-6" />
      </span>
      <select
        id="mediaType"
        name="mediaType"
        onChange={(e) => {
          setCurrentMediaType(e.target.value as MediaType);
        }}
        value={currentMediaType}
        className="rounded-r-only"
      >
        <option value="all">{intl.formatMessage(globalMessages.all)}</option>
        <option value="movie">
          {intl.formatMessage(globalMessages.movies)}
        </option>
        <option value="tv">{intl.formatMessage(globalMessages.tvshows)}</option>
      </select>
    </div>
  );

  const cast = (sortedCast ?? []).length > 0 && (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.appearsin)}</span>
        </div>
      </div>
      <ul className="cards-vertical">
        {sortedCast?.map((media, index) => {
          return (
            <li key={`list-cast-item-${media.id}-${index}`}>
              <TitleCard
                key={media.id}
                id={media.id}
                title={media.mediaType === 'movie' ? media.title : media.name}
                userScore={media.voteAverage}
                year={
                  media.mediaType === 'movie'
                    ? media.releaseDate
                    : media.firstAirDate
                }
                image={media.posterPath}
                summary={media.overview}
                mediaType={media.mediaType as 'movie' | 'tv'}
                status={media.mediaInfo?.status}
                canExpand
              />
              {media.character && (
                <div className="mt-2 w-full truncate text-center text-xs text-gray-300">
                  {intl.formatMessage(messages.ascharacter, {
                    character: media.character,
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  const crew = (sortedCrew ?? []).length > 0 && (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.crewmember)}</span>
        </div>
      </div>
      <ul className="cards-vertical">
        {sortedCrew?.map((media, index) => {
          return (
            <li key={`list-crew-item-${media.id}-${index}`}>
              <TitleCard
                key={media.id}
                id={media.id}
                title={media.mediaType === 'movie' ? media.title : media.name}
                userScore={media.voteAverage}
                year={
                  media.mediaType === 'movie'
                    ? media.releaseDate
                    : media.firstAirDate
                }
                image={media.posterPath}
                summary={media.overview}
                mediaType={media.mediaType as 'movie' | 'tv'}
                status={media.mediaInfo?.status}
                canExpand
              />
              {media.job && (
                <div className="mt-2 w-full truncate text-center text-xs text-gray-300">
                  {media.job}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  const albumsList = albumData ? albumData.flatMap((page) => page.results) : [];
  const isReachingEndAlbums =
    albumData?.[0]?.results.length === 0 ||
    (albumData && albumData[albumData.length - 1]?.results.length < 20);

  const singlesList = singlesData
    ? singlesData.flatMap((page) => page.results)
    : [];
  const isReachingEndSingles =
    singlesData?.[0]?.results.length === 0 ||
    (singlesData && singlesData[singlesData.length - 1]?.results.length < 20);

  const epsList = epsData ? epsData.flatMap((page) => page.results) : [];
  const isReachingEndEps =
    epsData?.[0]?.results.length === 0 ||
    (epsData && epsData[epsData.length - 1]?.results.length < 20);

  const otherList = otherData ? otherData.flatMap((page) => page.results) : [];
  const isReachingEndOther =
    otherData?.[0]?.results.length === 0 ||
    (otherData && otherData[otherData.length - 1]?.results.length < 20);

  const renderAlbumSection = (
    title: string,
    albums: Album[],
    isLoading: boolean,
    isReachingEnd: boolean,
    onLoadMore: () => void
  ) => {
    if (!albums?.length && !isLoading) return null;

    return (
      <>
        <div className="slider-header">
          <div className="slider-title">
            <span>{title}</span>
          </div>
        </div>
        <ul className="cards-vertical">
          {albums?.map((album) => (
            <li key={`album-${album.id}`}>
              <TitleCard
                id={album.id}
                isAddedToWatchlist={album.mediaInfo?.watchlists?.length ?? 0}
                title={album.title}
                image={album.images?.[0]?.Url}
                year={album.releasedate}
                type={album.type}
                mediaType="album"
                status={album.mediaInfo?.status}
                inProgress={(album.mediaInfo?.downloadStatus ?? []).length > 0}
                canExpand
              />
            </li>
          ))}
          {isLoading &&
            [...Array(20)].map((_, index) => (
              <li key={`placeholder-${index}`}>
                <TitleCard.Placeholder canExpand />
              </li>
            ))}
        </ul>
        {!isReachingEnd && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={onLoadMore}
              disabled={isLoading}
              className="flex h-9 w-32 items-center justify-center"
            >
              {isLoading ? (
                <div className="h-5 w-5">
                  <LoadingSpinner />
                </div>
              ) : (
                intl.formatMessage(messages.loadmore)
              )}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <PageTitle title={data.name} />
      {(sortedCrew || sortedCast) && (
        <div className="absolute top-0 left-0 right-0 z-0 h-96">
          <ImageFader
            isDarker
            backgroundImages={[...(sortedCast ?? []), ...(sortedCrew ?? [])]
              .filter((media) => media.backdropPath)
              .map(
                (media) =>
                  `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${media.backdropPath}`
              )
              .slice(0, 6)}
          />
        </div>
      )}
      <div
        className={`relative z-10 mt-4 mb-8 flex flex-col items-center lg:flex-row ${
          data.biography ? 'lg:items-start' : ''
        }`}
      >
        {data.profilePath && (
          <div className="relative mb-6 mr-0 h-36 w-36 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-gray-700 lg:mb-0 lg:mr-6 lg:h-44 lg:w-44">
            <CachedImage
              type="tmdb"
              src={`https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.profilePath}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
          </div>
        )}
        <div className="w-full text-center text-gray-300 lg:text-left">
          <div className="flex w-full items-center justify-center lg:justify-between">
            <h1 className="text-3xl text-white lg:text-4xl">{data.name}</h1>
            <div className="hidden flex-shrink-0 lg:block">
              {mediaTypePicker}
            </div>
          </div>
          <div className="mt-1 mb-2 space-y-1 text-xs text-white sm:text-sm lg:text-base">
            <div>{personAttributes.join(' | ')}</div>
            {(data.alsoKnownAs ?? []).length > 0 && (
              <div>
                {intl.formatMessage(messages.alsoknownas, {
                  names: (data.alsoKnownAs ?? []).reduce((prev, curr) =>
                    intl.formatMessage(globalMessages.delimitedlist, {
                      a: prev,
                      b: curr,
                    })
                  ),
                })}
              </div>
            )}
          </div>
          <div className="lg:hidden">{mediaTypePicker}</div>
          {data.biography && (
            <div className="relative text-left">
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
              <div
                className="group outline-none ring-0"
                onClick={() => setShowBio((show) => !show)}
                role="button"
                tabIndex={-1}
              >
                <TruncateMarkup
                  lines={showBio ? 200 : 6}
                  ellipsis={
                    <Ellipsis className="relative -top-0.5 ml-2 inline-block opacity-70 transition duration-300 group-hover:opacity-100" />
                  }
                >
                  <p className="pt-2 text-sm lg:text-base">{data.biography}</p>
                </TruncateMarkup>
              </div>
            </div>
          )}
        </div>
      </div>
      {data.mbArtistId && (
        <>
          {renderAlbumSection(
            intl.formatMessage(messages.albums),
            albumsList,
            isLoadingAlbums ?? false,
            isReachingEndAlbums ?? false,
            () => setAlbumSize(albumSize + 1)
          )}
          {renderAlbumSection(
            intl.formatMessage(messages.singles),
            singlesList,
            isLoadingSingles ?? false,
            isReachingEndSingles ?? false,
            () => setSinglesSize(singlesSize + 1)
          )}
          {renderAlbumSection(
            intl.formatMessage(messages.eps),
            epsList,
            isLoadingEps ?? false,
            isReachingEndEps ?? false,
            () => setEpsSize(epsSize + 1)
          )}
          {renderAlbumSection(
            intl.formatMessage(messages.otherReleases),
            otherList,
            isLoadingOther ?? false,
            isReachingEndOther ?? false,
            () => setOtherSize(otherSize + 1)
          )}
        </>
      )}
      {data.knownForDepartment === 'Acting' ? [cast, crew] : [crew, cast]}
      {isLoading && <LoadingSpinner />}
    </>
  );
};

export default PersonDetails;
