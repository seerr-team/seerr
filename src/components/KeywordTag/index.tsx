import Spinner from '@app/assets/spinner.svg';
import Tag from '@app/components/Common/Tag';
import { apiUrl } from '@app/utils/apiUrl';
import type { Keyword } from '@server/models/common';
import useSWR from 'swr';

type KeywordTagProps = {
  keywordId: number;
};

const KeywordTag = ({ keywordId }: KeywordTagProps) => {
  const { data, error } = useSWR<Keyword>(apiUrl(`/keyword/${keywordId}`));

  if (!data && !error) {
    return (
      <Tag>
        <Spinner className="h-4 w-4" />
      </Tag>
    );
  }

  return <Tag>{data?.name}</Tag>;
};

export default KeywordTag;
