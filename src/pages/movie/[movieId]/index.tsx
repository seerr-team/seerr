import MovieDetails from '@app/components/MovieDetails';
import ErrorPage from '@app/pages/_error';
import { getHostAndPort } from '@app/utils/urlHelper';
import type { MovieDetails as MovieDetailsType } from '@server/models/Movie';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

interface MoviePageProps {
  movie?: MovieDetailsType;
  statusCode?: number;
}

const MoviePage: NextPage<MoviePageProps> = ({ movie, statusCode }) => {
  if (statusCode) {
    return <ErrorPage statusCode={statusCode} />;
  }

  return <MovieDetails movie={movie} />;
};

export const getServerSideProps: GetServerSideProps<MoviePageProps> = async (
  ctx
) => {
  try {
    const response = await axios.get<MovieDetailsType>(
      `http://${getHostAndPort()}/api/v1/movie/${ctx.query.movieId}`,
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
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      ctx.res.statusCode = 403;
      return { props: { statusCode: 403 } };
    }
    throw e;
  }
};

export default MoviePage;
