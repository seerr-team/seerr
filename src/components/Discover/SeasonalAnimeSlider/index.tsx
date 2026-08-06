import Button from '@app/components/Common/Button';
import { sliderTitles } from '@app/components/Discover/constants';
import Slider from '@app/components/Slider';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import globalMessages from '@app/i18n/globalMessages';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { SeasonalAnimeResponse } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const SeasonalAnimeSlider = () => {
  const intl = useIntl();

  const { data, error, mutate } = useSWR<SeasonalAnimeResponse>(
    '/api/v1/discover/seasonal-anime',
    { revalidateOnFocus: false }
  );

  if (data && data.results.length === 0) {
    return null;
  }

  if (error && !data) {
    return (
      <>
        <div className="slider-header">
          <Link href="/discover/anime?seasonal=true" className="slider-title">
            <span>{intl.formatMessage(sliderTitles.seasonalanime)}</span>
            <ArrowRightCircleIcon />
          </Link>
        </div>
        <div
          className="flex items-center justify-between rounded-lg bg-gray-800 p-4 text-gray-300"
          data-testid="seasonal-anime-slider-error"
        >
          <span>{intl.formatMessage(globalMessages.error)}</span>
          <Button
            buttonSize="sm"
            onClick={() => void mutate()}
            data-testid="seasonal-anime-slider-retry"
            type="button"
          >
            {intl.formatMessage(globalMessages.retry)}
          </Button>
        </div>
      </>
    );
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
