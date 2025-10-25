import CachedImage from '@app/components/Common/CachedImage';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import MediaSlider from '@app/components/MediaSlider';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { ProductionCompany } from '@server/models/common';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.DiscoverStudioEnhanced', {
  studioMovies: '{studio} Movies',
  trending: 'Trending from {studio}',
  new: 'New from {studio}',
  popular: 'Popular from {studio}',
  topRated: 'Top Rated from {studio}',
  allMovies: 'All {studio} Movies',
  action: 'Action',
  comedy: 'Comedy',
  drama: 'Drama',
  thriller: 'Thriller',
  horror: 'Horror',
  scifi: 'Science Fiction',
  animation: 'Animation',
  adventure: 'Adventure',
});

const DiscoverStudioEnhanced = () => {
  const router = useRouter();
  const intl = useIntl();
  const studioId = router.query.studioId as string;

  const { data: studioData, error } = useSWR<{
    studio: ProductionCompany;
    results: unknown[];
  }>(`/api/v1/discover/movies/studio/${studioId}?page=1`);

  if (error) {
    return <Error statusCode={500} />;
  }

  const studio = studioData?.studio;
  const title = studio?.name || intl.formatMessage(messages.studioMovies, { studio: '...' });

  // Define common movie genres
  const genres = [
    { id: '28', key: 'action', message: messages.action },
    { id: '35', key: 'comedy', message: messages.comedy },
    { id: '18', key: 'drama', message: messages.drama },
    { id: '53', key: 'thriller', message: messages.thriller },
    { id: '27', key: 'horror', message: messages.horror },
    { id: '878', key: 'scifi', message: messages.scifi },
    { id: '16', key: 'animation', message: messages.animation },
    { id: '12', key: 'adventure', message: messages.adventure },
  ];

  return (
    <>
      <PageTitle title={title} />
      <div className="mt-1 mb-5">
        <Header>
          {studio?.logoPath ? (
            <div className="relative mb-6 flex h-24 justify-center sm:h-32">
              <CachedImage
                type="tmdb"
                src={`https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)${studio.logoPath}`}
                alt={studio.name}
                className="object-contain"
                fill
              />
            </div>
          ) : (
            title
          )}
        </Header>
      </div>

      <div className="space-y-6">
        {/* Trending Slider */}
        <MediaSlider
          sliderKey={`studio-${studioId}-trending`}
          title={intl.formatMessage(messages.trending, { studio: studio?.name || '' })}
          url={`/api/v1/discover/movies/studio/${studioId}/trending`}
          linkUrl={`/discover/movies?studio=${studioId}&sortBy=popularity.desc`}
          hideWhenEmpty
        />

        {/* New Releases Slider */}
        <MediaSlider
          sliderKey={`studio-${studioId}-new`}
          title={intl.formatMessage(messages.new, { studio: studio?.name || '' })}
          url={`/api/v1/discover/movies/studio/${studioId}/new`}
          linkUrl={`/discover/movies?studio=${studioId}&sortBy=primary_release_date.desc`}
          hideWhenEmpty
        />

        {/* Popular Slider */}
        <MediaSlider
          sliderKey={`studio-${studioId}-popular`}
          title={intl.formatMessage(messages.popular, { studio: studio?.name || '' })}
          url={`/api/v1/discover/movies/studio/${studioId}/popular`}
          linkUrl={`/discover/movies?studio=${studioId}&sortBy=popularity.desc`}
        />

        {/* Top Rated Slider */}
        <MediaSlider
          sliderKey={`studio-${studioId}-top-rated`}
          title={intl.formatMessage(messages.topRated, { studio: studio?.name || '' })}
          url={`/api/v1/discover/movies/studio/${studioId}/top-rated`}
          linkUrl={`/discover/movies?studio=${studioId}&sortBy=vote_average.desc`}
          hideWhenEmpty
        />

        {/* Genre Sliders */}
        {genres.map((genre) => (
          <MediaSlider
            key={`studio-${studioId}-genre-${genre.id}`}
            sliderKey={`studio-${studioId}-genre-${genre.id}`}
            title={`${intl.formatMessage(genre.message)} - ${studio?.name || ''}`}
            url={`/api/v1/discover/movies/studio/${studioId}/genre/${genre.id}`}
            linkUrl={`/discover/movies?studio=${studioId}&genres=${genre.id}`}
            hideWhenEmpty
          />
        ))}

        {/* All Movies Slider */}
        <MediaSlider
          sliderKey={`studio-${studioId}-all`}
          title={intl.formatMessage(messages.allMovies, { studio: studio?.name || '' })}
          url={`/api/v1/discover/movies/studio/${studioId}`}
          linkUrl={`/discover/movies?studio=${studioId}`}
        />
      </div>
    </>
  );
};

export default DiscoverStudioEnhanced;
