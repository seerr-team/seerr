import ShowMoreCard from '@app/components/MediaSlider/ShowMoreCard';
import PersonCard from '@app/components/PersonCard';
import Slider from '@app/components/Slider';
import TitleCard from '@app/components/TitleCard';
import useSettings from '@app/hooks/useSettings';
import { useUser } from '@app/hooks/useUser';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import { Permission } from '@server/lib/permissions';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';

/** How early a row starts loading, relative to the viewport. */
const LAZY_MOUNT_ROOT_MARGIN = '600px 0px';

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
  /**
   * Rows hold off fetching until they are near the viewport. Set to false for a
   * row that must load even if it is never scrolled to, such as a preview whose
   * result count gates a form.
   */
  lazy?: boolean;
}

const MediaSlider = ({
  title,
  url,
  linkUrl,
  extraParams,
  sliderKey,
  hideWhenEmpty = false,
  onNewTitles,
  lazy = true,
}: MediaSliderProps) => {
  const settings = useSettings();
  const { hasPermission } = useUser();
  const headerRef = useRef<HTMLDivElement>(null);
  const [shouldFetch, setShouldFetch] = useState(!lazy);

  // A Discover page can hold a dozen rows; without this they would all fetch at
  // once on mount, most of them for posters nobody scrolls down to.
  useEffect(() => {
    if (shouldFetch) {
      return;
    }

    if (!headerRef.current || typeof IntersectionObserver === 'undefined') {
      setShouldFetch(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldFetch(true);
          observer.disconnect();
        }
      },
      { rootMargin: LAZY_MOUNT_ROOT_MARGIN }
    );

    observer.observe(headerRef.current);

    return () => observer.disconnect();
  }, [shouldFetch]);

  const { data, error, setSize, size } = useSWRInfinite<MixedResult>(
    (pageIndex: number, previousPageData: MixedResult | null) => {
      if (!shouldFetch) {
        return null;
      }

      if (previousPageData && pageIndex + 1 > previousPageData.totalPages) {
        return null;
      }

      return `${url}?page=${pageIndex + 1}${
        extraParams ? `&${extraParams}` : ''
      }`;
    },
    {
      initialSize: 2,
      revalidateFirstPage: false,
    }
  );

  let titles = (data ?? []).reduce(
    (a, v) => [...a, ...v.results],
    [] as (MovieResult | TvResult | PersonResult)[]
  );

  if (settings.currentSettings.hideAvailable) {
    titles = titles.filter(
      (i) =>
        (i.mediaType === 'movie' || i.mediaType === 'tv') &&
        i.mediaInfo?.status !== MediaStatus.AVAILABLE &&
        i.mediaInfo?.status !== MediaStatus.PARTIALLY_AVAILABLE
    );
  }

  if (settings.currentSettings.hideBlocklisted) {
    titles = titles.filter(
      (i) =>
        (i.mediaType === 'movie' || i.mediaType === 'tv') &&
        i.mediaInfo?.status !== MediaStatus.BLOCKLISTED
    );
  }

  useEffect(() => {
    if (
      titles.length < 24 &&
      size < 5 &&
      (data?.[0]?.totalResults ?? 0) > size * 20
    ) {
      setSize(size + 1);
    }

    if (onNewTitles) {
      // We aren't reporting all titles. We just want to know if there are any titles
      // at all for our purposes.
      onNewTitles(titles.length);
    }
  }, [titles, setSize, size, data, onNewTitles]);

  // Only once we know what the row holds: while `data` is undefined the row has
  // not answered yet, and hiding it early would keep it from ever loading.
  if (hideWhenEmpty && data && (data[0]?.results ?? []).length === 0) {
    return null;
  }

  const blocklistVisibility = hasPermission(
    [Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST],
    { type: 'or' }
  );

  const finalTitles = titles
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
              personId={title.id}
              name={title.name}
              profilePath={title.profilePath}
            />
          );
      }
    });

  if (linkUrl && titles.length > 20) {
    finalTitles.push(
      <ShowMoreCard
        url={linkUrl}
        posters={titles
          .slice(20, 24)
          .map((title) =>
            title.mediaType !== 'person' ? title.posterPath : undefined
          )}
      />
    );
  }

  return (
    <>
      <div className="slider-header" ref={headerRef}>
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
        isEmpty={!!data && finalTitles.length === 0}
        items={finalTitles}
      />
    </>
  );
};

export default MediaSlider;
