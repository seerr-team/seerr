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

export const getServerSideProps: GetServerSideProps<MoviePageProps> = async (
  ctx
) => {
  try {
    const response = await axios.get<MovieDetailsType>(
      `http://${process.env.HOST || 'localhost'}:${
        process.env.PORT || 5055
      }/api/v1/movie/${ctx.query.movieId}`,
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
      return { props: {} };
    }
    throw e;
  }
};

export default MoviePage;
