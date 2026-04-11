import Header from '@app/components/Common/Header';
import Slider from '@app/components/Slider';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import defineMessages from '@app/utils/defineMessages';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { StreamingCollectionsResponse } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.StreamingCollections', {
  heading: 'Streaming Collections',
});

interface StreamingCollectionsProps {
  mediaType: 'movie' | 'tv';
}

const StreamingCollections = ({ mediaType }: StreamingCollectionsProps) => {
  const intl = useIntl();
  const endpoint = `/api/v1/discover/${
    mediaType === 'movie' ? 'movies' : 'tv'
  }/collections`;
  const { data, error } = useSWR<StreamingCollectionsResponse>(endpoint);

  if (error || (data && data.results.length === 0)) {
    return null;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mb-10">
      <Header>{intl.formatMessage(messages.heading)}</Header>
      <div className="mt-6 space-y-8">
        {data.results.map((collection) => (
          <div key={`${collection.mediaType}-${collection.id}`}>
            <div className="slider-header">
              <Link
                href={`/discover/${collection.mediaType === 'movie' ? 'movies' : 'tv'}/collection/${collection.id}`}
                className="slider-title min-w-0 pr-16"
              >
                <span className="truncate">{collection.title}</span>
                <ArrowRightCircleIcon />
              </Link>
            </div>
            <Slider
              sliderKey={`${collection.mediaType}-collection-${collection.id}`}
              isLoading={false}
              isEmpty={false}
              items={collection.items.map((item) => (
                <TmdbTitleCard
                  key={`${collection.id}-${item.tmdbId}`}
                  id={item.tmdbId}
                  tmdbId={item.tmdbId}
                  type={item.mediaType}
                />
              ))}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StreamingCollections;
