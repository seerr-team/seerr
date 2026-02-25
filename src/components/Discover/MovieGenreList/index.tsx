import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { genreColorMap } from '@app/components/Discover/constants';
import GenreCard from '@app/components/GenreCard';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { GenreSliderItem } from '@server/interfaces/api/discoverInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.MovieGenreList', {
  moviegenres: 'Movie Genres',
});

const MovieGenreList = () => {
  const intl = useIntl();
  const { data, error } = useSWR<GenreSliderItem[]>(
    `/api/v1/discover/genreslider/movie`
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <Error statusCode={404} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.moviegenres)} />
      <div className="mt-1 mb-5">
        <Header>{intl.formatMessage(messages.moviegenres)}</Header>
      </div>
      <ul className="cards-horizontal">
        {data.map((genre, index) => (
          <li key={`genre-${genre.id}-${index}`}>
            <GenreCard
              name={genre.name}
              image={`https://image.tmdb.org/t/p/w1280_filter(duotone,${
                genreColorMap[genre.id] ?? genreColorMap[0]
              })${genre.backdrops[4]}`}
              url={`/discover/movies/genre/${genre.id}`}
              canExpand
            />
          </li>
        ))}
      </ul>
    </>
  );
};

export default MovieGenreList;
