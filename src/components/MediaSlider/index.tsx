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

  let isSeries = !sliderKey ? url.includes('tv') : true;
  let isMovies = !sliderKey ? url.includes('movie') : true;

  const { data, error, setSize, size } = useSWRInfinite<MixedResult>(
    (pageIndex: number, previousPageData: MixedResult | null) => {
      if (previousPageData && pageIndex + 1 > previousPageData.totalPages)
        return null;
      return `${url}?page=${pageIndex + 1}${
        extraParams ? `&${extraParams}` : ''
      }`;
    },
    { initialSize: 2, revalidateFirstPage: false }
  );

  // Combine all results
  let titles = (data ?? []).reduce(
    (acc, page) => [...acc, ...page.results],
    [] as (MovieResult | TvResult | PersonResult)[]
  );

  // Apply app-level settings filters
  if (settings.currentSettings.hideAvailable) {
    titles = titles.filter(
      (t) =>
        (t.mediaType === 'movie' || t.mediaType === 'tv') &&
        t.mediaInfo?.status !== MediaStatus.AVAILABLE &&
        t.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE
    );
  }

  if (settings.currentSettings.hideBlacklisted) {
    titles = titles.filter(
      (t) =>
        (t.mediaType === 'movie' || t.mediaType === 'tv') &&
        t.mediaInfo?.status !== MediaStatus.BLACKLISTED
    );
  }

  const getKey = () => {
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

  // Filter by original languages dynamically using our hook
  const filteredTitles = useFilterByLanguages({
    titles,
    movie: isMovies,
    tv: isSeries,
    key: getKey(),
  });

  // Blacklist visibility
  const blacklistVisible = hasPermission(
    [Permission.MANAGE_BLACKLIST, Permission.VIEW_BLACKLIST],
    { type: 'or' }
  );

  // Map filtered titles to JSX cards
  const finalTitles = filteredTitles
    .slice(0, 20)
    .filter((t) => {
      if (
        (t.mediaType === 'movie' || t.mediaType === 'tv') &&
        !blacklistVisible
      ) {
        return t.mediaInfo?.status !== MediaStatus.BLACKLISTED;
      }
      return true; // person results untouched
    })
    .map((t) => {
      switch (t.mediaType) {
        case 'movie':
          return (
            <TitleCard
              key={t.id}
              id={t.id}
              isAddedToWatchlist={t.mediaInfo?.watchlists?.length ?? 0}
              image={t.posterPath}
              status={t.mediaInfo?.status}
              summary={t.overview}
              title={t.title}
              userScore={t.voteAverage}
              year={t.releaseDate}
              mediaType={t.mediaType}
              inProgress={(t.mediaInfo?.downloadStatus ?? []).length > 0}
            />
          );
        case 'tv':
          return (
            <TitleCard
              key={t.id}
              id={t.id}
              isAddedToWatchlist={t.mediaInfo?.watchlists?.length ?? 0}
              image={t.posterPath}
              status={t.mediaInfo?.status}
              summary={t.overview}
              title={t.name}
              userScore={t.voteAverage}
              year={t.firstAirDate}
              mediaType={t.mediaType}
              inProgress={(t.mediaInfo?.downloadStatus ?? []).length > 0}
            />
          );
        case 'person':
          return (
            <PersonCard
              key={t.id}
              personId={t.id}
              name={t.name}
              profilePath={t.profilePath}
            />
          );
      }
    });

  // Optionally add "Show More" card
  if (linkUrl && filteredTitles.length > 20) {
    finalTitles.push(
      <ShowMoreCard
        key="show-more"
        url={linkUrl}
        posters={filteredTitles
          .slice(20, 24)
          .map((t) => (t.mediaType !== 'person' ? t.posterPath : undefined))}
      />
    );
  }

  // Auto-fetch more if fewer than 24 titles
  useEffect(() => {
    if (
      filteredTitles.length < 24 &&
      size < 5 &&
      (data?.[0]?.totalResults ?? 0) > size * 20
    ) {
      setSize(size + 1);
    }

    if (onNewTitles) onNewTitles(filteredTitles.length);
  }, [filteredTitles, size, setSize, data, onNewTitles]);

  if (hideWhenEmpty && filteredTitles.length === 0) return null;

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
