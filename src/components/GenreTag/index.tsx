import Spinner from '@app/assets/spinner.svg';
import Tag from '@app/components/Common/Tag';
import { apiUrl } from '@app/utils/apiUrl';
import { RectangleStackIcon } from '@heroicons/react/24/outline';
import type { TmdbGenre } from '@server/api/themoviedb/interfaces';
import useSWR from 'swr';

type GenreTagProps = {
  type: 'tv' | 'movie';
  genreId: number;
};

const GenreTag = ({ genreId, type }: GenreTagProps) => {
  const { data, error } = useSWR<TmdbGenre[]>(apiUrl(`/genres/${type}`));

  if (!data && !error) {
    return (
      <Tag>
        <Spinner className="h-4 w-4" />
      </Tag>
    );
  }

  const genre = data?.find((genre) => genre.id === genreId);

  return <Tag iconSvg={<RectangleStackIcon />}>{genre?.name}</Tag>;
};

export default GenreTag;
