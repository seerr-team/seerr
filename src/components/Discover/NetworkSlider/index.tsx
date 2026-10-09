import CompanyCard from '@app/components/CompanyCard';
import NetworkSliderEditor from '@app/components/Discover/NetworkSlider/Editor';
import {
  networkLogoUrl,
  parseDiscoverNetworks,
  serializeDiscoverNetworks,
} from '@app/components/Discover/networks';
import Slider from '@app/components/Slider';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.NetworkSlider', {
  networks: 'Networks',
  emptyNetworks: 'No networks selected.',
});

interface NetworkSliderProps {
  data?: string | null;
  isEditing?: boolean;
  onChange?: (data: string | null) => void;
}

const NetworkSlider = ({
  data,
  isEditing = false,
  onChange,
}: NetworkSliderProps) => {
  const intl = useIntl();
  const networks = parseDiscoverNetworks(data);

  return (
    <>
      {isEditing && onChange && (
        <NetworkSliderEditor
          networks={networks}
          onChange={(nextNetworks) =>
            onChange(serializeDiscoverNetworks(nextNetworks))
          }
        />
      )}
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(messages.networks)}</span>
        </div>
      </div>
      <Slider
        sliderKey="networks"
        isLoading={false}
        isEmpty={networks.length === 0}
        items={networks.map((network) => (
          <CompanyCard
            key={`network-${network.id}`}
            name={network.name}
            image={networkLogoUrl(network.logoPath)}
            url={`/discover/tv/network/${network.id}`}
          />
        ))}
        emptyMessage={intl.formatMessage(messages.emptyNetworks)}
      />
    </>
  );
};

export default NetworkSlider;
