import Ellipsis from '@app/assets/ellipsis.svg';
import CachedImage from '@app/components/Common/CachedImage';
import ImageFader from '@app/components/Common/ImageFader';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ArrowRightCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import TruncateMarkup from 'react-truncate-markup';
import useSWR from 'swr';

const messages = defineMessages('components.ArtistDetails', {
  birthdate: 'Born {birthdate}',
  lifespan: '{birthdate} – {deathdate}',
  alsoknownas: 'Also Known As: {names}',
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

interface ArtistData {
  artist?: {
    name: string;
    area?: string;
  };
  name?: string;
  artistThumb?: string;
  artistBackdrop?: string;
  biography?: string;
  wikipedia?: {
    content: string;
  };
  birthday?: string;
  deathday?: string;
  releaseGroups: Album[];
  typeCounts?: Record<string, number>;
}

interface AlbumTypeState {
  albums: Album[];
  isExpanded: boolean;
  isLoading: boolean;
  isHovered: boolean;
  isCollapsing: boolean;
}

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
  artistName: string;
  onToggleExpand: (type: string) => void;
  onHover: (type: string, isHovered: boolean) => void;
}) => {
  const intl = useIntl();
  const { albums, isExpanded, isLoading, isHovered, isCollapsing } = state;

  const displayAlbums = isExpanded ? albums : albums.slice(0, 20);

  const shouldShowExpandButton = totalCount > 20;

  const remainingItems = totalCount - albums.length;
  const placeholdersToShow = Math.min(remainingItems, 20);

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
                id={media.id}
                title={media.title || 'Unknown Album'}
                year={media['first-release-date']}
                image={media.posterPath ?? undefined}
                mediaType="album"
                artist={media['artist-credit']?.[0]?.name || artistName}
                type={media['primary-type']}
                status={media.mediaInfo?.status ?? MediaStatus.UNKNOWN}
                canExpand
                needsCoverArt={!media.posterPath}
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

const ArtistDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const artistId = router.query.artistId as string;

  const { data, error } = useSWR<ArtistData>(
    artistId ? `/api/v1/artist/${artistId}` : null,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 30000,
    }
  );

  const [albumTypes, setAlbumTypes] = useState<Record<string, AlbumTypeState>>(
    {}
  );
  const [showBio, setShowBio] = useState(false);

  useEffect(() => {
    if (data?.typeCounts) {
      const initialAlbumTypes: Record<string, AlbumTypeState> = {};

      data.releaseGroups.forEach((album) => {
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
          initialAlbumTypes[type].albums.push(album);
        }
      });

      setAlbumTypes(initialAlbumTypes);
    }
  }, [data]);

  const artistName = useMemo(() => {
    return data?.artist?.name || data?.name || '';
  }, [data]);

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

    if (data.artist?.area) {
      attributes.push(data.artist.area);
    }

    return attributes;
  }, [data, intl]);

  const biographyContent = useMemo(() => {
    return data?.biography || data?.wikipedia?.content || '';
  }, [data]);

  const handleHover = useCallback((albumType: string, isHovered: boolean) => {
    setAlbumTypes((prev) => ({
      ...prev,
      [albumType]: {
        ...prev[albumType],
        isHovered,
      },
    }));
  }, []);

  const loadAllAlbumsOfType = useCallback(
    async (albumType: string): Promise<void> => {
      if (!artistId) return;

      setAlbumTypes((prev) => ({
        ...prev,
        [albumType]: {
          ...prev[albumType],
          isLoading: true,
        },
      }));

      try {
        const response = await fetch(
          `/api/v1/artist/${artistId}?albumType=${albumType}&pageSize=${
            data?.typeCounts?.[albumType] || 100
          }`
        );

        if (response.ok) {
          const responseData = await response.json();
          const validAlbums = responseData.releaseGroups
            .filter((album: Album) => album && album.id)
            .map((album: Album) => ({
              ...album,
              needsCoverArt: album.posterPath ? false : true,
            }));

          setAlbumTypes((prev) => ({
            ...prev,
            [albumType]: {
              ...prev[albumType],
              albums: validAlbums,
              isExpanded: true,
              isLoading: false,
            },
          }));
        }
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
    [artistId, data]
  );

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
        const typeCount = data?.typeCounts?.[albumType] || 0;

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
    [albumTypes, data, loadAllAlbumsOfType]
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

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

  return (
    <>
      <PageTitle title={artistName} />
      <div className="absolute top-0 left-0 right-0 z-0 h-96">
        <ImageFader
          isDarker
          backgroundImages={data.artistBackdrop ? [data.artistBackdrop] : []}
        />
      </div>
      <div
        className={`relative z-10 mt-4 mb-8 flex flex-col items-center lg:flex-row ${
          biographyContent ? 'lg:items-start' : ''
        }`}
      >
        {data.artistThumb && (
          <div className="relative mb-6 mr-0 h-36 w-36 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-gray-700 lg:mb-0 lg:mr-6 lg:h-44 lg:w-44">
            <CachedImage
              type="music"
              src={data.artistThumb}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              fill
            />
          </div>
        )}
        <div className="text-center text-gray-300 lg:text-left">
          <h1 className="text-3xl text-white lg:text-4xl">{artistName}</h1>
          <div className="mt-1 mb-2 space-y-1 text-xs text-white sm:text-sm lg:text-base">
            <div>{personAttributes.join(' | ')}</div>
          </div>
          {biographyContent && (
            <Biography
              content={biographyContent}
              showBio={showBio}
              onClick={() => setShowBio((show) => !show)}
            />
          )}
        </div>
      </div>

      <div className="space-y-6">
        {albumTypeOrder
          .filter((type) => (albumTypes[type]?.albums.length ?? 0) > 0)
          .map((type) => (
            <AlbumSection
              key={`section-${type}`}
              type={type}
              state={albumTypes[type]}
              totalCount={data.typeCounts?.[type] ?? 0}
              artistName={artistName}
              onToggleExpand={toggleExpandType}
              onHover={handleHover}
            />
          ))}
      </div>
    </>
  );
};

export default ArtistDetails;
