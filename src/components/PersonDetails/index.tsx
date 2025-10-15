import Ellipsis from '@app/assets/ellipsis.svg';
import CachedImage from '@app/components/Common/CachedImage';
import ImageFader from '@app/components/Common/ImageFader';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import globalMessages from '@app/i18n/globalMessages';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowRightCircleIcon,
  CircleStackIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { MediaStatus } from '@server/constants/media';
import type { PersonCombinedCreditsResponse } from '@server/interfaces/api/personInterfaces';
import type { PersonDetails as PersonDetailsType } from '@server/models/Person';
import axios from 'axios';
import { groupBy, orderBy } from 'lodash';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import TruncateMarkup from 'react-truncate-markup';
import useSWR from 'swr';

const messages = defineMessages('components.PersonDetails', {
  birthdate: 'Born {birthdate}',
  lifespan: '{birthdate} – {deathdate}',
  alsoknownas: 'Also Known As: {names}',
  appearsin: 'Appearances',
  crewmember: 'Crew',
  ascharacter: 'as {character}',
  album: 'Album',
  single: 'Single',
  ep: 'EP',
  live: 'Live',
  compilation: 'Compilation',
  remix: 'Remix',
  soundtrack: 'Soundtrack',
  broadcast: 'Broadcast',
  demo: 'Demo',
  other: 'Other',
  showall: 'Show All',
  showless: 'Show Less',
});

const albumTypeMessages: Record<string, keyof typeof messages> = {
  Album: 'album',
  EP: 'ep',
  Single: 'single',
  Live: 'live',
  Compilation: 'compilation',
  Remix: 'remix',
  Soundtrack: 'soundtrack',
  Broadcast: 'broadcast',
  Demo: 'demo',
  Other: 'other',
};

interface Album {
  id: string;
  title?: string;
  'first-release-date'?: string;
  posterPath?: string | null;
  needsCoverArt?: boolean;
  'primary-type'?: string;
  secondary_types?: string[];
  'artist-credit'?: { name: string }[];
  mediaInfo?: {
    status: MediaStatus;
  };
}

interface ArtistWithTypeCounts {
  name?: string;
  artistBackdrop: string | null;
  artistThumb?: string;
  releaseGroups?: Album[];
  typeCounts?: Record<string, number>;
  area?: string;
  artist_mbid?: string;
}

interface AlbumTypeState {
  albums: Album[];
  isExpanded: boolean;
  isLoading: boolean;
  isHovered: boolean;
  isCollapsing: boolean;
}

interface EnhancedPersonDetails extends Omit<PersonDetailsType, 'artist'> {
  artist?: ArtistWithTypeCounts;
}

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  posterPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  mediaType: 'movie' | 'tv';
  mediaInfo?: {
    status?: MediaStatus;
  };
  character?: string;
  job?: string;
  backdropPath?: string;
  popularity?: number;
}

const Biography = ({
  content,
  showBio,
  onClick,
}: {
  content: string;
  showBio: boolean;
  onClick: () => void;
}) => {
  return (
    <div className="relative text-left">
      <div
        className="group outline-none ring-0"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <TruncateMarkup
          lines={showBio ? 200 : 6}
          ellipsis={
            <Ellipsis className="relative -top-0.5 ml-2 inline-block opacity-70 transition duration-300 group-hover:opacity-100" />
          }
        >
          <p className="pt-2 text-sm lg:text-base">{content}</p>
        </TruncateMarkup>
      </div>
    </div>
  );
};

const AlbumSection = ({
  type,
  state,
  totalCount,
  artistName,
  onToggleExpand,
  onHover,
}: {
  type: string;
  state: AlbumTypeState;
  totalCount: number;
  artistName?: string;
  onToggleExpand: (type: string) => void;
  onHover: (type: string, isHovered: boolean) => void;
}) => {
  const intl = useIntl();
  const { albums, isExpanded, isLoading, isHovered, isCollapsing } = state;

  const displayAlbums = isExpanded ? albums : albums.slice(0, 20);

  const shouldShowExpandButton = totalCount > 20;

  const remainingItems = totalCount - albums.length;
  const placeholdersToShow = isExpanded
    ? Math.min(remainingItems, 20)
    : Math.min(remainingItems, 20);

  const messageKey = albumTypeMessages[type] || 'other';
  const title = intl.formatMessage(messages[messageKey]);

  return (
    <div className="mb-8">
      <div className="slider-header">
        <div className="slider-title">
          <span>{title}</span>
          {totalCount > 0 && (
            <span className="ml-2 text-sm text-gray-400">({totalCount})</span>
          )}
        </div>
      </div>
      <ul className="cards-vertical">
        {displayAlbums
          .filter((media) => media && media.id)
          .map((media) => (
            <li key={`release-${media.id}`}>
              <TitleCard
                key={media.id}
                id={media.id}
                title={media.title ?? 'Unknown Album'}
                year={media['first-release-date']}
                image={media.posterPath ?? undefined}
                mediaType="album"
                artist={media['artist-credit']?.[0]?.name || artistName}
                type={media['primary-type']}
                status={media.mediaInfo?.status}
                needsCoverArt={media.needsCoverArt}
                canExpand
              />
            </li>
          ))}

        {shouldShowExpandButton && !isLoading && (
          <li>
            <div
              className={`w-40 transition-all duration-300 sm:w-40 md:w-40 ${
                isCollapsing ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
              }`}
              style={{ paddingBottom: '150%' }}
            >
              <div
                className="absolute inset-0 h-full w-full cursor-pointer"
                onClick={() => onToggleExpand(type)}
                onMouseEnter={() => onHover(type, true)}
                onMouseLeave={() => onHover(type, false)}
                onBlur={() => onHover(type, false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleExpand(type);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={intl.formatMessage(
                  isExpanded ? messages.showless : messages.showall
                )}
              >
                <div
                  className={`relative h-full w-full transform-gpu cursor-pointer
                  overflow-hidden rounded-xl text-white shadow-lg ring-1 transition duration-150 ease-in-out ${
                    isHovered
                      ? 'scale-105 bg-gray-600 ring-gray-500'
                      : 'scale-100 bg-gray-800 ring-gray-700'
                  }`}
                >
                  <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center text-white">
                    {isExpanded ? (
                      <XCircleIcon className="w-14" />
                    ) : (
                      <ArrowRightCircleIcon className="w-14" />
                    )}
                    <div className="mt-2 font-extrabold">
                      {intl.formatMessage(
                        isExpanded ? messages.showless : messages.showall
                      )}
                    </div>
                    {!isExpanded && totalCount > 20 && (
                      <div className="mt-1 text-sm text-gray-300">
                        {`${totalCount} total`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        )}

        {isLoading &&
          placeholdersToShow > 0 &&
          [...Array(placeholdersToShow)].map((_, i) => (
            <li key={`placeholder-${type}-${i}`}>
              <TitleCard.Placeholder canExpand />
            </li>
          ))}
      </ul>
    </div>
  );
};

const MediaSection = ({
  title,
  mediaItems,
}: {
  title: React.ReactNode;
  mediaItems: MediaItem[];
}) => {
  if (!mediaItems.length) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="slider-header">
        <div className="slider-title">
          <span>{title}</span>
        </div>
      </div>
      <ul className="cards-vertical">
        {mediaItems.map((media) => (
          <li key={`media-${media.id}`}>
            <TitleCard
              id={media.id}
              title={media.title || media.name || 'Unknown Title'}
              image={media.posterPath}
              year={
                media.releaseDate?.slice(0, 4) ||
                media.firstAirDate?.slice(0, 4)
              }
              mediaType={media.mediaType === 'movie' ? 'movie' : 'tv'}
              status={media.mediaInfo?.status}
              canExpand
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

const sortCredits = (credits: MediaItem[]): MediaItem[] => {
  return orderBy(
    credits.filter((credit) => credit.releaseDate || credit.firstAirDate),
    [
      (credit) => credit.releaseDate || credit.firstAirDate,
      (credit) => credit.popularity,
    ],
    ['desc', 'desc']
  );
};

type MediaType = 'all' | 'movie' | 'tv';

const PersonDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const [currentMediaType, setCurrentMediaType] = useState<string>('all');
  const personId = router.query.personId as string;
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  const { data, error } = useSWR<EnhancedPersonDetails>(
    personId ? `/api/v1/person/${personId}` : null,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 30000,
    }
  );

  const { data: combinedCredits, error: errorCombinedCredits } =
    useSWR<PersonCombinedCreditsResponse>(
      personId ? `/api/v1/person/${personId}/combined_credits` : null,
      {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        dedupingInterval: 30000,
      }
    );

  useEffect(() => {
    if ((data && combinedCredits) || (data && !data.knownForDepartment)) {
      setIsFullyLoaded(true);
    }
  }, [data, combinedCredits]);

  const [showBio, setShowBio] = useState(false);
  const [albumTypes, setAlbumTypes] = useState<Record<string, AlbumTypeState>>(
    {}
  );

  useEffect(() => {
    if (data?.artist?.typeCounts && data.artist.releaseGroups?.length) {
      const initialAlbumTypes: Record<string, AlbumTypeState> = {};

      data.artist.releaseGroups.forEach((album) => {
        if (album && album.id) {
          const type = album.secondary_types?.length
            ? album.secondary_types[0]
            : album['primary-type'] || 'Other';

          if (!initialAlbumTypes[type]) {
            initialAlbumTypes[type] = {
              albums: [],
              isExpanded: false,
              isLoading: false,
              isHovered: false,
              isCollapsing: false,
            };
          }
          initialAlbumTypes[type].albums.push({
            ...album,
            needsCoverArt: !album.posterPath,
          });
        }
      });

      setAlbumTypes(initialAlbumTypes);
    }
  }, [data?.artist?.typeCounts, data?.artist?.releaseGroups]);

  const loadAllAlbumsOfType = useCallback(
    async (albumType: string): Promise<void> => {
      if (!personId) return;

      const parsedPersonId = parseInt(personId, 10);
      if (
        isNaN(parsedPersonId) ||
        parsedPersonId <= 0 ||
        parsedPersonId.toString() !== personId
      ) {
        return;
      }

      const validAlbumTypes = [
        'Album',
        'EP',
        'Single',
        'Live',
        'Compilation',
        'Remix',
        'Soundtrack',
        'Broadcast',
        'Demo',
        'Other',
      ];
      if (!validAlbumTypes.includes(albumType)) {
        return;
      }

      setAlbumTypes((prev) => ({
        ...prev,
        [albumType]: {
          ...prev[albumType],
          isLoading: true,
        },
      }));

      try {
        const pageSize = Math.min(
          data?.artist?.typeCounts?.[albumType] || 100,
          1000
        );

        const response = await axios.get(`/api/v1/person/${parsedPersonId}`, {
          params: {
            albumType: albumType,
            pageSize: pageSize,
          },
        });

        const responseData = response.data;
        const validAlbums =
          responseData.artist?.releaseGroups
            ?.filter((album: Album) => album && album.id)
            .map((album: Album) => ({
              ...album,
              needsCoverArt: !album.posterPath,
            })) || [];

        setAlbumTypes((prev) => ({
          ...prev,
          [albumType]: {
            ...prev[albumType],
            albums: validAlbums,
            isExpanded: true,
            isLoading: false,
          },
        }));
      } catch (error) {
        setAlbumTypes((prev) => ({
          ...prev,
          [albumType]: {
            ...prev[albumType],
            isLoading: false,
          },
        }));
      }
    },
    [personId, data?.artist?.typeCounts]
  );

  const handleHover = useCallback((albumType: string, isHovered: boolean) => {
    setAlbumTypes((prev) => ({
      ...prev,
      [albumType]: {
        ...prev[albumType],
        isHovered,
      },
    }));
  }, []);

  const toggleExpandType = useCallback(
    (albumType: string): void => {
      const currentState = albumTypes[albumType];

      if (currentState?.isExpanded) {
        setAlbumTypes((prev) => ({
          ...prev,
          [albumType]: {
            ...prev[albumType],
            isCollapsing: true,
            isHovered: false,
          },
        }));

        setTimeout(() => {
          setAlbumTypes((prev) => ({
            ...prev,
            [albumType]: {
              ...prev[albumType],
              isExpanded: false,
              isCollapsing: false,
            },
          }));
        }, 300);
      } else {
        const albums = albumTypes[albumType]?.albums || [];
        const typeCount = data?.artist?.typeCounts?.[albumType] || 0;

        setAlbumTypes((prev) => ({
          ...prev,
          [albumType]: {
            ...prev[albumType],
            isHovered: false,
          },
        }));

        if (albums.length < typeCount) {
          loadAllAlbumsOfType(albumType);
        } else {
          setAlbumTypes((prev) => ({
            ...prev,
            [albumType]: {
              ...prev[albumType],
              isExpanded: true,
            },
          }));
        }
      }
    },
    [albumTypes, data?.artist?.typeCounts, loadAllAlbumsOfType]
  );

  const sortedCredits = useMemo(() => {
    const cast = combinedCredits?.cast ?? [];
    const crew = combinedCredits?.crew ?? [];

    return {
      cast: sortCredits(
        Object.values(groupBy(cast, 'id')).map((group) => ({
          ...group[0],
          character: group.map((g) => g.character).join(', '),
          mediaType: group[0].mediaType === 'movie' ? 'movie' : 'tv',
        }))
      ),
      crew: sortCredits(
        Object.values(groupBy(crew, 'id')).map((group) => ({
          ...group[0],
          job: group.map((g) => g.job).join(', '),
          mediaType: group[0].mediaType === 'movie' ? 'movie' : 'tv',
        }))
      ),
    };
  }, [combinedCredits]);

  const personAttributes = useMemo(() => {
    if (!data) return [];

    const attributes: string[] = [];

    if (data.birthday) {
      if (data.deathday) {
        attributes.push(
          intl.formatMessage(messages.lifespan, {
            birthdate: intl.formatDate(data.birthday, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            }),
            deathdate: intl.formatDate(data.deathday, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            }),
          })
        );
      } else {
        attributes.push(
          intl.formatMessage(messages.birthdate, {
            birthdate: intl.formatDate(data.birthday, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            }),
          })
        );
      }
    }

    if (data.placeOfBirth) {
      attributes.push(data.placeOfBirth);
    }

    return attributes;
  }, [data, intl]);

  const albumTypeOrder = [
    'Album',
    'EP',
    'Single',
    'Live',
    'Compilation',
    'Remix',
    'Soundtrack',
    'Broadcast',
    'Demo',
    'Other',
  ];

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  if (!isFullyLoaded && data.knownForDepartment) {
    return <LoadingSpinner />;
  }

  const backgroundImages = [
    ...(sortedCredits.cast ?? []),
    ...(sortedCredits.crew ?? []),
  ]
    .filter((media) => media.backdropPath)
    .map(
      (media) =>
        `https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${media.backdropPath}`
    )
    .slice(0, 6);

  const hasCredits = Boolean(
    sortedCredits.cast?.length || sortedCredits.crew?.length
  );
  const isLoading = !combinedCredits && !errorCombinedCredits;

  const mediaTypePicker = (
    <div className="mb-2 flex flex-grow sm:mb-0 sm:mr-2 lg:flex-grow-0">
      <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
        <CircleStackIcon className="h-6 w-6" />
      </span>
      <select
        id="mediaType"
        name="mediaType"
        onChange={(e) => {
          setCurrentMediaType(e.target.value as MediaType);
        }}
        value={currentMediaType}
        className="rounded-r-only"
      >
        <option value="all">{intl.formatMessage(globalMessages.all)}</option>
        <option value="movie">
          {intl.formatMessage(globalMessages.movies)}
        </option>
        <option value="tv">{intl.formatMessage(globalMessages.tvshows)}</option>
      </select>
    </div>
  );

  return (
    <>
      <PageTitle title={data.name} />
      {hasCredits && (
        <div className="absolute top-0 left-0 right-0 z-0 h-96">
          <ImageFader isDarker backgroundImages={backgroundImages} />
        </div>
      )}
      <div
        className={`relative z-10 mt-4 mb-8 flex flex-col items-center lg:flex-row ${
          data.biography ? 'lg:items-start' : ''
        }`}
      >
        {(data.profilePath || data.artist?.artistThumb) && (
          <div className="relative mb-6 mr-0 h-36 w-36 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-gray-700 lg:mb-0 lg:mr-6 lg:h-44 lg:w-44">
            <CachedImage
              type={data.profilePath ? 'tmdb' : 'music'}
              src={
                data.profilePath
                  ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${data.profilePath}`
                  : data.artist?.artistThumb ?? ''
              }
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
          </div>
        )}
        <div className="w-full text-center text-gray-300 lg:text-left">
          <div className="flex w-full items-center justify-center lg:justify-between">
            <h1 className="text-3xl text-white lg:text-4xl">{data.name}</h1>
            <div className="hidden flex-shrink-0 lg:block">
              {mediaTypePicker}
            </div>
          </div>
          <div className="mt-1 mb-2 space-y-1 text-xs text-white sm:text-sm lg:text-base">
            <div>{personAttributes.join(' | ')}</div>
            {(data.alsoKnownAs ?? []).length > 0 && (
              <div>
                {intl.formatMessage(messages.alsoknownas, {
                  names: (data.alsoKnownAs ?? []).reduce((prev, curr) =>
                    intl.formatMessage(globalMessages.delimitedlist, {
                      a: prev,
                      b: curr,
                    })
                  ),
                })}
              </div>
            )}
          </div>
          {data.biography && (
            <Biography
              content={data.biography}
              showBio={showBio}
              onClick={() => setShowBio((show) => !show)}
            />
          )}
        </div>
      </div>

      <div className="lg:hidden">{mediaTypePicker}</div>

      {data.artist?.typeCounts && (
        <div className="space-y-6">
          {albumTypeOrder
            .filter((type) => (albumTypes[type]?.albums.length ?? 0) > 0)
            .map((type) => (
              <AlbumSection
                key={`section-${type}`}
                type={type}
                state={albumTypes[type]}
                totalCount={data.artist?.typeCounts?.[type] ?? 0}
                artistName={data.artist?.name}
                onToggleExpand={toggleExpandType}
                onHover={handleHover}
              />
            ))}
        </div>
      )}

      {data.knownForDepartment && (
        <>
          {data.knownForDepartment === 'Acting' ? (
            <>
              <MediaSection
                title={intl.formatMessage(messages.appearsin)}
                mediaItems={sortedCredits.cast}
              />
              <MediaSection
                title={intl.formatMessage(messages.crewmember)}
                mediaItems={sortedCredits.crew}
              />
            </>
          ) : (
            <>
              <MediaSection
                title={intl.formatMessage(messages.crewmember)}
                mediaItems={sortedCredits.crew}
              />
              <MediaSection
                title={intl.formatMessage(messages.appearsin)}
                mediaItems={sortedCredits.cast}
              />
            </>
          )}
        </>
      )}

      {isLoading && <LoadingSpinner />}
    </>
  );
};

export default PersonDetails;
