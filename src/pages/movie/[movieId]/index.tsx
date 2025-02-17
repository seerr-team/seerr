import MovieDetails from '@app/components/MovieDetails';
import { getAuthHeaders } from '@app/utils/serverSidePropsHelpers';
import type { MovieDetails as MovieDetailsType } from '@server/models/Movie';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

interface MoviePageProps {
  movie?: MovieDetailsType;
}

const MoviePage: NextPage<MoviePageProps> = ({ movie }) => {
  return <MovieDetails movie={movie} />;
};

export const getServerSideProps: GetServerSideProps<MoviePageProps> = async (
  ctx
) => {
  const response = await axios.get<MovieDetailsType>(
    `http://${process.env.HOST || 'localhost'}:${
      process.env.PORT || 5055
    }/api/v1/movie/${ctx.query.movieId}`,
    {
      headers: getAuthHeaders(ctx),
    }
  );

  return {
    props: {
      movie: response.data,
    },
  };
};

export default MoviePage;
