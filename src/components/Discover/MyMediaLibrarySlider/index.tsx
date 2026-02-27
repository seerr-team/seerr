import { sliderTitles } from '@app/components/Discover/constants';
import ShowMoreCard from '@app/components/MediaSlider/ShowMoreCard';
import Slider from '@app/components/Slider';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { MediaResultsResponse } from '@server/interfaces/api/mediaInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const MyMediaLibrarySlider = () => {
  const intl = useIntl();
  const { data: media, error: mediaError } = useSWR<MediaResultsResponse>(
    '/api/v1/media?filter=allavailable&take=20&sort=mediaAdded',
    { revalidateOnMount: true }
  );

  if ((media && media.results.length === 0 && !mediaError) || mediaError) {
    return null;
  }

  const items = (media?.results ?? []).map((item) => (
    <TmdbTitleCard
      key={`my-media-library-slider-item-${item.id}`}
      id={item.id}
      tmdbId={item.tmdbId}
      tvdbId={item.tvdbId}
      type={item.mediaType}
    />
  ));

  if ((media?.pageInfo.results ?? 0) > 20) {
    items.push(
      <ShowMoreCard
        key="my-media-library-show-more"
        url="/discover/library"
        posters={[undefined, undefined, undefined, undefined]}
      />
    );
  }

  return (
    <>
      <div className="slider-header">
        <Link href="/discover/library" className="slider-title">
          <span>{intl.formatMessage(sliderTitles.myMediaLibrary)}</span>
          <ArrowRightCircleIcon />
        </Link>
      </div>
      <Slider sliderKey="my-media-library" isLoading={!media} items={items} />
    </>
  );
};

export default MyMediaLibrarySlider;
