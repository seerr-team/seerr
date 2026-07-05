import { sliderTitles } from '@app/components/Discover/constants';
import Slider from '@app/components/Slider';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { SeasonalAnimeResponse } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const SeasonalAnimeSlider = () => {
  const intl = useIntl();

  const { data, error } = useSWR<SeasonalAnimeResponse>(
    '/api/v1/discover/seasonal-anime'
  );

  if ((data && data.results.length === 0) || error) {
    return null;
  }

  return (
    <>
      <div className="slider-header">
        <Link href="/discover/anime?seasonal=true" className="slider-title">
          <span>{intl.formatMessage(sliderTitles.seasonalanime)}</span>
          <ArrowRightCircleIcon />
        </Link>
      </div>
      <Slider
        sliderKey="seasonal-anime"
        isLoading={!data}
        isEmpty={false}
        items={data?.results.map((item) => (
          <TmdbTitleCard
            id={item.tmdbId}
            key={`seasonal-anime-slider-item-${item.ratingKey}`}
            tmdbId={item.tmdbId}
            type={item.mediaType}
          />
        ))}
      />
    </>
  );
};

export default SeasonalAnimeSlider;
