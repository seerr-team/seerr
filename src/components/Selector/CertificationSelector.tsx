import { SmallLoadingSpinner } from '@app/components/Common/LoadingSpinner';
import defineMessages from '@app/utils/defineMessages';
import type { Region } from '@server/interfaces/settings';
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
  certification?: string;
}

interface CertificationSelectorProps {
  type: string;
  certificationCountry?: string;
  certification?: string;
  certificationGte?: string;
  certificationLte?: string;
  onChange: (params: {
    certificationCountry?: string;
    certification?: string;
    certificationGte?: string;
    certificationLte?: string;
  }) => void;
  showRange?: boolean;
}

const messages = defineMessages('components.Selector.CertificationSelector', {
  selectCountry: 'Select a country',
  selectCertification: 'Select a certification',
  minRating: 'Minimum rating',
  maxRating: 'Maximum rating',
  noOptions: 'No options available',
  starttyping: 'Starting typing to search.',
  errorLoading: 'Failed to load certifications',
});

const CertificationSelector: React.FC<CertificationSelectorProps> = ({
  type,
  certificationCountry,
  certification,
  certificationGte,
  certificationLte,
  showRange = false,
  onChange,
}) => {
  const intl = useIntl();
  const [selectedCountry, setSelectedCountry] =
    useState<CertificationOption | null>(
      certificationCountry
        ? { value: certificationCountry, label: certificationCountry }
        : null
    );
  const [selectedCertification, setSelectedCertification] =
    useState<CertificationOption | null>(null);
  const [selectedCertificationGte, setSelectedCertificationGte] =
    useState<CertificationOption | null>(null);
  const [selectedCertificationLte, setSelectedCertificationLte] =
    useState<CertificationOption | null>(null);

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

  useEffect(() => {
    if (certificationCountry && regionsData) {
      setSelectedCountry({
        value: certificationCountry,
        label: getCountryName(certificationCountry),
      });
    }
  }, [certificationCountry, regionsData, getCountryName]);

  useEffect(() => {
    if (!certificationData || !certificationCountry) return;

    const certifications = (
      certificationData.certifications[certificationCountry] || []
    )
      .sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.certification.localeCompare(b.certification);
      })
      .map((cert) => ({
        value: cert.certification,
        label: `${cert.certification}${
          cert.meaning ? ` - ${cert.meaning}` : ''
        }`,
        certification: cert.certification,
      }));

    if (certification) {
      setSelectedCertification(
        certifications.find((c) => c.value === certification) || null
      );
    }

    if (certificationGte) {
      setSelectedCertificationGte(
        certifications.find((c) => c.value === certificationGte) || null
      );
    }

    if (certificationLte) {
      setSelectedCertificationLte(
        certifications.find((c) => c.value === certificationLte) || null
      );
    }
  }, [
    certificationData,
    certificationCountry,
    certification,
    certificationGte,
    certificationLte,
  ]);

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

  const loadCountryOptions = async (inputValue: string) => {
    if (!certificationData || !regionsData) return [];

    return Object.keys(certificationData.certifications)
      .filter(
        (code) =>
          certificationData.certifications[code] &&
          certificationData.certifications[code].length > 0 &&
          (code.toLowerCase().includes(inputValue.toLowerCase()) ||
            getCountryName(code)
              .toLowerCase()
              .includes(inputValue.toLowerCase()))
      )
      .sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)))
      .map((code) => ({
        value: code,
        label: getCountryName(code),
      }));
  };

  const loadCertificationOptions = async (inputValue: string) => {
    if (!certificationData || !certificationCountry) return [];

    return (certificationData.certifications[certificationCountry] || [])
      .sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.certification.localeCompare(b.certification);
      })
      .map((cert) => ({
        value: cert.certification,
        label: `${cert.certification}${
          cert.meaning ? ` - ${cert.meaning}` : ''
        }`,
        certification: cert.certification,
      }))
      .filter((cert) =>
        cert.label.toLowerCase().includes(inputValue.toLowerCase())
      );
  };

  const handleCountryChange = (option: CertificationOption | null) => {
    setSelectedCountry(option);
    setSelectedCertification(null);
    setSelectedCertificationGte(null);
    setSelectedCertificationLte(null);

    onChange({
      certificationCountry: option?.value,
      certification: undefined,
      certificationGte: undefined,
      certificationLte: undefined,
    });
  };

  const handleCertificationChange = (option: CertificationOption | null) => {
    setSelectedCertification(option);

    onChange({
      certificationCountry,
      certification: option?.value,
      certificationGte: undefined,
      certificationLte: undefined,
    });
  };

  const handleMinCertificationChange = (option: CertificationOption | null) => {
    setSelectedCertificationGte(option);

    onChange({
      certificationCountry,
      certification: undefined,
      certificationGte: option?.value,
      certificationLte: certificationLte,
    });
  };

  const handleMaxCertificationChange = (option: CertificationOption | null) => {
    setSelectedCertificationLte(option);

    onChange({
      certificationCountry,
      certification: undefined,
      certificationGte: certificationGte,
      certificationLte: option?.value,
    });
  };

  const formatCertificationLabel = (
    option: CertificationOption,
    { context }: { context: string }
  ) => {
    if (context === 'value') {
      return option.certification || option.value;
    }
    // Show the full label with description in the menu
    return option.label;
  };

  return (
    <div className="space-y-2">
      <AsyncSelect
        className="react-select-container"
        classNamePrefix="react-select"
        cacheOptions
        defaultOptions
        loadOptions={loadCountryOptions}
        value={selectedCountry}
        onChange={handleCountryChange}
        placeholder={intl.formatMessage(messages.selectCountry)}
        isClearable
        noOptionsMessage={({ inputValue }) =>
          inputValue === ''
            ? intl.formatMessage(messages.starttyping)
            : intl.formatMessage(messages.noOptions)
        }
      />

      {certificationCountry && !showRange && (
        <AsyncSelect
          className="react-select-container"
          classNamePrefix="react-select"
          cacheOptions
          defaultOptions
          loadOptions={loadCertificationOptions}
          value={selectedCertification}
          onChange={handleCertificationChange}
          placeholder={intl.formatMessage(messages.selectCertification)}
          formatOptionLabel={formatCertificationLabel}
          isClearable
          noOptionsMessage={() => intl.formatMessage(messages.noOptions)}
        />
      )}

      {certificationCountry && showRange && (
        <div className="flex space-x-2">
          <div className="flex-1">
            <AsyncSelect
              className="react-select-container"
              classNamePrefix="react-select"
              cacheOptions
              defaultOptions
              loadOptions={loadCertificationOptions}
              value={selectedCertificationGte}
              onChange={handleMinCertificationChange}
              placeholder={intl.formatMessage(messages.minRating)}
              formatOptionLabel={formatCertificationLabel}
              isClearable
              noOptionsMessage={() => intl.formatMessage(messages.noOptions)}
            />
          </div>
          <div className="flex-1">
            <AsyncSelect
              className="react-select-container"
              classNamePrefix="react-select"
              cacheOptions
              defaultOptions
              loadOptions={loadCertificationOptions}
              value={selectedCertificationLte}
              onChange={handleMaxCertificationChange}
              placeholder={intl.formatMessage(messages.maxRating)}
              formatOptionLabel={formatCertificationLabel}
              isClearable
              noOptionsMessage={() => intl.formatMessage(messages.noOptions)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificationSelector;
