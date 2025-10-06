import MovieDetails from '@app/components/MovieDetails';
import type { MovieDetails as MovieDetailsType } from '@server/models/Movie';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

interface MoviePageProps {
  movie?: MovieDetailsType;
}

const MoviePage: NextPage<MoviePageProps> = ({ movie }) => {
  return <MovieDetails movie={movie} />;
};

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const getServerSideProps: GetServerSideProps<MoviePageProps> = async (
  ctx
) => {
  const response = await axios.get<MovieDetailsType>(
    `http://${process.env.HOST || 'localhost'}:${
      process.env.PORT || 5055
    }${API_BASE}/api/v1/movie/${ctx.query.movieId}`,
    {
      headers: ctx.req?.headers?.cookie
        ? { cookie: ctx.req.headers.cookie }
        : undefined,
    }
  );

  return {
    props: {
      movie: response.data,
    },
  };
};

export default MoviePage;
