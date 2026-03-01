import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { sliderTitles } from '@app/components/Discover/constants';
import TitleCard from '@app/components/TitleCard';
import TmdbTitleCard from '@app/components/TitleCard/TmdbTitleCard';
import useVerticalScroll from '@app/hooks/useVerticalScroll';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import type { MediaResultsResponse } from '@server/interfaces/api/mediaInterfaces';
import { useCallback } from 'react';
import { useIntl } from 'react-intl';
import useSWRInfinite from 'swr/infinite';

const PAGE_SIZE = 20;

const MyMediaLibrary = () => {
  const intl = useIntl();
  const { data, error, setSize, isValidating } =
    useSWRInfinite<MediaResultsResponse>(
      (pageIndex: number, previousPageData) => {
        if (
          previousPageData &&
          pageIndex + 1 > previousPageData.pageInfo.pages
        ) {
          return null;
        }

        const params = [
          'filter=allavailable',
          `take=${PAGE_SIZE}`,
          'sort=mediaAdded',
          `skip=${pageIndex * PAGE_SIZE}`,
        ].join('&');

        return `/api/v1/media?${params}`;
      },
      {
        initialSize: 2,
        revalidateFirstPage: false,
      }
    );

  const lastPage = data?.[data.length - 1];
  const loadMore = useCallback(() => {
    setSize((prevSize) => prevSize + 1);
  }, [setSize]);

  useVerticalScroll(
    loadMore,
    !isValidating &&
      !!data &&
      (lastPage?.pageInfo.page ?? 0) < (lastPage?.pageInfo.pages ?? 0)
  );

  if (error) {
    return <Error statusCode={500} />;
  }

  if (!data) {
    return <LoadingSpinner />;
  }

  const items = data.flatMap((page) => page.results);
  const isEmpty = items.length === 0;
  const isReachingEnd = lastPage?.pageInfo.page === lastPage?.pageInfo.pages;

  return (
    <>
      <PageTitle title={intl.formatMessage(sliderTitles.myMediaLibrary)} />
      <div className="mb-4">
        <Header>{intl.formatMessage(sliderTitles.myMediaLibrary)}</Header>
      </div>

      {isEmpty ? (
        <div className="mt-64 w-full text-center text-2xl text-gray-400">
          {intl.formatMessage(globalMessages.noresults)}
        </div>
      ) : (
        <ul className="cards-vertical">
          {items.map((item) => (
            <li key={`my-media-library-item-${item.id}`}>
              <TmdbTitleCard
                id={item.id}
                tmdbId={item.tmdbId}
                tvdbId={item.tvdbId}
                type={item.mediaType}
                canExpand
              />
            </li>
          ))}
          {isValidating &&
            !isReachingEnd &&
            [...Array(PAGE_SIZE)].map((_item, i) => (
              <li key={`my-media-library-placeholder-${i}`}>
                <TitleCard.Placeholder canExpand />
              </li>
            ))}
        </ul>
      )}
    </>
  );
};

export default MyMediaLibrary;
