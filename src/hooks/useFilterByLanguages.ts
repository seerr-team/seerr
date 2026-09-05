import type { FilterByLanguage } from '@app/types/filters';
import type { FullPublicSettings } from '@server/lib/settings';
import type {
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

interface Props {
  titles: (MovieResult | TvResult | PersonResult)[];
  movie: boolean;
  tv: boolean;
  key?: FilterByLanguage;
}

const useFilterByLanguages = (props: Readonly<Props>) => {
  const { titles, movie, tv, key } = props;

  const { data: publicSettings } = useSWR<FullPublicSettings>(
    '/api/v1/settings/public'
  );
  const [originalLanguages, setOriginalLanguages] = useState<string[]>([]);
  const [applyFilter, setApplyFilter] = useState<boolean>(false);

  useEffect(
    function syncFilterByLanguage() {
      if (!publicSettings || !key) return;

      setApplyFilter(publicSettings.filters[key]);

      if (publicSettings.originalLanguage) {
        const languages = publicSettings.originalLanguage
          .split('|')
          .map((lang) => lang.trim());
        setOriginalLanguages(languages);
      }
    },
    [publicSettings, key]
  );

  return titles.filter((title) => {
    if (!applyFilter) return true;

    if (
      (movie && title.mediaType === 'movie') ||
      (tv && title.mediaType === 'tv')
    ) {
      return originalLanguages.includes(title.originalLanguage);
    }

    return true;
  });
};

export default useFilterByLanguages;
