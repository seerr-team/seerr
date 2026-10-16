import Button from '@app/components/Common/Button';
import {
  isBrandLogoPath,
  isDefaultBrandList,
  type DiscoverBrand,
} from '@app/components/Discover/brandLists';
import useToasts from '@app/hooks/useToasts';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import {
  MAX_DISCOVER_BRAND_NAME_LENGTH,
  discoverBrandSchema,
} from '@server/constants/discover';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import type { MessageDescriptor } from 'react-intl';
import { useIntl } from 'react-intl';

// The labels of one list. Messages that mention a brand get its name as
// `{name}`, and `tooMany` gets the limit as `{max}`.
export interface BrandListEditorMessages {
  title: MessageDescriptor;
  idPlaceholder: MessageDescriptor;
  add: MessageDescriptor;
  resetToDefault: MessageDescriptor;
  remove: MessageDescriptor;
  moveUp: MessageDescriptor;
  moveDown: MessageDescriptor;
  invalidId: MessageDescriptor;
  lookupFailed: MessageDescriptor;
  missingLogo: MessageDescriptor;
  duplicate: MessageDescriptor;
  added: MessageDescriptor;
  tooMany: MessageDescriptor;
}

interface BrandListEditorProps {
  brands: DiscoverBrand[];
  defaultBrands: DiscoverBrand[];
  maxBrands: number;
  // The API that returns a single brand, such as `/api/v1/network`
  lookupUrl: string;
  testId: string;
  messages: BrandListEditorMessages;
  onChange: (brands: DiscoverBrand[]) => void;
}

interface LookedUpBrand {
  id: number;
  name: string;
  logoPath?: string;
}

const BrandListEditor = ({
  brands,
  defaultBrands,
  maxBrands,
  lookupUrl,
  testId,
  messages,
  onChange,
}: BrandListEditorProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [brandId, setBrandId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const brandsRef = useRef(brands);
  const isMounted = useRef(true);

  useEffect(() => {
    brandsRef.current = brands;
  }, [brands]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const showError = (message: string) =>
    addToast(message, {
      appearance: 'error',
      autoDismiss: true,
    });

  const canAddBrand = (list: DiscoverBrand[], id: number): boolean => {
    const existing = list.find((brand) => brand.id === id);

    if (existing) {
      showError(
        intl.formatMessage(messages.duplicate, { name: existing.name })
      );
      return false;
    }

    if (list.length >= maxBrands) {
      showError(intl.formatMessage(messages.tooMany, { max: maxBrands }));
      return false;
    }

    return true;
  };

  const moveBrand = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= brands.length) {
      return;
    }

    const reordered = brands.slice();
    const [moved] = reordered.splice(index, 1);

    if (!moved) {
      return;
    }

    reordered.splice(nextIndex, 0, moved);
    onChange(reordered);
  };

  const addBrand = async () => {
    const id = Number(brandId.trim());

    if (!Number.isInteger(id) || id <= 0) {
      showError(intl.formatMessage(messages.invalidId));
      return;
    }

    if (!canAddBrand(brands, id)) {
      return;
    }

    setIsAdding(true);

    try {
      const response = await axios.get<LookedUpBrand>(`${lookupUrl}/${id}`);
      const brand = response.data;

      // The editor may have closed, or the list may have changed, while the
      // lookup was running, so check again against the latest list.
      if (!isMounted.current) {
        return;
      }

      const currentBrands = brandsRef.current;

      if (!canAddBrand(currentBrands, brand.id)) {
        return;
      }

      if (!brand.logoPath || !isBrandLogoPath(brand.logoPath)) {
        showError(
          intl.formatMessage(messages.missingLogo, { name: brand.name })
        );
        return;
      }

      // Use the same rules as the server so a brand that is added here can
      // always be saved. A very long name is shortened instead of rejected.
      const validated = discoverBrandSchema.safeParse({
        id: brand.id,
        name: brand.name?.trim().slice(0, MAX_DISCOVER_BRAND_NAME_LENGTH),
        logoPath: brand.logoPath,
      });

      if (!validated.success) {
        showError(intl.formatMessage(messages.lookupFailed));
        return;
      }

      onChange([...currentBrands, validated.data]);
      setBrandId('');
      addToast(
        intl.formatMessage(messages.added, { name: validated.data.name }),
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );
    } catch {
      if (isMounted.current) {
        showError(intl.formatMessage(messages.lookupFailed));
      }
    } finally {
      if (isMounted.current) {
        setIsAdding(false);
      }
    }
  };

  return (
    <div className="mb-6 mt-6" data-testid={testId}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-300">
          {intl.formatMessage(messages.title)}
        </span>
        <Button
          buttonType="default"
          buttonSize="sm"
          type="button"
          disabled={isDefaultBrandList(brands, defaultBrands)}
          onClick={() => onChange(defaultBrands)}
        >
          {intl.formatMessage(messages.resetToDefault)}
        </Button>
      </div>
      <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto">
        {brands.map((brand, index) => (
          <li
            key={brand.id}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm text-gray-200"
          >
            <span className="min-w-0 flex-1 truncate">{brand.name}</span>
            <button
              type="button"
              className="text-gray-400 hover:text-white disabled:text-gray-700"
              aria-label={intl.formatMessage(messages.moveUp, {
                name: brand.name,
              })}
              disabled={index === 0}
              onClick={() => moveBrand(index, -1)}
            >
              <ChevronUpIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="text-gray-400 hover:text-white disabled:text-gray-700"
              aria-label={intl.formatMessage(messages.moveDown, {
                name: brand.name,
              })}
              disabled={index === brands.length - 1}
              onClick={() => moveBrand(index, 1)}
            >
              <ChevronDownIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="text-gray-400 hover:text-white"
              aria-label={intl.formatMessage(messages.remove, {
                name: brand.name,
              })}
              onClick={() =>
                onChange(brands.filter((item) => item.id !== brand.id))
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
          void addBrand();
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          className="rounded-l-only"
          placeholder={intl.formatMessage(messages.idPlaceholder)}
          aria-label={intl.formatMessage(messages.idPlaceholder)}
          value={brandId}
          onChange={(event) => setBrandId(event.target.value)}
        />
        <button className="input-action" type="submit" disabled={isAdding}>
          <span>{intl.formatMessage(messages.add)}</span>
        </button>
      </form>
    </div>
  );
};

export default BrandListEditor;
