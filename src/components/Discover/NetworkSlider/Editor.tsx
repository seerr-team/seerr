import Button from '@app/components/Common/Button';
import {
  defaultDiscoverNetworks,
  isDefaultDiscoverNetworks,
  isNetworkLogoPath,
  type DiscoverNetwork,
} from '@app/components/Discover/networks';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import {
  MAX_DISCOVER_NETWORKS,
  MAX_DISCOVER_NETWORK_NAME_LENGTH,
  discoverNetworkSchema,
} from '@server/constants/discover';
import type { TvNetwork } from '@server/models/common';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.NetworkSlider.Editor', {
  editNetworks: 'Displayed networks',
  networkIdPlaceholder: 'TMDB Network ID',
  addNetwork: 'Add',
  resetToDefaultNetworks: 'Reset to Default Networks',
  removeNetwork: 'Remove {networkName}',
  moveUp: 'Move {networkName} up',
  moveDown: 'Move {networkName} down',
  invalidNetworkId: 'Enter a TMDB Network ID.',
  networkLookupFailed: 'Could not find that network.',
  networkMissingLogo: '{networkName} has no logo, so it cannot be added.',
  duplicateNetwork: '{networkName} is already in the list.',
  networkAdded: '{networkName} has been added to the list.',
  tooManyNetworks: 'A network list can contain at most {maxNetworks} networks.',
});

interface NetworkSliderEditorProps {
  networks: DiscoverNetwork[];
  onChange: (networks: DiscoverNetwork[]) => void;
}

const NetworkSliderEditor = ({
  networks,
  onChange,
}: NetworkSliderEditorProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [networkId, setNetworkId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const networksRef = useRef(networks);
  const isMounted = useRef(true);

  useEffect(() => {
    networksRef.current = networks;
  }, [networks]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const canAddNetwork = (list: DiscoverNetwork[], id: number): boolean => {
    const existing = list.find((network) => network.id === id);

    if (existing) {
      addToast(
        intl.formatMessage(messages.duplicateNetwork, {
          networkName: existing.name,
        }),
        {
          appearance: 'error',
          autoDismiss: true,
        }
      );
      return false;
    }

    if (list.length >= MAX_DISCOVER_NETWORKS) {
      addToast(
        intl.formatMessage(messages.tooManyNetworks, {
          maxNetworks: MAX_DISCOVER_NETWORKS,
        }),
        {
          appearance: 'error',
          autoDismiss: true,
        }
      );
      return false;
    }

    return true;
  };

  const moveNetwork = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= networks.length) {
      return;
    }

    const reordered = networks.slice();
    const [moved] = reordered.splice(index, 1);

    if (!moved) {
      return;
    }

    reordered.splice(nextIndex, 0, moved);
    onChange(reordered);
  };

  const addNetwork = async () => {
    const id = Number(networkId.trim());

    if (!Number.isInteger(id) || id <= 0) {
      addToast(intl.formatMessage(messages.invalidNetworkId), {
        appearance: 'error',
        autoDismiss: true,
      });
      return;
    }

    if (!canAddNetwork(networks, id)) {
      return;
    }

    setIsAdding(true);

    try {
      const response = await axios.get<TvNetwork>(`/api/v1/network/${id}`);
      const network = response.data;

      // The editor may have closed, or the list may have changed, while the
      // lookup was running, so check again against the latest list.
      if (!isMounted.current) {
        return;
      }

      const currentNetworks = networksRef.current;

      if (!canAddNetwork(currentNetworks, network.id)) {
        return;
      }

      if (!network.logoPath || !isNetworkLogoPath(network.logoPath)) {
        addToast(
          intl.formatMessage(messages.networkMissingLogo, {
            networkName: network.name,
          }),
          {
            appearance: 'error',
            autoDismiss: true,
          }
        );
        return;
      }

      // Use the same rules as the server so a network that is added here can
      // always be saved. A very long name is shortened instead of rejected.
      const validated = discoverNetworkSchema.safeParse({
        id: network.id,
        name: network.name?.trim().slice(0, MAX_DISCOVER_NETWORK_NAME_LENGTH),
        logoPath: network.logoPath,
      });

      if (!validated.success) {
        addToast(intl.formatMessage(messages.networkLookupFailed), {
          appearance: 'error',
          autoDismiss: true,
        });
        return;
      }

      onChange([...currentNetworks, validated.data]);
      setNetworkId('');
      addToast(
        intl.formatMessage(messages.networkAdded, {
          networkName: validated.data.name,
        }),
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );
    } catch {
      if (isMounted.current) {
        addToast(intl.formatMessage(messages.networkLookupFailed), {
          appearance: 'error',
          autoDismiss: true,
        });
      }
    } finally {
      if (isMounted.current) {
        setIsAdding(false);
      }
    }
  };

  return (
    <div className="mb-6 mt-6" data-testid="discover-network-editor">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-300">
          {intl.formatMessage(messages.editNetworks)}
        </span>
        <Button
          buttonType="default"
          buttonSize="sm"
          type="button"
          disabled={isDefaultDiscoverNetworks(networks)}
          onClick={() => onChange(defaultDiscoverNetworks)}
        >
          {intl.formatMessage(messages.resetToDefaultNetworks)}
        </Button>
      </div>
      <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto">
        {networks.map((network, index) => (
          <li
            key={network.id}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm text-gray-200"
          >
            <span className="min-w-0 flex-1 truncate">{network.name}</span>
            <button
              type="button"
              className="text-gray-400 hover:text-white disabled:text-gray-700"
              aria-label={intl.formatMessage(messages.moveUp, {
                networkName: network.name,
              })}
              disabled={index === 0}
              onClick={() => moveNetwork(index, -1)}
            >
              <ChevronUpIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="text-gray-400 hover:text-white disabled:text-gray-700"
              aria-label={intl.formatMessage(messages.moveDown, {
                networkName: network.name,
              })}
              disabled={index === networks.length - 1}
              onClick={() => moveNetwork(index, 1)}
            >
              <ChevronDownIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="text-gray-400 hover:text-white"
              aria-label={intl.formatMessage(messages.removeNetwork, {
                networkName: network.name,
              })}
              onClick={() =>
                onChange(networks.filter((item) => item.id !== network.id))
              }
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="form-input-field max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          void addNetwork();
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          className="rounded-l-only"
          placeholder={intl.formatMessage(messages.networkIdPlaceholder)}
          aria-label={intl.formatMessage(messages.networkIdPlaceholder)}
          value={networkId}
          onChange={(event) => setNetworkId(event.target.value)}
        />
        <button className="input-action" type="submit" disabled={isAdding}>
          <span>{intl.formatMessage(messages.addNetwork)}</span>
        </button>
      </form>
    </div>
  );
};

export default NetworkSliderEditor;
