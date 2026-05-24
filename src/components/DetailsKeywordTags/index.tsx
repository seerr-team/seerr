import Tag from '@app/components/Common/Tag';
import type { Keyword } from '@server/models/common';
import Link from 'next/link';

interface DetailsKeywordTagsProps {
  keywords: Keyword[];
  mediaType: 'tv' | 'movies';
}

const DetailsKeywordTags = ({
  keywords,
  mediaType,
}: DetailsKeywordTagsProps) => {
  return (
    <div className="mt-6">
      {keywords.map((keyword) => (
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
