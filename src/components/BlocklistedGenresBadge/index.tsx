import Badge from '@app/components/Common/Badge';
import Tooltip from '@app/components/Common/Tooltip';
import defineMessages from '@app/utils/defineMessages';
import { FilmIcon } from '@heroicons/react/20/solid';
import type { TmdbGenre } from '@server/api/themoviedb/interfaces';
import type { BlocklistItem } from '@server/interfaces/api/blocklistInterfaces';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Settings', {
  blocklistedGenresText: 'Blocklisted Genres',
});

interface BlocklistedGenresBadgeProps {
  data: BlocklistItem;
}

const BlocklistedGenresBadge = ({ data }: BlocklistedGenresBadgeProps) => {
  const [genreNamesBlocklistedFor, setGenreNamesBlocklistedFor] =
    useState<string>('Loading...');
  const intl = useIntl();

  useEffect(() => {
    if (!data.blocklistedGenres) {
      return;
    }
    const genreIds = data.blocklistedGenres.slice(1, -1).split(',');
    axios
      .get<TmdbGenre[]>(`/api/v1/genres/${data.mediaType}`)
      .then(({ data: genres }) => {
        setGenreNamesBlocklistedFor(
          genreIds
            .map(
              (id) =>
                genres.find((g) => g.id === Number(id))?.name ??
                `[Invalid: ${id}]`
            )
            .join(', ')
        );
      });
  }, [data.blocklistedGenres, data.mediaType]);

  return (
    <Tooltip
      content={genreNamesBlocklistedFor}
      tooltipConfig={{ followCursor: false }}
    >
      <Badge
        badgeType="dark"
        className="items-center border border-red-500 !text-red-400"
      >
        <FilmIcon className="mr-1 h-4" />
        {intl.formatMessage(messages.blocklistedGenresText)}
      </Badge>
    </Tooltip>
  );
};

export default BlocklistedGenresBadge;
