import BrandListEditor from '@app/components/Discover/BrandListEditor';
import {
  defaultDiscoverNetworks,
  type DiscoverNetwork,
} from '@app/components/Discover/networks';
import defineMessages from '@app/utils/defineMessages';
import { MAX_DISCOVER_NETWORKS } from '@server/constants/discover';

const messages = defineMessages('components.Discover.NetworkSlider.Editor', {
  editNetworks: 'Displayed networks',
  networkIdPlaceholder: 'TMDB Network ID',
  addNetwork: 'Add',
  resetToDefaultNetworks: 'Reset to Default Networks',
  removeNetwork: 'Remove {name}',
  moveUp: 'Move {name} up',
  moveDown: 'Move {name} down',
  invalidNetworkId: 'Enter a TMDB Network ID.',
  networkLookupFailed: 'Could not find that network.',
  networkMissingLogo: '{name} has no logo, so it cannot be added.',
  duplicateNetwork: '{name} is already in the list.',
  networkAdded: '{name} has been added to the list.',
  tooManyNetworks: 'A network list can contain at most {max} networks.',
});

interface NetworkSliderEditorProps {
  networks: DiscoverNetwork[];
  onChange: (networks: DiscoverNetwork[]) => void;
}

const NetworkSliderEditor = ({
  networks,
  onChange,
}: NetworkSliderEditorProps) => (
  <BrandListEditor
    brands={networks}
    defaultBrands={defaultDiscoverNetworks}
    maxBrands={MAX_DISCOVER_NETWORKS}
    lookupUrl="/api/v1/network"
    testId="discover-network-editor"
    onChange={onChange}
    messages={{
      title: messages.editNetworks,
      idPlaceholder: messages.networkIdPlaceholder,
      add: messages.addNetwork,
      resetToDefault: messages.resetToDefaultNetworks,
      remove: messages.removeNetwork,
      moveUp: messages.moveUp,
      moveDown: messages.moveDown,
      invalidId: messages.invalidNetworkId,
      lookupFailed: messages.networkLookupFailed,
      missingLogo: messages.networkMissingLogo,
      duplicate: messages.duplicateNetwork,
      added: messages.networkAdded,
      tooMany: messages.tooManyNetworks,
    }}
  />
);

export default NetworkSliderEditor;
