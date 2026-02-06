import Slider from '@app/components/Slider';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { RecentSearchesItem } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.RecentSearchesSlider', {
  recentsearches: 'Your Recent Searches',
  emptyrecentsearches: 'Media added to your recent searches will appear here.',
});

const RecenSearchesSlider = () => {
  const intl = useIntl();
  const { user } = useUser();

  const { data: recentsearchesItems, error: recentsearchesError } = useSWR<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: RecentSearchesItem[];
  }>('/api/v1/discover/recentsearches', {
    revalidateOnMount: true,
  });

  if (
    (recentsearchesItems &&
      recentsearchesItems.results.length === 0 &&
      !user?.settings?.watchlistSyncMovies &&
      !user?.settings?.watchlistSyncTv) ||
    recentsearchesError
  ) {
    return null;
  }

  return (
    <>
      <div className="slider-header">
        <Link href="/discover/recentsearches" className="slider-title">
          <span>{intl.formatMessage(messages.recentsearches)}</span>
          <ArrowRightCircleIcon />
        </Link>
      </div>
      <Slider
        sliderKey="recentsearches"
        isLoading={!recentsearchesItems}
        isEmpty={
          !!recentsearchesItems && recentsearchesItems.results.length === 0
        }
        emptyMessage={intl.formatMessage(messages.emptyrecentsearches)}
        items={recentsearchesItems?.results
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
          .map((item) => (
            <TmdbTitleCard
              id={item.tmdbId}
              key={`recentsearch-slider-item-${item.ratingKey}`}
              tmdbId={item.tmdbId}
              type={item.mediaType}
            />
          ))}
      />
    </>
  );
};

export default RecenSearchesSlider;
