import { sliderTitles } from '@app/components/Discover/constants';
import MediaSlider from '@app/components/MediaSlider';
import { useUser } from '@app/hooks/useUser';
import { useIntl } from 'react-intl';

type WatchHistoryRecommendationsSliderProps = {
  sliderId?: number;
  title?: string | null;
};

const WatchHistoryRecommendationsSlider = ({
  sliderId,
  title,
}: WatchHistoryRecommendationsSliderProps) => {
  const intl = useIntl();
  const { user } = useUser();

  if (!user) {
    return null;
  }

  return (
    <MediaSlider
      sliderKey={`watch-history-recommendations-${sliderId ?? user.id}`}
      title={
        title || intl.formatMessage(sliderTitles.watchhistoryrecommendations)
      }
      url={`/api/v1/user/${user.id}/recommendations/watch-history`}
      hideWhenEmpty
    />
  );
};

export default WatchHistoryRecommendationsSlider;
