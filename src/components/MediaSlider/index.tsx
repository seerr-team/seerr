import ShowMoreCard from '@app/components/MediaSlider/ShowMoreCard';
import PersonCard from '@app/components/PersonCard';
import Slider from '@app/components/Slider';
import TitleCard from '@app/components/TitleCard';
import useFilterByLanguages from '@app/hooks/useFilterByLanguages';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import { FilterByLanguage } from '@app/types/filters';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import { Permission } from '@server/lib/permissions';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import Link from 'next/link';
import { useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';

interface MixedResult {
  page: number;
  totalResults: number;
  totalPages: number;
  results: (TvResult | MovieResult | PersonResult)[];
}

interface MediaSliderProps {
  title: string;
  url: string;
  linkUrl?: string;
  sliderKey: string;
  hideWhenEmpty?: boolean;
  extraParams?: string;
  onNewTitles?: (titleCount: number) => void;
}

const MediaSlider = ({
  title,
  url,
  linkUrl,
  extraParams,
  sliderKey,
  hideWhenEmpty = false,
  onNewTitles,
}: MediaSliderProps) => {
  const settings = useSettings();
  const { hasPermission } = useUser();

  let isSeries = url.includes('tv');
  let isMovies = url.includes('movie');

  const getFilterKey = (): FilterByLanguage | undefined => {
    if (sliderKey === 'recommendations') {
      return isMovies
        ? FilterByLanguage.MOVIE_RECOMMENDATIONS
        : FilterByLanguage.TV_RECOMMENDATIONS;
    }

    if (sliderKey === 'similar') {
      return isMovies
        ? FilterByLanguage.SIMILAR_MOVIES
        : FilterByLanguage.SIMILAR_SERIES;
    }

    if (sliderKey === 'trending') {
      isMovies = true;
      isSeries = true;
      return FilterByLanguage.TRENDING;
    }

    if (sliderKey === 'popular-movies') {
      isMovies = true;
      isSeries = false;
      return FilterByLanguage.POPULAR_MOVIES;
    }

    if (sliderKey === 'upcoming') {
      isMovies = true;
      isSeries = false;
      return FilterByLanguage.UPCOMING_MOVIES;
    }

    if (sliderKey === 'popular-tv') {
      isMovies = false;
      isSeries = true;
      return FilterByLanguage.TV_POPULAR;
    }

    if (sliderKey === 'upcoming-tv') {
      isMovies = false;
      isSeries = true;
      return FilterByLanguage.TV_UPCOMING;
    }

    if (sliderKey === 'custom') {
      isMovies = true;
      isSeries = true;
      return FilterByLanguage.CUSTOM_SLIDERS;
    }

    return undefined;
  };

  const filterKey = getFilterKey();

  const { data, error, setSize, size } = useSWRInfinite<MixedResult>(
    (pageIndex: number, previousPageData: MixedResult | null) => {
      if (previousPageData && pageIndex + 1 > previousPageData.totalPages) {
        return null;
      }

      let endpoint = `${url}?page=${pageIndex + 1}`;
      if (extraParams) {
        endpoint += `&${extraParams}`;
      }
      return endpoint;
    },
    {
      initialSize: 2,
      revalidateFirstPage: false,
    }
  );

  const allTitles = (data ?? []).reduce(
    (a, v) => [...a, ...v.results],
    [] as (MovieResult | TvResult | PersonResult)[]
  );

  const filteredByLanguage = useFilterByLanguages({
    titles: allTitles,
    movie: isMovies,
    tv: isSeries,
    key: filterKey,
  });

  let filteredTitles = filteredByLanguage;

  if (settings.currentSettings.hideAvailable) {
    filteredTitles = filteredTitles.filter(
      (i) =>
        !(i.mediaType === 'movie' || i.mediaType === 'tv') ||
        (i.mediaInfo?.status !== MediaStatus.AVAILABLE &&
          i.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE)
    );
  }

  if (settings.currentSettings.hideBlocklisted) {
    filteredTitles = filteredTitles.filter(
      (i) =>
        !(i.mediaType === 'movie' || i.mediaType === 'tv') ||
        i.mediaInfo?.status !== MediaStatus.BLOCKLISTED
    );
  }

  useEffect(() => {
    if (
      filteredTitles.length < 24 &&
      size < 5 &&
      (data?.[0]?.totalResults ?? 0) > size * 20
    ) {
      setSize(size + 1);
    }

    if (onNewTitles) {
      onNewTitles(filteredTitles.length);
    }
  }, [filteredTitles, setSize, size, data, onNewTitles]);

  if (hideWhenEmpty && filteredTitles.length === 0) {
    return null;
  }

  const blocklistVisibility = hasPermission(
    [Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST],
    { type: 'or' }
  );

  const finalTitles = filteredTitles
    .slice(0, 20)
    .filter((title) => {
      if (!blocklistVisibility)
        return (
          (title as TvResult | MovieResult).mediaInfo?.status !==
          MediaStatus.BLOCKLISTED
        );
      return title;
    })
    .map((title) => {
      switch (title.mediaType) {
        case 'movie':
          return (
            <TitleCard
              key={title.id}
              id={title.id}
              isAddedToWatchlist={title.mediaInfo?.watchlists?.length ?? 0}
              image={title.posterPath}
              status={title.mediaInfo?.status}
              summary={title.overview}
              title={title.title}
              userScore={title.voteAverage}
              year={title.releaseDate}
              mediaType={title.mediaType}
              inProgress={(title.mediaInfo?.downloadStatus ?? []).length > 0}
            />
          );
        case 'tv':
          return (
            <TitleCard
              key={title.id}
              id={title.id}
              isAddedToWatchlist={title.mediaInfo?.watchlists?.length ?? 0}
              image={title.posterPath}
              status={title.mediaInfo?.status}
              summary={title.overview}
              title={title.name}
              userScore={title.voteAverage}
              year={title.firstAirDate}
              mediaType={title.mediaType}
              inProgress={(title.mediaInfo?.downloadStatus ?? []).length > 0}
            />
          );
        case 'person':
          return (
            <PersonCard
              key={`person-${title.id}`}
              personId={title.id}
              name={title.name}
              profilePath={title.profilePath}
            />
          );
      }
    });

  if (linkUrl && filteredTitles.length > 20) {
    finalTitles.push(
      <ShowMoreCard
        url={linkUrl}
        posters={filteredTitles
          .slice(20, 24)
          .map((title) =>
            title.mediaType !== 'person' ? title.posterPath : undefined
          )}
      />
    );
  }

  return (
    <>
      <div className="slider-header">
        {linkUrl ? (
          <Link href={linkUrl} className="slider-title min-w-0 pr-16">
            <span className="truncate">{title}</span>
            <ArrowRightCircleIcon />
          </Link>
        ) : (
          <div className="slider-title">
            <span>{title}</span>
          </div>
        )}
      </div>
      <Slider
        sliderKey={sliderKey}
        isLoading={!data && !error}
        isEmpty={false}
        items={finalTitles}
      />
    </>
  );
};

export default MediaSlider;
