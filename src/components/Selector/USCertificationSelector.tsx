import React, { useEffect, useState } from 'react';

interface USCertificationSelectorProps {
  type: string;
  certification?: string;
  onChange: (params: {
    certificationCountry?: string;
    certification?: string;
  }) => void;
}

const US_MOVIE_CERTIFICATIONS = ['NR', 'G', 'PG', 'PG-13', 'R', 'NC-17'];
const US_TV_CERTIFICATIONS = [
  'NR',
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
];

const USCertificationSelector: React.FC<USCertificationSelectorProps> = ({
  type,
  certification,
  onChange,
}) => {
  const [selectedRatings, setSelectedRatings] = useState<string[]>(() =>
    certification ? certification.split('|') : []
  );

  const certifications =
    type === 'movie' ? US_MOVIE_CERTIFICATIONS : US_TV_CERTIFICATIONS;

  useEffect(() => {
    if (certification) {
      setSelectedRatings(certification.split('|'));
    } else {
      setSelectedRatings([]);
    }
  }, [certification]);

  const toggleRating = (rating: string) => {
    setSelectedRatings((prevSelected) => {
      let newSelected;

      if (prevSelected.includes(rating)) {
        newSelected = prevSelected.filter((r) => r !== rating);
      } else {
        newSelected = [...prevSelected, rating];
      }

      const newCertification =
        newSelected.length > 0 ? newSelected.join('|') : undefined;

      onChange({
        certificationCountry: 'US',
        certification: newCertification,
      });

      return newSelected;
    });
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {certifications.map((rating) => (
          <button
            key={rating}
            onClick={() => toggleRating(rating)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selectedRatings.includes(rating)
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
            type="button"
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
};

export default USCertificationSelector;
