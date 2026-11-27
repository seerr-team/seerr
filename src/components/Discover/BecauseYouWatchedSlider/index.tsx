import { sliderTitles } from '@app/components/Discover/constants';
import MediaSlider from '@app/components/MediaSlider';
import { useUser } from '@app/hooks/useUser';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

type RecommendationSource = {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
};

type BecauseYouWatchedSliderProps = {
  sliderId?: number;
  title?: string | null;
};

const getRandomSource = (
  sources: RecommendationSource[]
): RecommendationSource | null => {
  if (!sources.length) {
    return null;
  }

  return sources[Math.floor(Math.random() * sources.length)];
};

const BecauseYouWatchedSlider = ({
  sliderId,
  title,
}: BecauseYouWatchedSliderProps) => {
  const intl = useIntl();
  const { user } = useUser();
  const [selectedSource, setSelectedSource] =
    useState<RecommendationSource | null>(null);

  const { data: sources } = useSWR<RecommendationSource[]>(
    user
      ? `/api/v1/user/${user.id}/recommendations/watch-history/sources`
      : null
  );

  useEffect(() => {
    if (!sources?.length) {
      setSelectedSource(null);
      return;
    }

    setSelectedSource(getRandomSource(sources));
  }, [sources]);

  if (!user || !selectedSource) {
    return null;
  }

  const titlePrefix =
    title || intl.formatMessage(sliderTitles.becauseyouwatched);

  return (
    <MediaSlider
      sliderKey={`because-you-watched-${sliderId ?? user.id}-${selectedSource.mediaType}-${selectedSource.tmdbId}`}
      title={`${titlePrefix}: ${selectedSource.title}`}
      url={`/api/v1/user/${user.id}/recommendations/watch-history/because`}
      extraParams={`mediaType=${selectedSource.mediaType}&tmdbId=${selectedSource.tmdbId}`}
      hideWhenEmpty
    />
  );
};

export default BecauseYouWatchedSlider;
