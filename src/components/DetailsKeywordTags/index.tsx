import Tag from '@app/components/Common/Tag';
import defineMessages from '@app/utils/defineMessages';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import type { Keyword } from '@server/models/common';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.DetailsKeywordTags', {
  hidekeywords: 'Hide Keywords',
  showkeywords: 'Show Keywords',
});

interface DetailsKeywordTagsProps {
  keywords: Keyword[];
  mediaType: 'tv' | 'movies';
}

const DetailsKeywordTags = ({
  keywords,
  mediaType,
}: DetailsKeywordTagsProps) => {
  const intl = useIntl();
  const [showTags, setShowTags] = useState(true);

  useEffect(() => {
    setShowTags(window.localStorage.getItem('showKeywordTags') !== 'false'); // Default to true if not set
  }, []);

  const toggleTags = () => {
    setShowTags((current) => {
      const newValue = !current;
      window.localStorage.setItem('showKeywordTags', String(newValue));
      return newValue;
    });
  };

  return (
    <div className="mt-6">
      <button onClick={toggleTags} className="mb-2 mr-2 inline-flex last:mr-0">
        <Tag iconSvg={showTags ? <EyeSlashIcon /> : <EyeIcon />}>
          <span className="font-bold text-indigo-400">
            {showTags
              ? intl.formatMessage(messages.hidekeywords)
              : intl.formatMessage(messages.showkeywords)}
          </span>
        </Tag>
      </button>

      {showTags &&
        keywords.map((keyword) => (
          <Link
            href={`/discover/${mediaType}?keywords=${keyword.id}`}
            key={`keyword-id-${keyword.id}`}
            className="mb-2 mr-2 inline-flex last:mr-0"
          >
            <Tag>{keyword.name}</Tag>
          </Link>
        ))}
    </div>
  );
};

export default DetailsKeywordTags;
