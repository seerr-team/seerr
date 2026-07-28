import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import defineMessages from '@app/utils/defineMessages';
import type { Region } from '@server/lib/settings';
import React, { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import AsyncSelect from 'react-select/async';
import useSWR from 'swr';

interface Certification {
  certification: string;
  meaning?: string;
  order?: number;
}

interface CertificationResponse {
  certifications: {
    [country: string]: Certification[];
  };
}

interface CertificationOption {
  value: string;
  label: string;
}

interface CertificationSelectorProps {
  type: 'movie' | 'tv';
  certification?: string;
  isDisabled?: boolean;
  onChange: (value: string | undefined) => void;
}

const messages = defineMessages('components.Selector.CertificationSelector', {
  selectCertification: 'Select a certification',
  noOptions: 'No options available',
  starttyping: 'Starting typing to search.',
  errorLoading: 'Failed to load certifications',
});

const CertificationSelector: React.FC<CertificationSelectorProps> = ({
  type,
  certification,
  isDisabled,
  onChange,
}) => {
  const intl = useIntl();
  const [selectedValues, setSelectedValues] = useState<CertificationOption[]>(
    []
  );
  const {
    data: certificationData,
    error: certificationError,
    isLoading: certificationLoading,
  } = useSWR<CertificationResponse>(`/api/v1/certifications/${type}`);

  const { data: regionsData } = useSWR<Region[]>('/api/v1/regions');

  // Get the country name from its code
  const getCountryName = useCallback(
    (countryCode: string): string => {
      const region = regionsData?.find(
        (region) => region.iso_3166_1 === countryCode
      );
      return region?.name || countryCode;
    },
    [regionsData]
  );
  const allOptions = useCallback((): CertificationOption[] => {
    if (!certificationData) return [];
    return Object.entries(certificationData.certifications).flatMap(
      ([countryCode, certificationValue]) =>
        certificationValue
          .filter((c) => c.certification)
          .map((c) => ({
            value: `${countryCode}:${c.certification}`,
            label: `${getCountryName(countryCode)} - ${c.certification}${
              c.meaning ? ` (${c.meaning})` : ''
            }`,
          }))
    );
  }, [certificationData, getCountryName]);

  useEffect(() => {
    if (!certification || !certificationData) {
      setSelectedValues([]);
      return;
    }
    const entries = certification.split(',');
    const options = allOptions();
    setSelectedValues(
      entries
        .map((entry) => options.find((o) => o.value === entry))
        .filter((o): o is CertificationOption => !!o)
    );
  }, [certification, certificationData, allOptions]);
  if (certificationError) {
    return (
      <div className="text-red-500">
        {intl.formatMessage(messages.errorLoading)}
      </div>
    );
  }

  if (certificationLoading || !certificationData) {
    return <SmallLoadingSpinner />;
  }

  const loadCertificationOptions = async (inputValue: string) => {
    return allOptions().filter((option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  };
  const handleChange = (options: readonly CertificationOption[] | null) => {
    const values = options ?? [];
    setSelectedValues(values as CertificationOption[]);
    onChange(
      values.length > 0 ? values.map((o) => o.value).join(',') : undefined
    );
  };

  return (
    <div className="space-y-2">
      <AsyncSelect
        className="react-select-container"
        classNamePrefix="react-select"
        isMulti
        isDisabled={isDisabled}
        cacheOptions
        defaultOptions
        loadOptions={loadCertificationOptions}
        value={selectedValues}
        onChange={handleChange}
        placeholder={intl.formatMessage(messages.selectCertification)}
        isClearable
        noOptionsMessage={({ inputValue }) =>
          inputValue === ''
            ? intl.formatMessage(messages.starttyping)
            : intl.formatMessage(messages.noOptions)
        }
      />
    </div>
  );
};
export default CertificationSelector;
