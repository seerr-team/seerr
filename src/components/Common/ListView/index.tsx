import AddedCard from '@app/components/AddedCard';
import GroupCard from '@app/components/GroupCard';
import PersonCard from '@app/components/PersonCard';
import TitleCard from '@app/components/TitleCard';
import { Permission, useUser } from '@app/hooks/useUser';
import useVerticalScroll from '@app/hooks/useVerticalScroll';
import globalMessages from '@app/i18n/globalMessages';
import { MediaStatus } from '@server/constants/media';
import type { WatchlistItem } from '@server/interfaces/api/discoverInterfaces';
import type {
  AlbumResult,
  ArtistResult,
  CollectionResult,
  MovieResult,
  PersonResult,
  TvResult,
} from '@server/models/Search';
import { useIntl } from 'react-intl';

type ListViewProps = {
  items?: (
    | TvResult
    | MovieResult
    | PersonResult
    | CollectionResult
    | ArtistResult
    | AlbumResult
  )[];
  plexItems?: WatchlistItem[];
  isEmpty?: boolean;
  isLoading?: boolean;
  isReachingEnd?: boolean;
  onScrollBottom: () => void;
  mutateParent?: () => void;
};

const ListView = ({
  items,
  isEmpty,
  isLoading,
  onScrollBottom,
  isReachingEnd,
  plexItems,
  mutateParent,
}: ListViewProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  useVerticalScroll(onScrollBottom, !isLoading && !isEmpty && !isReachingEnd);

  const blacklistVisibility = hasPermission(
    [Permission.MANAGE_BLACKLIST, Permission.VIEW_BLACKLIST],
    { type: 'or' }
  );

  return (
    <>
      {isEmpty && (
        <div className="mt-64 w-full text-center text-2xl text-gray-400">
          {intl.formatMessage(globalMessages.noresults)}
        </div>
      )}
      <ul className="cards-vertical">
        {plexItems?.map((title, index) => {
          return (
            <li key={`${title.ratingKey}-${index}`}>
              <AddedCard
                id={title.tmdbId ?? 0}
                tmdbId={title.tmdbId ?? 0}
                mbId={title.mbId}
                type={title.mediaType}
                isAddedToWatchlist={true}
                canExpand
                mutateParent={mutateParent}
              />
            </li>
          );
        })}
        {items
          ?.filter((title) => {
            if (!blacklistVisibility)
              return (
                (title as TvResult | MovieResult | AlbumResult).mediaInfo
                  ?.status !== MediaStatus.BLACKLISTED
              );
            return title;
          })
          .map((title, index) => {
            let titleCard: React.ReactNode;

            switch (title.mediaType) {
              case 'movie':
                titleCard = (
                  <TitleCard
                    key={title.id}
                    id={title.id}
                    isAddedToWatchlist={
                      title.mediaInfo?.watchlists?.length ?? 0
                    }
                    image={title.posterPath}
                    status={title.mediaInfo?.status}
                    summary={title.overview}
                    title={title.title}
                    userScore={title.voteAverage}
                    year={title.releaseDate}
                    mediaType={title.mediaType}
                    inProgress={
                      (title.mediaInfo?.downloadStatus ?? []).length > 0
                    }
                    canExpand
                  />
                );
                break;
              case 'tv':
                titleCard = (
                  <TitleCard
                    key={title.id}
                    id={title.id}
                    isAddedToWatchlist={
                      title.mediaInfo?.watchlists?.length ?? 0
                    }
                    image={title.posterPath}
                    status={title.mediaInfo?.status}
                    summary={title.overview}
                    title={title.name}
                    userScore={title.voteAverage}
                    year={title.firstAirDate}
                    mediaType={title.mediaType}
                    inProgress={
                      (title.mediaInfo?.downloadStatus ?? []).length > 0
                    }
                    canExpand
                  />
                );
                break;
              case 'collection':
                titleCard = (
                  <TitleCard
                    id={title.id}
                    image={title.posterPath}
                    summary={title.overview}
                    title={title.title}
                    mediaType={title.mediaType}
                    canExpand
                  />
                );
                break;
              case 'person':
                titleCard = (
                  <PersonCard
                    personId={title.id}
                    name={title.name}
                    profilePath={title.profilePath}
                    canExpand
                  />
                );
                break;
              case 'album':
                titleCard = (
                  <TitleCard
                    key={title.id}
                    id={title.id}
                    isAddedToWatchlist={
                      title.mediaInfo?.watchlists?.length ?? 0
                    }
                    image={
                      title.images?.find((image) => image.CoverType === 'Cover')
                        ?.Url
                    }
                    status={title.mediaInfo?.status}
                    title={title.title}
                    artist={title.artistname}
                    type={title.type}
                    year={title.releasedate}
                    mediaType={title.mediaType}
                    inProgress={
                      (title.mediaInfo?.downloadStatus ?? []).length > 0
                    }
                    canExpand
                  />
                );
                break;
              case 'artist':
                return title.type === 'Group' ? (
                  <GroupCard
                    key={title.id}
                    groupId={title.id}
                    name={title.artistname}
                    image={
                      title.images.find((image) => image.CoverType === 'Poster')
                        ?.Url ?? title.artistimage
                    }
                    canExpand
                  />
                ) : (
                  <PersonCard
                    key={title.id}
                    personId={title.id}
                    name={title.artistname}
                    mediaType="artist"
                    profilePath={title.artistimage}
                    canExpand
                  />
                );
            }

            return <li key={`${title.id}-${index}`}>{titleCard}</li>;
          })}
        {isLoading &&
          !isReachingEnd &&
          [...Array(20)].map((_item, i) => (
            <li key={`placeholder-${i}`}>
              <TitleCard.Placeholder canExpand />
            </li>
          ))}
      </ul>
    </>
  );
};

export default ListView;
