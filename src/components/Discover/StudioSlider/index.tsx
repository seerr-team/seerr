import BrandCard from '@app/components/BrandCard';
import StudioSliderEditor from '@app/components/Discover/StudioSlider/Editor';
import { brandLogoUrl } from '@app/components/Discover/brandLists';
import {
  parseDiscoverStudios,
  serializeDiscoverStudios,
} from '@app/components/Discover/studios';
import Slider from '@app/components/Slider';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.StudioSlider', {
  studios: 'Studios',
  emptyStudios: 'No studios selected.',
});

interface StudioSliderProps {
  data?: string | null;
  isEditing?: boolean;
  onChange?: (data: string | null) => void;
}

const StudioSlider = ({
  data,
  isEditing = false,
  onChange,
}: StudioSliderProps) => {
  const intl = useIntl();
  const studios = parseDiscoverStudios(data);

  return (
    <>
      {isEditing && onChange && (
        <StudioSliderEditor
          studios={studios}
          onChange={(nextStudios) =>
            onChange(serializeDiscoverStudios(nextStudios))
          }
        />
      )}
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.studios)}</span>
        </div>
      </div>
      <Slider
        sliderKey="studios"
        isLoading={false}
        isEmpty={studios.length === 0}
        items={studios.map((studio) => (
          <BrandCard
            key={`studio-${studio.id}`}
            name={studio.name}
            image={brandLogoUrl(studio.logoPath)}
            url={`/discover/movies/studio/${studio.id}`}
          />
        ))}
        emptyMessage={intl.formatMessage(messages.emptyStudios)}
      />
    </>
  );
};

export default StudioSlider;
